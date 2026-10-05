from urllib.parse import quote_plus, urlparse, parse_qs, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import time

import requests
from bs4 import BeautifulSoup

try:
    from ..fetchers.generic import GenericProductFetcher
except ImportError:  # supports running from the backend directory
    from fetchers.generic import GenericProductFetcher


class ProductDiscovery:

    def __init__(self):

        # ====================================================
        # HTTP HEADERS
        # ====================================================

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 "
                "(X11; Linux x86_64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/131.0 Safari/537.36"
            ),
            "Accept-Language": "en-IN,en;q=0.9",
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,"
                "image/webp,*/*;q=0.8"
            ),
            "Referer": "https://www.google.com/"
        }

        # ====================================================
        # MARKETPLACES
        # ====================================================

        # Supported marketplaces.

        self.marketplaces = {
            "Flipkart": self._flipkart_search,
            "Amazon": self._amazon_search,
            "Snapdeal": self._snapdeal_search
        }

        # ====================================================
        # PERFORMANCE SETTINGS
        # ====================================================

        # Keep a larger candidate pool so a valid product is not
        # discarded before its real product page is inspected.
        self.max_candidates_per_marketplace = 4
        self.search_result_limit = 8

        # Faster network timeouts.
        self.http_timeout = 6

        # Browser is fallback only.
        self.browser_timeout = 5000
        self.detail_browser_timeout = 5000

        # Short browser waits.
        self.browser_initial_wait = 600
        self.browser_scroll_wait = 300
        self.amazon_detail_wait = 300

        # Fetch several product pages concurrently.  Marketplace
        # searches already run in parallel, so this keeps total
        # comparison latency low without changing marketplace logic.
        self.detail_workers = 4

    # ========================================================
    # MAIN DISCOVERY
    # ========================================================

    def discover(self, canonical_product):

        total_start = time.perf_counter()

        search_query = canonical_product.get(
            "search_query"
        )

        if not search_query:

            return {
                "success": False,
                "error": "No search query available",
                "search_query": None,
                "candidate_count": 0,
                "candidates": []
            }

        candidates = []

        source_marketplace = self._marketplace_from_url(
            canonical_product.get("source_url")
        )
        marketplaces = {
            marketplace: search_function
            for marketplace, search_function in self.marketplaces.items()
            if marketplace != source_marketplace
        }
        category = str(canonical_product.get("category") or "").lower()
        category_terms = {
            "headphone": "Bluetooth Headphones",
            "powerbank": "Power Bank",
            "power_bank": "Power Bank",
            "laptop": "Laptop",
            "mobile": "Smartphone",
            "smartwatch": "Smartwatch",
        }
                # ====================================================
        # QUERY VARIANTS
        # ====================================================

        query_variants = []

        base_query = str(
            search_query or ""
        ).strip()

        if base_query:
            query_variants.append(base_query)

        brand = str(
            canonical_product.get("brand") or ""
        ).strip()

        model = str(
            canonical_product.get("model") or ""
        ).strip()

        product_name = str(
            canonical_product.get("product_name")
            or canonical_product.get("name")
            or ""
        ).strip()

        # ----------------------------------------------------
        # Short identity query.
        #
        # Long marketplace titles can cause Flipkart to return
        # accessories instead of the actual product.
        #
        # Example:
        #   Noise Endeavour Pro (Smartchoice) Outdoor Rugged ...
        # becomes:
        #   Noise Endeavour Pro
        #
        # Exact matching is still performed later, so this only
        # improves discovery and does NOT weaken variant matching.
        # ----------------------------------------------------
        if brand and model:
            model_identity = re.sub(
                r"\\([^)]*\\)",
                " ",
                model
            )
            model_identity = re.sub(
                r"[^A-Za-z0-9]+",
                " ",
                model_identity
            )

            identity_words = [
                word
                for word in model_identity.split()
                if len(word) > 1
                and word.lower() not in {
                    "smartchoice",
                    "outdoor",
                    "rugged",
                    "military",
                    "smart",
                    "watch",
                    "mobile",
                    "phone",
                    "smartphone",
                    "with",
                    "galaxy",
                    "ai",
                }
            ]

            # Keep enough model identity to find the correct
            # product without turning the search into a title.
            if identity_words:
                short_identity = " ".join(
                    [brand] + identity_words[:3]
                )

                if short_identity.lower() not in {
                    q.lower() for q in query_variants
                }:
                    # Put the short identity near the front so
                    # Flipkart actually searches it within its
                    # two-query discovery limit.
                    query_variants.insert(
                        0,
                        short_identity
                    )

        category = str(
            canonical_product.get("category") or ""
        ).lower()

        category_terms = {
            "headphone": "Bluetooth Headphones",
            "powerbank": "Power Bank",
            "power_bank": "Power Bank",
            "laptop": "Laptop",
            "mobile": "Smartphone",
            "smartwatch": "Smartwatch",
        }

        category_term = category_terms.get(category)

        # ----------------------------------------------------
        # Extract important product variants.
        #
        # This is especially important for:
        #   iPhone 16 256 GB
        #   iPhone 16 White
        #   EarPods Lightning
        #   50000 mAh Power Bank
        # ----------------------------------------------------

        variant_tokens = []

        variant_patterns = [
            r"\b\d+\s*GB\b",
            r"\b\d+\s*TB\b",
            r"\b\d+\s*MB\b",
            r"\b\d+\s*mAh\b",
            r"\b\d+\s*W\b",
            r"\b\d+(?:\.\d+)?\s*inch\b",
            r"\bUSB[- ]?C\b",
            r"\bType[- ]?C\b",
            r"\bLightning\b",
            r"\bANC\b",
            r"\b\d+(?:st|nd|rd|th)\s+Gen\b",
        ]

        for pattern in variant_patterns:
            for match in re.findall(
                pattern,
                product_name,
                flags=re.IGNORECASE
            ):
                cleaned = re.sub(
                    r"\s+",
                    " ",
                    str(match)
                ).strip()

                if cleaned and cleaned.lower() not in {
                    item.lower()
                    for item in variant_tokens
                }:
                    variant_tokens.append(cleaned)

        # ----------------------------------------------------
        # Common colour variants.
        # ----------------------------------------------------

        colors = {
            "black",
            "white",
            "blue",
            "green",
            "red",
            "pink",
            "purple",
            "yellow",
            "orange",
            "silver",
            "gold",
            "grey",
            "gray",
            "midnight",
            "starlight",
            "natural",
            "titanium"
        }

        product_words = set(
            re.findall(
                r"[a-z0-9]+",
                product_name.lower()
            )
        )

        for color in colors:
            if color in product_words:
                variant_tokens.append(color)

        # Remove duplicates while preserving order.
        unique_variants = []

        seen_variant_tokens = set()

        for token in variant_tokens:
            normalized = token.lower()

            if normalized not in seen_variant_tokens:
                seen_variant_tokens.add(normalized)
                unique_variants.append(token)

        variant_tokens = unique_variants[:5]

        # ----------------------------------------------------
        # Strong identity query.
        # ----------------------------------------------------

        if brand and model:

            identity_query = (
                f"{brand} {model}"
            ).strip()

            if variant_tokens:
                identity_query = (
                    f"{identity_query} "
                    f"{' '.join(variant_tokens)}"
                ).strip()

            if identity_query not in query_variants:
                query_variants.append(
                    identity_query
                )

        # ----------------------------------------------------
        # Product-name identity query.
        #
        # Keep only the useful beginning of the original
        # product title so marketplace suffixes such as
        # "Amazon.in: Electronics" do not pollute search.
        # ----------------------------------------------------

        clean_product_name = re.sub(
            r"\s+",
            " ",
            product_name
        ).strip()

        clean_product_name = re.sub(
            r"\s*(?:Amazon\.in|Flipkart).*?$",
            "",
            clean_product_name,
            flags=re.IGNORECASE
        ).strip()

        if clean_product_name:

            name_query = clean_product_name[:150]

            if name_query not in query_variants:
                query_variants.append(
                    name_query
                )

        # ----------------------------------------------------
        # Category-specific query.
        # ----------------------------------------------------

        if category_term and brand and model:

            category_query = (
                f"{brand} {model} {category_term}"
            ).strip()

            if variant_tokens:
                category_query = (
                    f"{category_query} "
                    f"{' '.join(variant_tokens[:3])}"
                ).strip()

            if category_query not in query_variants:
                query_variants.append(
                    category_query
                )

        # ----------------------------------------------------
        # Prioritize strong identity queries.
        #
        # Amazon can be very slow for broad queries such as:
        #   "Google Google Pixel 11"
        #
        # A variant-aware identity query such as:
        #   "Google Google Pixel 11 256 GB"
        #
        # is both faster and much more useful.
        #
        # Keep the broad query as a fallback, but do not spend
        # the first request on it when a stronger query exists.
        # ----------------------------------------------------

        if brand and model and variant_tokens:
            strong_query = (
                f"{brand} {model} "
                f"{' '.join(variant_tokens)}"
            ).strip()

            reordered_variants = []

            if strong_query:
                reordered_variants.append(
                    strong_query
                )

            for candidate_query in query_variants:
                if candidate_query not in reordered_variants:
                    reordered_variants.append(
                        candidate_query
                    )

            query_variants = reordered_variants

        # ----------------------------------------------------
        # Keep only a small number of high-value queries.
        # This prevents multiple unnecessary requests.
        # ----------------------------------------------------

        query_variants = query_variants[:3]

        print(
            "[DISCOVERY] Query variants:"
        )

        for i, query in enumerate(
            query_variants,
            start=1
        ):
            print(
                f"  {i}. {query}"
            )

        # ====================================================
        # PARALLEL MARKETPLACE SEARCH
        # ====================================================

        with ThreadPoolExecutor(
            max_workers=max(1, len(marketplaces))
        ) as executor:

            futures = {}

            for marketplace, search_function in (
                marketplaces.items()
            ):

                future = executor.submit(
                    self._discover_marketplace,
                    marketplace,
                    search_function,
                    search_query,
                    query_variants,
                    canonical_product
                )

                futures[future] = marketplace

            for future in as_completed(futures):

                marketplace = futures[future]

                try:

                    marketplace_candidates = (
                        future.result()
                    )

                    candidates.extend(
                        marketplace_candidates
                    )

                    print(
                        f"\n{marketplace}: "
                        f"{len(marketplace_candidates)} "
                        "candidates returned."
                    )

                except Exception as e:

                    print(
                        f"\n{marketplace} discovery failed:",
                        e
                    )

        # ====================================================
        # REMOVE DUPLICATES
        # ====================================================

        candidates = self._remove_duplicate_candidates(
            candidates
        )

        total_time = (
            time.perf_counter()
            - total_start
        )

        print("\n========================================")
        print("DISCOVERY COMPLETE")
        print(
            "Total candidates:",
            len(candidates)
        )
        print(
            f"Discovery time: {total_time:.2f} seconds"
        )
        print("========================================\n")

        return {
            "success": True,
            "search_query": search_query,
            "candidate_count": len(candidates),
            "candidates": candidates
        }

    def _marketplace_from_url(self, url):
        host = str(url or "").lower()
        if "amazon." in host:
            return "Amazon"
        if "flipkart.com" in host or "fkrt.it" in host:
            return "Flipkart"
        if "snapdeal.com" in host:
            return "Snapdeal"
        return None

    def _query_contains_terms(self, query, terms):
        query_tokens = set(re.findall(r"[a-z0-9]+", str(query).lower()))
        term_tokens = set(re.findall(r"[a-z0-9]+", str(terms).lower()))
        return term_tokens.issubset(query_tokens)

    def _candidate_has_target_variant(
        self,
        candidate,
        canonical_product
    ):
        """Return True when a candidate title carries the source's
        important storage/RAM/network variant specifications.

        This is used only as a discovery optimization. Final
        compatibility is still decided by the product matcher.
        """

        if not candidate or not canonical_product:
            return False

        candidate_name = self._normalize_identity(
            candidate.get("name")
        )

        target_name = self._normalize_identity(
            canonical_product.get("product_name")
            or canonical_product.get("name")
        )

        if not candidate_name or not target_name:
            return False

        def extract_storage(value):
            matches = re.findall(
                r"\b(\d+(?:\.\d+)?)\s*(gb|tb)\b",
                value,
                re.IGNORECASE
            )
            values = []

            for number, unit in matches:
                end_pattern = (
                    rf"\b{re.escape(number)}\s*"
                    rf"{re.escape(unit)}\b"
                    rf"\\s*(?:ram|memory)"
                )

                if re.search(
                    end_pattern,
                    value,
                    re.IGNORECASE
                ):
                    continue

                size = float(number)
                if unit.lower() == "tb":
                    size *= 1024

                values.append(int(size))

            return tuple(sorted(set(values)))

        def extract_ram(value):
            matches = re.findall(
                r"\b(\d+(?:\.\d+)?)\s*(gb|tb)\b"
                r"\s*(?:ram|memory)\b",
                value,
                re.IGNORECASE
            )

            values = []

            for number, unit in matches:
                size = float(number)
                if unit.lower() == "tb":
                    size *= 1024

                values.append(int(size))

            return tuple(sorted(set(values)))

        target_storage = extract_storage(target_name)
        candidate_storage = extract_storage(candidate_name)

        target_ram = extract_ram(target_name)
        candidate_ram = extract_ram(candidate_name)

        if target_storage:
            if not candidate_storage:
                return False

            if not any(
                value in candidate_storage
                for value in target_storage
            ):
                return False

        if target_ram:
            if not candidate_ram:
                return False

            if not any(
                value in candidate_ram
                for value in target_ram
            ):
                return False

        return True

    # ========================================================
    # SINGLE MARKETPLACE DISCOVERY
    # ========================================================

    def _discover_marketplace(
        self,
        marketplace,
        search_function,
        search_query,
        query_variants=None,
        canonical_product=None
    ):
        started = time.perf_counter()

        print(f"\n[{marketplace}] Starting discovery...")

        try:
            variants = query_variants or [search_query]

            source_marketplace = self._marketplace_from_url(
                (canonical_product or {}).get("source_url")
            )

            results = []

            # Keep discovery fast.
            #
            # Amazon and Flipkart retain the existing 3-query
            # discovery behavior. Snapdeal is a secondary fallback
            # marketplace, so use only the strongest query there.
            if marketplace == "Snapdeal":
                variants_to_use = variants[:1]

            elif marketplace == "Amazon":
                # Amazon search is much more reliable when the strongest
                # identity query (brand + model + detected variants) is
                # searched before broad/product-name queries.
                #
                # Keep the generated query variants intact and simply
                # promote the strongest identity query to the front.
                amazon_variants = list(variants)

                target_brand = str(
                    (canonical_product or {}).get("brand") or ""
                ).strip()

                target_model = str(
                    (canonical_product or {}).get("model") or ""
                ).strip()

                target_name = str(
                    (canonical_product or {}).get("product_name")
                    or (canonical_product or {}).get("name")
                    or ""
                ).strip()

                detected_variants = []

                for pattern in (
                    r"\\b\\d+\\s*GB\\b",
                    r"\\b\\d+\\s*TB\\b",
                    r"\\b\\d+\\s*mAh\\b",
                    r"\\bUSB[- ]?C\\b",
                    r"\\bType[- ]?C\\b",
                    r"\\bLightning\\b",
                ):
                    for match in re.findall(
                        pattern,
                        target_name,
                        flags=re.IGNORECASE
                    ):
                        token = re.sub(
                            r"\\s+",
                            " ",
                            str(match)
                        ).strip()

                        if token and token.lower() not in {
                            item.lower() for item in detected_variants
                        }:
                            detected_variants.append(token)

                color_words = {
                    "black", "white", "blue", "green", "red",
                    "pink", "purple", "yellow", "orange",
                    "silver", "gold", "grey", "gray",
                    "midnight", "starlight", "natural", "titanium"
                }

                name_words = set(
                    re.findall(
                        r"[a-z0-9]+",
                        target_name.lower()
                    )
                )

                for color in color_words:
                    if color in name_words:
                        detected_variants.append(color)

                strong_queries = []

                if target_brand and target_model:
                    identity_query = (
                        f"{target_brand} {target_model}"
                    ).strip()

                    if detected_variants:
                        identity_query = (
                            f"{identity_query} "
                            f"{' '.join(detected_variants[:5])}"
                        ).strip()

                    strong_queries.append(identity_query)

                # Promote identity query, then retain existing variants.
                variants_to_use = []

                for query in strong_queries + amazon_variants:
                    query = str(query or "").strip()

                    if query and query not in variants_to_use:
                        variants_to_use.append(query)

                variants_to_use = variants_to_use[:3]

                print(
                    f"[Amazon] Prioritized search queries: "
                    f"{variants_to_use}"
                )

            else:
                # Keep Flipkart's existing discovery behavior unchanged.
                variants_to_use = variants[:2]

            for index, query in enumerate(variants_to_use):
                search_url = search_function(query)

                print(
                    f"\n[{marketplace}] "
                    f"Search query {index + 1}: {query}"
                )

                print(
                    f"[{marketplace}] "
                    f"Search URL: {search_url}"
                )

                # ------------------------------------------------
                # FAST PATH:
                # Search variants use requests only.
                #
                # This prevents every failed variant from launching
                # a separate Chromium instance.
                # ------------------------------------------------
                page_results = self._fetch_search_results(
                    marketplace,
                    search_url,
                    allow_browser_fallback=False
                )

                print(
                    f"[{marketplace}] Raw candidates for "
                    f"'{query}': {len(page_results)}"
                )

                for raw_candidate in page_results:
                    print(
                        f"[{marketplace}] RAW | "
                        f"{raw_candidate.get('name')} | "
                        f"{raw_candidate.get('product_url')}"
                    )

                results.extend(page_results)

                prepared = self._prepare_search_candidates(
                    results
                )

                prioritized = (
                    self._prioritize_amazon_to_flipkart_candidates(
                        prepared,
                        canonical_product
                    )
                )

                print(
                    f"[{marketplace}] "
                    f"Candidates kept after filtering: "
                    f"{len(prioritized)}"
                )

                # IMPORTANT:
                # Keep the full accumulated search results intact.
                # The prioritizer is only used here to decide whether
                # we already have a strong enough candidate to stop.
                #
                # Do NOT replace `results` with `prioritized` here.
                # Doing so can discard useful candidates from earlier
                # or later search variants before final prioritization.

                # Only stop searching when a candidate is BOTH:
                #   1. the exact target model
                #   2. carrying the required storage/RAM variant
                #
                # This prevents wrong variants such as iPhone 16 128 GB
                # from stopping discovery for an iPhone 16 256 GB target.
                variant_compatible_candidates = [
                    candidate
                    for candidate in prioritized
                    if self._candidate_has_target_variant(
                        candidate,
                        canonical_product
                    )
                ]

                exact_variant_match = any(
                    self._has_exact_model(
                        [candidate],
                        canonical_product
                    )
                    for candidate in variant_compatible_candidates
                )

                if exact_variant_match:
                    print(
                        f"[{marketplace}] "
                        "Strong exact-variant candidate found. "
                        "Stopping additional searches."
                    )
                    break

            # ------------------------------------------------
            # FAST SEARCHES COMPLETE
            # ------------------------------------------------

            prepared = self._prepare_search_candidates(results)

            # ------------------------------------------------
            # REMOVE EXPLICITLY WRONG VARIANTS BEFORE THE
            # LIMITED DISCOVERY PRIORITIZATION.
            #
            # Example:
            #   Target:    iPhone 16 256 GB
            #   Candidates:
            #       iPhone 16 128 GB  -> reject
            #       iPhone 16 256 GB  -> keep
            #       iPhone 16         -> keep
            #
            # This prevents wrong variants from consuming the
            # max_candidates_per_marketplace slots.
            #
            # Final product equivalence is still decided by the
            # authoritative matcher.
            # ------------------------------------------------
            if marketplace != "Amazon":
                prepared = self._filter_incompatible_detail_candidates(
                    prepared,
                    canonical_product
                )

            results = (
                self._prioritize_amazon_to_flipkart_candidates(
                    prepared,
                    canonical_product
                )
            )

            # ------------------------------------------------
            # TARGETED AMAZON RECOVERY
            #
            # Request search and browser search are two different
            # retrieval mechanisms.  Amazon can return valid-looking
            # related products while omitting the requested listing.
            #
            # Therefore:
            #
            #   request search
            #       ↓
            #   exact model + required variant?
            #       ↓ NO
            #   targeted browser query escalation
            #       ↓
            #   explicit variant filtering
            #       ↓
            #   strict matcher
            #
            # Discovery is allowed to search harder, but it is never
            # allowed to declare a match.  The matcher remains the
            # final authority.
            # ------------------------------------------------

            if (
                marketplace == "Amazon"
                and variants_to_use
            ):

                # ------------------------------------------------
                # Check the request results for a genuinely useful
                # candidate before spending browser time.
                #
                # If the source specifies storage/RAM, BOTH the
                # identity and the required variant must be present.
                # A model-only candidate such as:
                #
                #   iPhone 16 128 GB
                #
                # is NOT considered an exact candidate for:
                #
                #   iPhone 16 256 GB
                # ------------------------------------------------

                request_exact_variant = any(
                    self._has_exact_model(
                        [candidate],
                        canonical_product
                    )
                    and self._candidate_has_target_variant(
                        candidate,
                        canonical_product
                    )
                    for candidate in results
                )

                request_exact_model = any(
                    self._has_exact_model(
                        [candidate],
                        canonical_product
                    )
                    for candidate in results
                )

                if request_exact_variant:
                    print(
                        f"[{marketplace}] "
                        "Request search already found an "
                        "exact model + target variant."
                    )

                else:
                    target_brand = self._normalize_identity(
                        (canonical_product or {}).get("brand")
                    )

                    target_model = self._normalize_identity(
                        (canonical_product or {}).get("model")
                    )

                    target_name = self._normalize_identity(
                        (canonical_product or {}).get("product_name")
                        or (canonical_product or {}).get("name")
                    )

                    # ------------------------------------------------
                    # Build a small deterministic browser-query
                    # escalation list.
                    #
                    # Never use a model-only query when the source has
                    # a required storage/RAM variant.
                    # ------------------------------------------------

                    browser_queries = []

                    def add_browser_query(query):
                        query = str(query or "").strip()

                        if not query:
                            return

                        normalized = self._normalize_identity(query)

                        if not normalized:
                            return

                        if normalized not in {
                            self._normalize_identity(q)
                            for q in browser_queries
                        }:
                            browser_queries.append(query)

                    # Strongest canonical search query.
                    add_browser_query(
                        variants_to_use[0]
                    )

                    # Compact identity + explicit source variant.
                    #
                    # Extract storage/RAM directly from the canonical
                    # product name.  This avoids depending on noisy
                    # search-card model extraction.
                    variant_terms = []

                    if target_name:
                        variant_matches = re.findall(
                            r"\b\d+(?:\.\d+)?\s*(?:gb|tb|mb)\b",
                            target_name,
                            re.IGNORECASE
                        )

                        variant_terms.extend(
                            variant_matches
                        )

                        ram_matches = re.findall(
                            r"\b\d+(?:\.\d+)?\s*(?:gb|tb)\s*ram\b",
                            target_name,
                            re.IGNORECASE
                        )

                        variant_terms.extend(
                            ram_matches
                        )

                    # Preserve order while removing duplicates.
                    seen_variant_terms = set()
                    variant_terms = [
                        term
                        for term in variant_terms
                        if not (
                            self._normalize_identity(term)
                            in seen_variant_terms
                            or seen_variant_terms.add(
                                self._normalize_identity(term)
                            )
                        )
                    ]

                    if target_model and variant_terms:
                        add_browser_query(
                            f"{target_brand} {target_model} "
                            f"{' '.join(variant_terms)}"
                        )

                    # If the canonical model itself already contains a
                    # meaningful specification, retain it as another
                    # targeted identity query.
                    if target_brand and target_model:
                        if not variant_terms:
                            add_browser_query(
                                f"{target_brand} {target_model}"
                            )

                    # Do not let browser recovery become unbounded.
                    browser_queries = browser_queries[:1]

                    if request_exact_model:
                        print(
                            f"[{marketplace}] "
                            "Request search found an exact model "
                            "but not the required variant."
                        )
                    else:
                        print(
                            f"[{marketplace}] "
                            "Request search found no exact model."
                        )

                    print(
                        f"[{marketplace}] "
                        "Starting targeted browser query "
                        f"escalation: {len(browser_queries)} query(s)."
                    )

                    browser_recovery_results = []

                    for browser_index, browser_query in enumerate(
                        browser_queries,
                        1
                    ):
                        print(
                            f"[{marketplace}] "
                            f"Browser query {browser_index}: "
                            f"{browser_query}"
                        )

                        fallback_url = search_function(
                            browser_query
                        )

                        page_results = (
                            self._fetch_search_with_browser(
                                marketplace,
                                fallback_url
                            )
                        )

                        page_results = (
                            self._prepare_search_candidates(
                                page_results
                            )
                        )

                        # Remove candidates that explicitly conflict
                        # with the source variant before evaluating the
                        # browser result.
                        before_browser_filter = len(
                            page_results
                        )

                        if marketplace != "Amazon":
                            page_results = (
                                self._filter_incompatible_detail_candidates(
                                    page_results,
                                    canonical_product
                                )
                            )

                        removed_browser_variants = (
                            before_browser_filter
                            - len(page_results)
                        )

                        if removed_browser_variants:
                            print(
                                f"[{marketplace}] "
                                "Browser variant filter removed "
                                f"{removed_browser_variants} "
                                "candidate(s)."
                            )

                        for candidate in page_results:
                            browser_recovery_results.append(
                                candidate
                            )

                        # Check the filtered page immediately.
                        page_exact_variant = [
                            candidate
                            for candidate in page_results
                            if self._has_exact_model(
                                [candidate],
                                canonical_product
                            )
                            and self._candidate_has_target_variant(
                                candidate,
                                canonical_product
                            )
                        ]

                        if page_exact_variant:
                            print(
                                f"[{marketplace}] "
                                "Targeted browser search found "
                                "exact model + target variant."
                            )

                            # IMPORTANT:
                            # Do not replace the accumulated discovery
                            # pool with this page alone.
                            #
                            # Browser recovery is an additional retrieval
                            # source. Merge its candidates with the
                            # request-search candidates and let the final
                            # ranking/detail-fetch stages decide which
                            # products deserve verification.
                            results.extend(page_results)

                            break

                    else:
                        # No browser query found an exact
                        # model + variant.
                        #
                        # Preserve only the original request results.
                        # The final matcher can still inspect candidates
                        # whose variant is unknown, while explicit wrong
                        # variants have already been removed.
                        print(
                            f"[{marketplace}] "
                            "Targeted browser escalation found no "
                            "exact model + target variant."
                        )

                        request_safe_results = (
                            self._filter_incompatible_detail_candidates(
                                results,
                                canonical_product
                            )
                        )

                        results = request_safe_results

                    print(
                        f"[{marketplace}] "
                        "Targeted recovery candidates:"
                    )

                    for i, candidate in enumerate(
                        results,
                        1
                    ):
                        print(
                            f"  {i}. "
                            f"name={candidate.get('name')} | "
                            f"model={candidate.get('model')} | "
                            f"brand={candidate.get('brand')} | "
                            f"url={candidate.get('product_url')}"
                        )

            print(
                f"[{marketplace}] "
                f"{len(results)} search candidates found."
            )

            if not results:
                print(
                    f"[{marketplace}] No search candidates."
                )
                return []

            # ------------------------------------------------
            # SNAPDEAL SPEED LIMIT
            #
            # Snapdeal is an additional comparison marketplace.
            # Do not spend the same discovery budget on it as the
            # primary Amazon/Flipkart marketplaces.
            #
            # Keep only the strongest two search candidates before
            # full-page detail fetching. The matcher still performs
            # the final strict equivalence check, so unrelated
            # products are never presented as matches.
            # ------------------------------------------------
            results = self._prepare_search_candidates(results)

            if marketplace == "Snapdeal":
                results = results[:2]

                print(
                    f"[{marketplace}] "
                    f"Fast-path detail limit: "
                    f"{len(results)} candidates."
                )

            # ------------------------------------------------
            # PRE-DETAIL VARIANT FILTER
            #
            # Reject only candidates whose explicitly stated
            # storage/RAM variant conflicts with the source.
            #
            # Unknown variants are preserved and can still be
            # verified by the full detail fetch + matcher.
            # ------------------------------------------------
            before_variant_filter = len(results)

            if marketplace != "Amazon":
                results = (
                    self._filter_incompatible_detail_candidates(
                        results,
                        canonical_product
                    )
                )

            removed_variant_candidates = (
                before_variant_filter - len(results)
            )

            if removed_variant_candidates:
                print(
                    f"[{marketplace}] "
                    "Pre-detail variant filter removed "
                    f"{removed_variant_candidates} "
                    "incompatible candidate(s)."
                )

            # ------------------------------------------------
            # FINAL DISCOVERY RANKING
            #
            # Browser recovery may have added candidates that were
            # not present in request search. Re-rank the complete
            # compatible discovery pool before the expensive detail
            # fetch budget is applied.
            #
            # The prioritizer no longer truncates the pool. The
            # detail-fetch stage below is responsible for limiting
            # expensive verification work.
            # ------------------------------------------------
            results = (
                self._prioritize_amazon_to_flipkart_candidates(
                    results,
                    canonical_product
                )
            )

            # ------------------------------------------------
            # AMAZON VARIANT DETAIL RECOVERY
            #
            # Search cards may expose a different variant
            # (for example 128 GB) even when the product family
            # matches the requested model (for example iPhone 16).
            #
            # Do not reject that candidate yet. Force it through
            # the product-page fetch so Amazon's full variant data
            # can be inspected.
            #
            # The final matcher remains strict and will still reject
            # a wrong variant such as 128 GB vs 256 GB.
            # ------------------------------------------------
            if marketplace == "Amazon" and canonical_product:
                target_model = self._normalize_identity(
                    canonical_product.get("model")
                )

                for candidate in results:
                    candidate_model = self._candidate_model_key(
                        candidate
                    )

                    if (
                        target_model
                        and candidate_model
                        and self._model_matches_target(
                            candidate_model,
                            target_model
                        )
                    ):
                        candidate["_force_variant_detail_fetch"] = True

            print(
                f"[{marketplace}] "
                f"Candidates entering detail fetch: "
                f"{len(results)}"
            )

            detailed_results = self._fetch_candidate_details(
                results
            )

            elapsed = time.perf_counter() - started

            print(
                f"[{marketplace}] Finished in "
                f"{elapsed:.2f} seconds."
            )

            return detailed_results

        except Exception as e:
            print(
                f"[{marketplace}] Discovery error:",
                e
            )
            return []

    # PREPARE SEARCH CANDIDATES
    # ========================================================

    def _prepare_search_candidates(
        self,
        candidates
    ):

        for candidate in candidates:

            name = candidate.get(
                "name"
            )

            # ------------------------------------------------
            # MODEL
            # ------------------------------------------------

            if not candidate.get("model"):

                model = (
                    self._extract_model_from_name(
                        name
                    )
                )

                if model:

                    candidate["model"] = model

            # ------------------------------------------------
            # CATEGORY
            # ------------------------------------------------

            if not candidate.get("category"):

                candidate["category"] = (
                    self._infer_category(
                        name
                    )
                )

            # ------------------------------------------------
            # BRAND
            # ------------------------------------------------

            if not candidate.get("brand"):

                brand = (
                    self._extract_brand_from_name(
                        name
                    )
                )

                if brand:

                    candidate["brand"] = brand

        return candidates

    def _candidate_model_key(self, candidate):
        model = candidate.get("model")
        if model:
            return self._normalize_identity(model)
        return self._normalize_identity(
            self._extract_model_from_name(candidate.get("name"))
        )

    def _normalize_identity(self, value):
        return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

    def _model_matches_target(self, candidate_model, target_model):
        """Return True for the same model or specification-only suffixes.

        Search-result titles can append specifications to a model, such as
        "Studio Evo 70hrs" or "Muffs M2 20W". Those should match the base
        model. Real model variants such as "Rockerz 370 Pro" must not match
        "Rockerz 370".
        """
        candidate_model = self._normalize_identity(candidate_model)
        target_model = self._normalize_identity(target_model)

        if not candidate_model or not target_model:
            return False

        if candidate_model == target_model:
            return True

        candidate_tokens = candidate_model.split()
        target_tokens = target_model.split()

        if (
            len(candidate_tokens) <= len(target_tokens)
            or candidate_tokens[:len(target_tokens)] != target_tokens
        ):
            return False

        suffix_tokens = candidate_tokens[len(target_tokens):]

        specification_pattern = re.compile(
            r"[0-9]+(?:\.[0-9]+)?"
            r"(?:mah|hrs?|hours?|gb|tb|mb|w|watts|mm|cm|hz|khz|ms|mp)",
            re.IGNORECASE,
        )

        specification_tokens = {
            "hrs", "hr", "hours", "hour",
            "gb", "tb", "mb",
            "mah",
            "w", "watts",
            "mm", "cm",
            "hz", "khz",
            "ms",
            "inch", "in",
            "mp",
            # Mobile network generation suffixes.
            # These are specifications, not different models.
            "2g", "3g", "4g", "5g",
        }

        for token in suffix_tokens:
            if token in specification_tokens:
                continue

            if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", token):
                continue

            if specification_pattern.fullmatch(token):
                continue

            return False

        return True

    def _prioritize_amazon_to_flipkart_candidates(
        self,
        candidates,
        canonical_product
    ):
        """
        Relaxed candidate selection used ONLY for:

            Amazon source -> Flipkart discovery

        Search-result titles are noisy on Flipkart, so the model
        extracted from the search card must NOT be treated as the
        final product identity.

        The actual Flipkart product page is fetched afterwards and
        the existing product matcher performs the strict identity
        check.
        """

        if not candidates:
            return []

        target_brand = self._normalize_identity(
            (canonical_product or {}).get("brand")
        )

        target_model = self._normalize_identity(
            (canonical_product or {}).get("model")
        )

        # Marketplace model extraction may omit the brand while the
        # canonical model may include it, e.g.:
        #   canonical: Google Pixel 11
        #   Amazon:    Pixel 11 5G
        # For discovery ranking only, compare the core model without
        # the known canonical brand. Final matching remains strict.
        if target_brand and target_model:
            brand_prefix = target_brand + " "
            if target_model.startswith(brand_prefix):
                target_model = target_model[len(brand_prefix):].strip()

        target_category = self._normalize_identity(
            (canonical_product or {}).get("category")
        )

        kept = []

        accessory_words = {
            "case",
            "cover",
            "cushion",
            "cushions",
            "replacement",
            "earpad",
            "earpads",
            "stand",
            "holder",
            "cable",
            "adapter",
            "protective",
            "storage",
            "protector",
            "skin",
            "sleeve",
            "screen",
            "tempered",
            "film",
            "lens",
            "ring",
            # Wearable/watch accessories.
            "strap",
            "straps",
            "band",
            "bands",
            "belt",
            "belts",
            "guard",
            "guards",
            "bracelet",
            "wristband",
            "wristbands",
            # Common accessory-only product terms.
            "sticker",
            "stickers",
            "casecover",
            "bumper",
            "shell",
            "holder",
            "mount",
            "mounting",
        }

        accessory_phrases = (
            "compatible with",
            "phone case",
            "back cover",
            "camera lens",
            "lens protector",
            "screen protector",
            "screen guard",
            "display protector",
            "protective film",
            "watch strap",
            "watch band",
            "watch belt",
            "smartwatch strap",
            "smart watch strap",
            "smartwatch band",
            "smart watch band",
            "wrist band",
            "wrist strap",
            "replacement strap",
            "replacement band",
            "replacement belt",
            "magfit",
            "liquid air",
        )

        for candidate in candidates:

            name = self._normalize_identity(
                candidate.get("name")
            )

            if not name:
                continue

            name_tokens = set(
                name.split()
            )

            # ------------------------------------------------
            # Reject obvious accessories.
            # ------------------------------------------------

            is_accessory = (
                bool(
                    name_tokens.intersection(
                        accessory_words
                    )
                )
                or any(
                    phrase in name
                    for phrase in accessory_phrases
                )
            )

            if is_accessory:
                print(
                    "[Flipkart] "
                    "Accessory candidate rejected | "
                    f"{candidate.get('name')}"
                )
                continue

            candidate_brand = self._normalize_identity(
                candidate.get("brand")
            )

            # ------------------------------------------------
            # Brand mismatch is still useful protection.
            # ------------------------------------------------

            # ------------------------------------------------
            # Identity priority
            # ------------------------------------------------

            # Do NOT reject a candidate only because the
            # marketplace search card reports a different brand.
            # Search cards can contain seller/manufacturer data
            # that is different from the actual product identity.
            #
            # A matching brand improves ranking, while the final
            # product matcher performs the strict identity check.

            priority = 0

            if (
                target_brand
                and candidate_brand
                and candidate_brand == target_brand
            ):
                priority += 2

            candidate_model = (
                self._candidate_model_key(
                    candidate
                )
            )

            if candidate_model:

                if self._model_matches_target(
                    candidate_model,
                    target_model
                ):
                    priority = 4

                else:
                    # IMPORTANT:
                    #
                    # Do NOT discard it.
                    #
                    # Flipkart search cards frequently produce
                    # incomplete/wrong model extraction.
                    #
                    # The actual product page will be checked later.
                    priority = 1

            # Exact brand + model appearing in title gets
            # additional priority.
            if (
                target_brand
                and target_brand in name
            ):
                priority += 1

            if (
                target_model
                and target_model in name
            ):
                priority += 3

            # Category match is only a ranking signal.
            if (
                target_category
                and target_category in name
            ):
                priority += 1

            candidate["_identity_priority"] = priority

            kept.append(
                candidate
            )

        # ------------------------------------------------
        # Best candidates first.
        # ------------------------------------------------
        #
        # Exact model/title candidates must always outrank
        # generic search-card results. This is especially
        # important on Amazon, where accessories for the
        # requested product frequently appear first.
        #
        # Preserve the existing candidate information and
        # ranking logic; only make the final ordering more
        # identity-aware.

        # ------------------------------------------------
        # Final identity-aware ordering.
        # ------------------------------------------------
        #
        # Search-card brand/model extraction can be unreliable,
        # especially on Flipkart. The product title itself is
        # therefore an important discovery signal.
        #
        # Give candidates containing the complete target identity
        # in their title a strong boost BEFORE truncating the list.
        # This prevents accessories or unrelated search results
        # from occupying all available candidate slots.

        target_model_tokens = [
            token
            for token in target_model.split()
            if token
        ]

        for candidate in kept:
            name = self._normalize_identity(
                candidate.get("name")
            )

            priority = candidate.get(
                "_identity_priority",
                0
            )

            if target_brand and target_brand in name:
                priority += 3

            if target_model and target_model in name:
                priority += 6

            if (
                target_model_tokens
                and all(
                    token in name
                    for token in target_model_tokens
                )
            ):
                priority += 4

            candidate["_identity_priority"] = priority

        kept.sort(
            key=lambda candidate: (
                candidate.get(
                    "_identity_priority",
                    0
                ),
                bool(candidate.get("price")),
            ),
            reverse=True
        )

        # ------------------------------------------------
        # Exact model candidates get the first slots.
        # ------------------------------------------------

        exact_model = []
        fallback = []

        for candidate in kept:
            candidate_model = self._candidate_model_key(
                candidate
            )

            if (
                target_model
                and candidate_model
                and self._model_matches_target(
                    candidate_model,
                    target_model
                )
            ):
                exact_model.append(candidate)
            else:
                fallback.append(candidate)

        ordered = exact_model + fallback

        # Temporary diagnostic output for candidate selection.
        print(
            f"[{marketplace if 'marketplace' in locals() else 'Flipkart'}] "
            "FINAL PRIORITIZED CANDIDATES:"
        )

        for index, candidate in enumerate(
            ordered,
            1
        ):
            print(
                f"  {index}. "
                f"{candidate.get('name')} | "
                f"brand={candidate.get('brand')} | "
                f"model={candidate.get('model')} | "
                f"priority={candidate.get('_identity_priority')}"
            )

        # IMPORTANT:
        # This function ranks discovery candidates but MUST NOT
        # truncate the discovery pool.
        #
        # The expensive detail-fetch stage applies the marketplace
        # candidate budget later. Keeping the full ranked pool here
        # allows Amazon/browser escalation to recover listings that
        # appear below the first few search cards.
        return ordered


    def _prioritize_candidates(self, candidates, canonical_product):
        """Drop obvious model mismatches before expensive detail requests.

        Candidates without a model remain eligible because Amazon often
        renders only the brand in its search card; their detail page can still
        provide the complete title. Explicit mismatches are safe to discard.
        """
        if not canonical_product:
            return candidates[:self.max_candidates_per_marketplace], []

        target_model = self._normalize_identity(
            canonical_product.get("model")
        )
        if not target_model:
            return candidates[:self.max_candidates_per_marketplace], []

        kept = []
        discarded = []
        accessory_words = {
            "case", "cover", "cushion", "cushions", "replacement",
            "earpad", "earpads", "stand", "holder", "cable", "adapter",
            "protective", "storage"
        }
        target_brand = self._normalize_identity(
            canonical_product.get("brand")
        )
        for candidate in candidates:
            candidate_name = self._normalize_identity(candidate.get("name"))
            if any(word in candidate_name.split() for word in accessory_words):
                discarded.append(candidate)
                continue

            candidate_brand = self._normalize_identity(candidate.get("brand"))
            if target_brand and candidate_brand and candidate_brand != target_brand:
                discarded.append(candidate)
                continue

            candidate_model = self._candidate_model_key(candidate)

            if candidate_model and not self._model_matches_target(
                candidate_model,
                target_model
            ):
                discarded.append(candidate)
                continue

            candidate["_identity_priority"] = 2 if candidate_model else 0
            kept.append(candidate)

        kept.sort(
            key=lambda candidate: (
                candidate.get("_identity_priority", 0),
                bool(candidate.get("price")),
            ),
            reverse=True,
        )
        return kept[:self.max_candidates_per_marketplace], discarded

    def _has_exact_model(self, candidates, canonical_product):
        target_model = self._normalize_identity(
            (canonical_product or {}).get("model")
        )
        return bool(target_model and any(
            self._model_matches_target(
                self._candidate_model_key(candidate),
                target_model
            )
            for candidate in candidates
        ))

    # ========================================================
    # FETCH SEARCH RESULTS
    # ========================================================

    def _fetch_search_results(
        self,
        marketplace,
        search_url,
        allow_browser_fallback=True
    ):

        try:

            response = requests.get(
                search_url,
                headers=self.headers,
                timeout=self.http_timeout
            )

            print(
                f"{marketplace} requests status:",
                response.status_code
            )

            # ------------------------------------------------
            # REQUEST SUCCESS
            # ------------------------------------------------

            if response.status_code == 200:

                soup = BeautifulSoup(
                    response.text,
                    "html.parser"
                )

                results = self._parse_marketplace(
                    marketplace,
                    soup
                )

                if results:

                    print(
                        f"{marketplace}: "
                        "Search page parsed using requests."
                    )

                    return results[:self.search_result_limit]

                print(
                    f"{marketplace}: "
                    "Parser found no product candidates."
                )

                # ------------------------------------------------
                # AMAZON RETRY
                #
                # Amazon can occasionally return a valid HTTP 200
                # response with incomplete/alternate HTML. Retry
                # only Amazon and only when parsing returned zero
                # candidates. Flipkart behaviour is unchanged.
                # ------------------------------------------------

                if marketplace == "Amazon":
                    print(
                        "Amazon: Retrying request once "
                        "because parser found 0 candidates."
                    )

                    retry_headers = dict(self.headers)
                    retry_headers["Cache-Control"] = "no-cache"
                    retry_headers["Pragma"] = "no-cache"

                    try:
                        retry_response = requests.get(
                            search_url,
                            headers=retry_headers,
                            timeout=self.http_timeout
                        )

                        print(
                            "Amazon retry status:",
                            retry_response.status_code
                        )

                        if retry_response.status_code == 200:
                            retry_soup = BeautifulSoup(
                                retry_response.text,
                                "html.parser"
                            )

                            retry_results = self._parse_marketplace(
                                marketplace,
                                retry_soup
                            )

                            if retry_results:
                                print(
                                    "Amazon: Retry parsed "
                                    f"{len(retry_results)} candidates."
                                )

                                return retry_results[
                                    :self.search_result_limit
                                ]

                            print(
                                "Amazon: Retry also returned "
                                "0 parsed candidates."
                            )

                    except requests.exceptions.RequestException as e:
                        print(
                            "Amazon retry failed:",
                            e
                        )
                    except Exception as e:
                        print(
                            "Amazon retry parsing failed:",
                            e
                        )

            else:

                print(
                    f"{marketplace}: "
                    f"Requests returned HTTP "
                    f"{response.status_code}."
                )

        except requests.exceptions.RequestException as e:

            print(
                f"{marketplace} requests failed:",
                e
            )

        except Exception as e:

            print(
                f"{marketplace} requests parsing failed:",
                e
            )

        # ====================================================
        # PLAYWRIGHT FALLBACK
        #
        # IMPORTANT:
        # Discovery can disable this so that multiple search
        # variants do NOT launch multiple Chromium instances.
        # ====================================================

        if not allow_browser_fallback:

            print(
                f"{marketplace}: "
                "Skipping browser fallback for this search."
            )

            return []

        print(
            f"{marketplace}: "
            "Trying Playwright browser..."
        )

        return self._fetch_search_with_browser(
            marketplace,
            search_url
        )

    # ========================================================
    # PLAYWRIGHT SEARCH
    # ========================================================

    def _fetch_search_with_browser(
        self,
        marketplace,
        search_url
    ):

        started = time.perf_counter()

        try:

            from playwright.sync_api import sync_playwright

        except ImportError:

            print(
                "Playwright is not installed."
            )

            return []

        browser = None

        try:

            with sync_playwright() as p:

                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox"
                    ]
                )

                context = browser.new_context(

                    user_agent=(
                        "Mozilla/5.0 "
                        "(X11; Linux x86_64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/131.0 Safari/537.36"
                    ),

                    locale="en-IN",

                    viewport={
                        "width": 1366,
                        "height": 768
                    },

                    extra_http_headers={
                        "Accept-Language":
                            "en-IN,en;q=0.9"
                    }
                )

                page = context.new_page()

                print(
                    f"{marketplace}: "
                    "Opening search page in browser..."
                )

                try:

                    response = page.goto(
                        search_url,
                        wait_until="commit",
                        timeout=self.browser_timeout
                    )

                    if response:

                        print(
                            f"{marketplace} browser status:",
                            response.status
                        )

                    # Amazon can continue navigating after the initial
                    # commit response. Give the document a short,
                    # bounded synchronization point before reading
                    # page.content(). This prevents:
                    #
                    # Page.content: Unable to retrieve content because
                    # the page is navigating and changing the content.
                    #
                    # Keep the existing timeout limits so this does not
                    # turn the fallback into a slow browser crawl.
                    try:

                        page.wait_for_load_state(
                            "domcontentloaded",
                            timeout=min(
                                self.browser_initial_wait,
                                2500
                            )
                        )

                    except Exception:

                        pass

                    try:

                        page.wait_for_selector(
                            "[data-component-type='s-search-result'], div[data-asin], a[href*='/p/'], .s-result-item",
                            timeout=min(
                                self.browser_initial_wait,
                                2500
                            )
                        )

                    except Exception:

                        page.wait_for_timeout(
                            min(
                                self.browser_initial_wait,
                                1200
                            )
                        )

                except Exception as e:

                    print(
                        f"{marketplace}: "
                        "Browser navigation warning:",
                        e
                    )

                    page.wait_for_timeout(
                        min(
                            self.browser_initial_wait,
                            1200
                        )
                    )

                # ------------------------------------------------
                # SAFE PAGE CONTENT
                #
                # Amazon may still be changing the document after
                # navigation. Retry content extraction briefly
                # instead of failing the complete marketplace search.
                # ------------------------------------------------

                html = ""

                for attempt in range(3):

                    try:

                        html = page.content()

                        if html:
                            break

                    except Exception as e:

                        print(
                            f"{marketplace}: "
                            f"Page content retry "
                            f"{attempt + 1}/3:",
                            e
                        )

                        try:

                            page.wait_for_timeout(
                                400
                            )

                        except Exception:

                            pass

                results = []

                if html:

                    soup = BeautifulSoup(
                        html,
                        "html.parser"
                    )

                    # ------------------------------------------------
                    # TEMPORARY AMAZON BROWSER HTML DIAGNOSTIC
                    # ------------------------------------------------

                    print(
                        f"{marketplace}: Browser HTML length = {len(html)}"
                    )

                    print(
                        f"{marketplace}: "
                        f"Amazon result cards = "
                        f"{len(soup.select('[data-component-type=\"s-search-result\"]'))}"
                    )

                    print(
                        f"{marketplace}: "
                        f"data-asin cards = "
                        f"{len(soup.select('div[data-asin]'))}"
                    )

                    print(
                        f"{marketplace}: "
                        f"Amazon /dp/ links = "
                        f"{len(soup.select('a[href*=\"/dp/\"]'))}"
                    )

                    print(
                        f"{marketplace}: "
                        f"Amazon /gp/product/ links = "
                        f"{len(soup.select('a[href*=\"/gp/product/\"]'))}"
                    )

                    print(
                        f"{marketplace}: "
                        f"page title = "
                        f"{soup.title.get_text(' ', strip=True) if soup.title else 'NO TITLE'}"
                    )

                    # ------------------------------------------------
                    # END TEMPORARY DIAGNOSTIC
                    # ------------------------------------------------

                    results = self._parse_marketplace(
                        marketplace,
                        soup
                    )

                # ------------------------------------------------
                # SHORT SCROLL ONLY IF NECESSARY
                # ------------------------------------------------

                if not results:

                    try:

                        page.evaluate(
                            """
                            if (document.body) {
                                window.scrollTo(
                                    0,
                                    document.body.scrollHeight
                                );
                            }
                            """
                        )

                        page.wait_for_timeout(
                            self.browser_scroll_wait
                        )

                        html = ""

                        for attempt in range(3):

                            try:

                                html = page.content()

                                if html:
                                    break

                            except Exception as e:

                                print(
                                    f"{marketplace}: "
                                    f"Scroll page content retry "
                                    f"{attempt + 1}/3:",
                                    e
                                )

                                try:

                                    page.wait_for_timeout(
                                        300
                                    )

                                except Exception:

                                    pass

                        if html:

                            soup = BeautifulSoup(
                                html,
                                "html.parser"
                            )

                            results = self._parse_marketplace(
                                marketplace,
                                soup
                            )

                    except Exception as e:

                        print(
                            f"{marketplace}: "
                            "Scroll warning:",
                            e
                        )

                print(
                    f"{marketplace}: "
                    f"Playwright found "
                    f"{len(results)} candidates."
                )

                browser.close()
                browser = None

            elapsed = (
                time.perf_counter()
                - started
            )

            print(
                f"{marketplace}: "
                f"Browser search completed in "
                f"{elapsed:.2f}s."
            )

            return results[:self.search_result_limit]

        except Exception as e:

            print(
                f"{marketplace} Playwright search failed:",
                e
            )

            return []

        finally:

            try:

                if browser:

                    browser.close()

            except Exception:

                pass

    # ========================================================
    # MARKETPLACE PARSER ROUTER
    # ========================================================

    def _parse_marketplace(
        self,
        marketplace,
        soup
    ):

        if marketplace == "Flipkart":

            return self._parse_flipkart(
                soup
            )

        if marketplace == "Amazon":

            return self._parse_amazon(
                soup
            )

        if marketplace == "Snapdeal":

            return self._parse_snapdeal(
                soup
            )

        return []

    # ========================================================
    # PRE-DETAIL VARIANT FILTER
    # ========================================================

    def _filter_incompatible_detail_candidates(
        self,
        candidates,
        canonical_product
    ):
        """
        Remove search candidates that are already provably
        incompatible with the source product's required
        storage/RAM variant.

        This is an optimization only. The final matcher still
        performs the authoritative equivalence check.

        Example:
            Source:    iPhone 16 256 GB
            Candidate: iPhone 16 128 GB
            -> reject before expensive detail fetching

            Source:    iPhone 16 256 GB
            Candidate: iPhone 16 256 GB
            -> keep for detail fetching

            Source:    iPhone 16 256 GB
            Candidate: iPhone 16
            -> keep, because the variant is unknown and must
               not be assumed incompatible at this stage.
        """

        if not candidates or not canonical_product:
            return candidates

        target_name = self._normalize_identity(
            canonical_product.get("product_name")
            or canonical_product.get("name")
        )

        if not target_name:
            return candidates

        def extract_variants(value):
            storage = set()
            ram = set()

            for number, unit, suffix in re.findall(
                r"\b(\d+(?:\.\d+)?)\s*(gb|tb)\b"
                r"\s*(ram|memory)?",
                value,
                re.IGNORECASE
            ):
                size = float(number)

                if unit.lower() == "tb":
                    size *= 1024

                size = int(size)

                if suffix:
                    ram.add(size)
                else:
                    storage.add(size)

            return storage, ram

        target_storage, target_ram = extract_variants(
            target_name
        )

        if not target_storage and not target_ram:
            return candidates

        filtered = []

        for candidate in candidates:

            candidate_name = self._normalize_identity(
                candidate.get("name")
            )

            if not candidate_name:
                filtered.append(candidate)
                continue

            candidate_storage, candidate_ram = (
                extract_variants(candidate_name)
            )

            incompatible = False

            if target_storage and candidate_storage:
                if not target_storage.intersection(
                    candidate_storage
                ):
                    incompatible = True

            if target_ram and candidate_ram:
                if not target_ram.intersection(
                    candidate_ram
                ):
                    incompatible = True

            if incompatible:
                print(
                    f"[{candidate.get('marketplace', 'Unknown')}] "
                    "Pre-detail variant candidate rejected | "
                    f"{candidate_name}"
                )
                continue

            filtered.append(candidate)

        return filtered

    # ========================================================
    # PARALLEL PRODUCT DETAIL FETCHING
    # ========================================================

    def _fetch_candidate_details(
        self,
        candidates
    ):

        if not candidates:

            return []

        # ====================================================
        # AMAZON DETAIL RECOVERY
        #
        # Amazon search cards can contain incomplete identity
        # information. Do NOT apply the normal 2-candidate cap
        # before detail fetching, otherwise the correct listing
        # can be discarded before its product page is inspected.
        #
        # Keep the existing cap for Flipkart/Snapdeal.
        # ====================================================

        if candidates and candidates[0].get("marketplace") == "Amazon":
            candidates = candidates[:8]
            print(
                "Amazon detail recovery: allowing up to "
                f"{len(candidates)} candidates before detail fetch."
            )
        else:
            candidates = candidates[
                :self.max_candidates_per_marketplace
            ]

        # ====================================================
        # DETERMINE WHICH PRODUCTS REALLY NEED DETAILS
        # ====================================================

        needs_detail = []
        ready_candidates = []

        for candidate in candidates:

            force_amazon_variant_recovery = (
                candidate.get("marketplace") == "Amazon"
                and candidate.get("_force_variant_detail_fetch") is True
            )

            # Healthy Flipkart search cards already contain enough
            # information for matching and price comparison. Do not
            # waste ~10s opening every product page just to obtain
            # optional fields such as rating/review count/category.
            #
            # Keep full-page fetching for incomplete cards, and keep
            # Amazon variant recovery untouched.
            flipkart_search_ready = (
                candidate.get("marketplace") == "Flipkart"
                and bool(candidate.get("name"))
                and candidate.get("price") is not None
                and bool(
                    candidate.get("product_url")
                    or candidate.get("url")
                )
            )

            if (
                force_amazon_variant_recovery
                or (
                    not flipkart_search_ready
                    and self._needs_full_details(candidate)
                )
            ):

                needs_detail.append(
                    candidate
                )

            else:

                ready_candidates.append(
                    candidate
                )

        print(
            "\nSearch-page ready candidates:",
            len(ready_candidates)
        )

        print(
            "Candidates needing full page:",
            len(needs_detail)
        )

        # ====================================================
        # NOTHING NEEDS DETAIL
        # ====================================================

        if not needs_detail:

            print(
                "Using search-page data directly."
            )

            return ready_candidates

        # ====================================================
        # FETCH ONLY REQUIRED DETAILS
        # ====================================================

        print(
            "\nFetching details for "
            f"{len(needs_detail)} candidates..."
        )

        detailed_candidates = []

        def fetch_one(candidate):

            started = time.perf_counter()

            marketplace = candidate.get(
                "marketplace",
                "Unknown"
            )

            product_url = candidate.get(
                "product_url"
            )

            if not product_url:

                return None

            try:

                print(
                    f"\n[{marketplace}] "
                    "Fetching full details:"
                )

                print(
                    candidate.get(
                        "name"
                    )
                )

                # Separate fetcher per worker.
                fetcher = GenericProductFetcher()

                product = fetcher.fetch(
                    product_url
                )

                if not product:

                    product = {}

                # =================================================
                # AMAZON FALLBACK
                # =================================================

                if marketplace == "Amazon":

                    if self._amazon_details_missing(
                        product
                    ):

                        print(
                            "Amazon: Generic fetch "
                            "returned incomplete details."
                        )

                        # Browser fallback only when necessary.
                        browser_product = (
                            self._fetch_amazon_product_details(
                                product_url,
                                target_variant=(
                                    canonical_product.get("name")
                                    if canonical_product
                                    else None
                                )
                            )
                        )

                        product = (
                            self._merge_product_data(
                                product,
                                browser_product
                            )
                        )

                # =================================================
                # MERGE ONLY AVAILABLE VALUES
                # =================================================

                self._merge_candidate_data(
                    candidate,
                    product
                )

                # =================================================
                # CLEAN BRAND
                # =================================================

                if candidate.get("brand"):

                    candidate["brand"] = (
                        self._clean_brand(
                            candidate.get("brand")
                        )
                    )

                # =================================================
                # MODEL
                # =================================================

                if not candidate.get("model"):

                    model = (
                        self._extract_model_from_name(
                            candidate.get("name")
                        )
                    )

                    if model:

                        candidate["model"] = model

                # =================================================
                # CATEGORY
                # =================================================

                if not candidate.get("category"):

                    candidate["category"] = (
                        self._infer_category(
                            candidate.get("name")
                        )
                    )

                # =================================================
                # AMAZON URL
                # =================================================

                if marketplace == "Amazon":

                    candidate["product_url"] = (
                        self._clean_amazon_url(
                            candidate.get(
                                "product_url"
                            )
                        )
                    )

                elapsed = (
                    time.perf_counter()
                    - started
                )

                print(
                    f"{marketplace} detail completed "
                    f"in {elapsed:.2f}s"
                )

                return candidate

            except Exception as e:

                elapsed = (
                    time.perf_counter()
                    - started
                )

                print(
                    f"{marketplace} detail failed "
                    f"after {elapsed:.2f}s:",
                    e
                )

                return candidate

        worker_count = min(
            self.detail_workers,
            len(needs_detail)
        )

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:

            futures = [
                executor.submit(
                    fetch_one,
                    candidate
                )
                for candidate in needs_detail
            ]

            for future in as_completed(
                futures
            ):

                try:

                    result = future.result()

                    if result:

                        detailed_candidates.append(
                            result
                        )

                except Exception as e:

                    print(
                        "Parallel detail error:",
                        e
                    )

        # ====================================================
        # COMBINE SEARCH-READY + FULL DETAILS
        # ====================================================

        final_candidates = (
            ready_candidates
            + detailed_candidates
        )

        print(
            "\nCandidate processing complete:",
            len(final_candidates)
        )

        return final_candidates

    # ========================================================
    # CHECK WHETHER FULL DETAILS ARE REQUIRED
    # ========================================================

    def _needs_full_details(
        self,
        candidate
    ):

        # Search result already contains enough information.
        #
        # We need:
        #   price
        #   rating
        #   review count
        #   brand
        #   model
        #   category
        #
        # Seller can remain unavailable because marketplace
        # trust logic already handles seller information.

        marketplace = candidate.get("marketplace")

        # ------------------------------------------------
        # FLIPKART
        #
        # Keep the existing full-detail protection unchanged.
        # Flipkart search-card prices can contain MRP/offer/EMI
        # values, so the actual product page must be fetched.
        # ------------------------------------------------

        if marketplace == "Flipkart":
            return True

        # ------------------------------------------------
        # AMAZON FAST PATH
        #
        # Amazon search cards normally provide the actual
        # selling price and useful identity information.
        # Avoid an expensive product-page request when the
        # search card already contains enough data.
        #
        # If critical data is missing, the existing detail
        # fetch path will still be used.
        # ------------------------------------------------

        if marketplace == "Amazon":
            # Amazon search cards already provide the two values
            # required for the fast comparison path:
            #
            #   1. product name
            #   2. selling price
            #
            # Brand/model/category are derived later from the
            # search title by the existing normalization logic.
            #
            # The final product matcher remains responsible for
            # deciding whether the candidate is actually equivalent.
            required_amazon = [
                candidate.get("product_url"),
                candidate.get("name"),
                candidate.get("price"),
            ]

            missing_amazon = sum(
                1
                for value in required_amazon
                if value is None
            )

            return missing_amazon > 0

        required = [

            candidate.get("price"),
            candidate.get("rating"),
            candidate.get("review_count"),
            candidate.get("brand"),
            candidate.get("model"),
            candidate.get("category")

        ]

        missing = sum(
            1
            for value in required
            if value is None
        )

        return missing >= 2

    # ========================================================
    # MERGE PRODUCT DATA
    # ========================================================

    def _merge_candidate_data(
        self,
        candidate,
        product
    ):

        if not product:

            return

        fields = [

            "name",
            "brand",
            "model",
            "category",
            "price",
            "mrp",
            "currency",
            "rating",
            "review_count",
            "image_url",
            "availability",
            "seller"

        ]

        for field in fields:

            value = product.get(
                field
            )

            if value is not None:

                candidate[field] = value

    # ========================================================
    # AMAZON DETAILS CHECK
    # ========================================================

    def _amazon_details_missing(
        self,
        product
    ):

        if not product:

            return True

        important_fields = [

            product.get("brand"),
            product.get("price"),
            product.get("rating"),
            product.get("review_count")

        ]

        missing_count = sum(
            1
            for value in important_fields
            if value is None
        )

        return missing_count >= 2

    # ========================================================
    # AMAZON BROWSER DETAIL FETCH
    # ========================================================

    def _fetch_amazon_product_details(
        self,
        product_url,
        target_variant=None
    ):

        result = {}

        try:

            from playwright.sync_api import sync_playwright

        except ImportError:

            return result

        browser = None

        try:

            with sync_playwright() as p:

                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox"
                    ]
                )

                context = browser.new_context(

                    user_agent=(
                        "Mozilla/5.0 "
                        "(X11; Linux x86_64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/131.0 Safari/537.36"
                    ),

                    locale="en-IN",

                    viewport={
                        "width": 1366,
                        "height": 768
                    }
                )

                page = context.new_page()

                try:

                    page.goto(
                        product_url,
                        wait_until="commit",
                        timeout=self.detail_browser_timeout
                    )
                    try:
                        page.wait_for_selector(
                            "#productTitle, h1, .priceToPay, #corePrice_feature_div",
                            timeout=min(self.amazon_detail_wait, 2500)
                        )
                    except Exception:
                        page.wait_for_timeout(
                            self.amazon_detail_wait
                        )

                except Exception:
                    page.wait_for_timeout(
                        self.amazon_detail_wait
                    )

                # =================================================
                # AMAZON VARIANT RECOVERY
                #
                # Amazon search cards may open a product-family page
                # on the wrong variant. If the target variant exists
                # on that page, select it before reading title/price.
                # =================================================

                if target_variant:
                    try:
                        raw_variant = str(
                            target_variant
                        ).strip()

                        variant_parts = re.findall(
                            r"\b\d+\s*(?:GB|TB|MB|mAh|W)\b|"
                            r"\b(?:white|black|blue|red|green|pink|purple|yellow|"
                            r"grey|gray|silver|gold|orange)\b",
                            raw_variant,
                            flags=re.IGNORECASE
                        )

                        variant_text = " ".join(
                            dict.fromkeys(
                                part.strip()
                                for part in variant_parts
                                if part.strip()
                            )
                        )

                        if variant_text:
                            print(
                                "Amazon: attempting target variant selection:",
                                variant_text
                            )

                            selected = page.evaluate(
                                """
                                (target) => {
                                    const wanted = target
                                        .toLowerCase()
                                        .replace(/\\s+/g, ' ')
                                        .trim();

                                    const normalize = (value) =>
                                        String(value || '')
                                            .toLowerCase()
                                            .replace(/\\s+/g, ' ')
                                            .trim();

                                    const candidates = [
                                        ...document.querySelectorAll(
                                            '#twister_feature_div button, ' +
                                            '#twister_feature_div [role="button"], ' +
                                            '#twister_feature_div li, ' +
                                            '#twister_feature_div span, ' +
                                            '#twister_feature_div a, ' +
                                            '[id*="variation"] button, ' +
                                            '[id*="variation"] [role="button"]'
                                        )
                                    ];

                                    for (const el of candidates) {
                                        const text = normalize(
                                            el.innerText || el.textContent
                                        );

                                        if (!text || !text.includes(wanted))
                                            continue;

                                        try {
                                            el.click();
                                            return text;
                                        } catch (_) {}
                                    }

                                    return null;
                                }
                                """,
                                variant_text
                            )

                            if selected:
                                print(
                                    "Amazon: target variant selected:",
                                    selected
                                )

                                page.wait_for_timeout(1200)

                            else:
                                print(
                                    "Amazon: target variant control not found:",
                                    variant_text
                                )

                    except Exception as e:
                        print(
                            "Amazon: variant selection warning:",
                            e
                        )

                # =================================================
                # TITLE
                # =================================================

                title = None

                for selector in [
                    "#productTitle",
                    "h1"
                ]:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() > 0:

                            title = element.inner_text(
                                timeout=1200
                            ).strip()

                            if title:

                                break

                    except Exception:

                        continue

                # =================================================
                # PRICE
                # =================================================

                price = None

                price_selectors = [

                    ".priceToPay .a-price-whole",

                    ".priceToPay .a-offscreen",

                    "#corePrice_feature_div .apex-core-price-identifier .a-price:not(.a-text-price) .a-offscreen",

                    "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",

                    "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen",

                    "#priceblock_dealprice",

                    "#priceblock_ourprice",

                    "#priceblock_saleprice",

                    "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price):not(.basisPrice) .a-offscreen"

                ]

                for selector in price_selectors:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() == 0:

                            continue

                        text = element.inner_text(
                            timeout=1000
                        )

                        price = self._extract_price(
                            text
                        )

                        if price is not None:

                            break

                    except Exception:

                        continue

                # =================================================
                # RATING
                # =================================================

                rating = None

                for selector in [

                    "#acrPopover",

                    "span[data-hook='rating-out-of-text']",

                    "#averageCustomerReviews "
                    ".a-icon-alt"

                ]:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() == 0:

                            continue

                        text = (
                            element.get_attribute(
                                "title"
                            )
                        )

                        if not text:

                            text = element.inner_text(
                                timeout=1000
                            )

                        rating = self._extract_rating(
                            text
                        )

                        if rating is not None:

                            break

                    except Exception:

                        continue

                # =================================================
                # REVIEWS
                # =================================================

                review_count = None

                for selector in [

                    "#acrCustomerReviewText",

                    "span[data-hook='total-review-count']",

                    "#averageCustomerReviews "
                    "#acrCustomerReviewLink"

                ]:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() == 0:

                            continue

                        text = element.inner_text(
                            timeout=1000
                        )

                        review_count = (
                            self._extract_review_count(
                                text
                            )
                        )

                        if review_count is not None:

                            break

                    except Exception:

                        continue

                # =================================================
                # BRAND
                # =================================================

                brand = None

                for selector in [

                    "#bylineInfo",
                    "#brand",
                    "a#bylineInfo"

                ]:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() == 0:

                            continue

                        text = element.inner_text(
                            timeout=1000
                        ).strip()

                        brand = self._clean_brand(
                            text
                        )

                        if brand:

                            break

                    except Exception:

                        continue

                # =================================================
                # IMAGE
                # =================================================

                image_url = None

                for selector in [

                    "#landingImage",
                    "#imgBlkFront",
                    "#mainImage"

                ]:

                    try:

                        element = page.locator(
                            selector
                        ).first

                        if element.count() == 0:

                            continue

                        image_url = (
                            element.get_attribute(
                                "src"
                            )
                        )

                        if image_url:

                            break

                    except Exception:

                        continue

                context.close()
                browser.close()

                browser = None

                return {

                    "name": title,

                    "brand": brand,

                    "model":
                        self._extract_model_from_name(
                            title
                        ),

                    "category":
                        self._infer_category(
                            title
                        ),

                    "price": price,

                    "mrp": None,

                    "currency": "INR",

                    "rating": rating,

                    "review_count":
                        review_count,

                    "image_url":
                        image_url

                }

        except Exception as e:

            print(
                "Amazon browser detail fetch failed:",
                e
            )

            return {}

        finally:

            try:

                if browser:

                    browser.close()

            except Exception:

                pass

    # ========================================================
    # MERGE PRODUCT DATA
    # ========================================================

    def _merge_product_data(
        self,
        original,
        fallback
    ):

        merged = dict(
            original or {}
        )

        for key, value in (
            fallback or {}
        ).items():

            if value is not None:

                if not merged.get(key):

                    merged[key] = value

        return merged

    # ========================================================
    # CATEGORY INFERENCE
    # ========================================================

    def _infer_category(
        self,
        name
    ):

        if not name:

            return None

        text = str(
            name
        ).lower()

        if any(
            word in text
            for word in [
                "headphone",
                "headphones",
                "headset",
                "earphone",
                "earbuds",
                "neckband"
            ]
        ):

            return "headphone"

        if "power" in text and "bank" in text:
            return "powerbank"

        if any(
            word in text
            for word in [
                "laptop",
                "notebook"
            ]
        ):

            return "laptop"

        if any(
            word in text
            for word in [
                "iphone",
                "pixel",
                "smartphone",
                "mobile",
                "galaxy"
            ]
        ):

            return "mobile"

        if any(
            word in text
            for word in [
                "smartwatch",
                "watch"
            ]
        ):

            return "smartwatch"

        if any(
            word in text
            for word in [
                "television",
                "tv"
            ]
        ):

            return "television"

        return None

    # ========================================================
    # BRAND FROM NAME
    # ========================================================

    def _extract_brand_from_name(
        self,
        name
    ):

        if not name:

            return None

        text = str(
            name
        ).strip()

        known_brands = [

            "Google",
            "Portronics",
            "PTron",
            "Jabra",
            "Sony",
            "Samsung",
            "Apple",
            "Boat",
            "boAt",
            "JBL",
            "OnePlus",
            "Realme",
            "Noise",
            "Boult",
            "HP",
            "Dell",
            "Lenovo",
            "Asus",
            "Acer",
            "LG",
            "Oppo",
            "Vivo",
            "Xiaomi",
            "Redmi"

        ]

        lower_text = text.lower()

        for brand in known_brands:

            if re.search(r"\b" + re.escape(brand.lower()) + r"\b", lower_text):

                return brand

        return None

    # ========================================================
    # MODEL EXTRACTION
    # ========================================================

    def _extract_model_from_name(
        self,
        name
    ):

        if not name:
            return None

        text = str(name)

        # Flipkart search cards prepend UI text such as
        # "Add to Compare" to the actual product title.
        # This is interface text, not product identity.
        text = re.sub(
            r"^\s*add\s+to\s+compare\s*[:\-]?\s*",
            "",
            text,
            flags=re.IGNORECASE
        )

        # Normalize marketplace title separators such as "w/".
        # They introduce specifications, not the product model.
        text = re.sub(
            r"\bw\s*/\s*",
            " with ",
            text,
            flags=re.IGNORECASE
        )

        # Preserve decimal measurements such as 1.52 and 3.8 as
        # single tokens. Otherwise dimensions can be mistaken for
        # numeric product-model identifiers.
        words = re.findall(
            r"[A-Za-z0-9]+(?:\.[0-9]+)?(?:-[A-Za-z0-9]+)*",
            text
        )

        # Remove the known brand first so the brand itself never becomes
        # part of the model identity.
        brand = self._extract_brand_from_name(text)
        if brand:
            words = [
                word
                for word in words
                if word.lower() != brand.lower()
            ]

        # These are product/category words rather than model identity.
        descriptor_words = {
            "bluetooth", "wireless", "wired",
            "headphone", "headphones", "headset",
            "earphone", "earphones", "earbuds",
            "neckband", "speaker", "speakers",
            "power", "bank",
            "charger", "charging",
            "cable", "adapter",
            "mouse", "keyboard",
            "smartwatch", "watch",
            "mobile", "phone", "laptop",
            "tablet", "television", "tv",
            "with", "for", "and", "the",
            "new", "latest",
        }

        # Specification tokens are allowed after a real model token.
        specification_tokens = {
            "pro", "plus", "max", "mini", "ultra",
            "anc", "v2", "v3", "gen", "type-c",
            "usb-c", "5g", "4g", "3g",
            "hrs", "hour", "hours",
            "gb", "tb", "mb", "mah",
            "w", "watts", "mm", "cm",
            "hz", "khz", "inch", "in", "mp"
        }

        normalized_words = [
            word.strip("-")
            for word in words
            if word.strip("-")
        ]

        if not normalized_words:
            return None

        # ---------------------------------------------------------
        # CASE 1: Model contains a number.
        #
        # Examples:
        #   Rockerz 370
        #   Muffs M2
        #   Galaxy M14
        #   Tune 510BT
        #
        # The model is usually the meaningful word immediately before
        # the numeric/alphanumeric model token plus the token itself.
        # ---------------------------------------------------------

        # Marketplace titles frequently put the model before a
        # "with" specification section, for example:
        #   Lunar Vista with Large 1.52 Display
        #   Lunar Prime with W 3.68 cm AMOLED Display
        #
        # If such a separator exists, extract the model from the
        # portion before it so specification numbers cannot become
        # the model identity.
        with_index = next(
            (
                index
                for index, word in enumerate(normalized_words)
                if word.lower() == "with"
            ),
            None
        )

        if with_index is not None and with_index > 0:
            model_prefix = normalized_words[:with_index]

            # Remove leading/trailing descriptor words.
            model_prefix = [
                word
                for word in model_prefix
                if word.lower() not in descriptor_words
            ]

            if model_prefix:
                return " ".join(model_prefix[:3]).strip() or None

        numeric_index = None

        for index, word in enumerate(normalized_words):
            if re.search(r"\d", word):
                lower_word = word.lower()

                # Ignore standalone and attached specification values.
                # Examples:
                #   10000mAh
                #   70hrs
                #   20W
                #   5G
                #   2.5mm
                if (
                    lower_word in {
                        "5g", "4g", "3g",
                        "gb", "tb", "mb",
                        "mah", "w", "watts",
                        "mm", "cm", "hz", "khz",
                        "hrs", "hour", "hours"
                    }
                    or re.fullmatch(
                        r"\d+(?:\.\d+)?(?:mah|mAh|hrs?|hours?|gb|tb|mb|w|watts|mm|cm|hz|khz)",
                        lower_word,
                        re.IGNORECASE
                    )
                ):
                    continue

                numeric_index = index
                break

        if numeric_index is not None:
            numeric_word = normalized_words[numeric_index]

            # A numeric token that is only a specification is not a model.
            # Examples: 10000mAh, 20000mAh, 20W, 70hrs, 2.5mm.
            if re.fullmatch(
                r"\d+(?:\.\d+)?(?:mah|mAh|hrs?|hours?|gb|tb|mb|w|watts|mm|cm|hz|khz)",
                numeric_word,
                re.IGNORECASE
            ):
                numeric_index = None
            else:
                model_words = []

                # Include up to two meaningful words immediately before
                # the numeric model token.
                start = max(0, numeric_index - 2)

                for word in normalized_words[start:numeric_index]:
                    if word.lower() in descriptor_words:
                        continue
                    model_words.append(word)

                model_words.append(numeric_word)

                # Include meaningful variant/specification tokens after
                # the model, e.g. "Studio Evo 70hrs" or "Galaxy M14 5G".
                for word in normalized_words[numeric_index + 1:]:
                    lower_word = word.lower()

                    if lower_word in specification_tokens:
                        model_words.append(word)
                        if len(model_words) >= 5:
                            break
                        continue

                    break

                return " ".join(model_words).strip() or None

            return " ".join(model_words).strip() or None

        # ---------------------------------------------------------
        # CASE 2: Model has no number.
        #
        # Examples:
        #   PTron Studio Evo
        #   Sony WH-series style names where the useful identity is
        #   textual rather than numeric.
        #
        # Keep up to three meaningful words before product descriptors.
        # ---------------------------------------------------------

        model_words = []

        # Words that commonly introduce specifications or marketing
        # descriptions after a textual model name.
        model_stop_words = {
            "large", "small", "display", "displayed",
            "aod", "amoled", "lcd", "ips",
            "brightness", "sports", "mode", "monitoring",
            "monitor", "fitness", "smart", "men", "women",
            "active", "black", "white", "blue", "green",
            "calling", "functional", "crown",
            "battery", "playtime", "audio", "bass",
            "charging", "fast", "wireless",
        }

        for index, word in enumerate(normalized_words):
            lower_word = word.lower()

            # A slash-based "w/" / "with" phrase usually introduces
            # specifications, not part of the model identity.
            if lower_word in {"w", "with"}:
                if model_words:
                    break
                continue

            if lower_word in descriptor_words:
                if model_words:
                    break
                continue

            if lower_word in model_stop_words:
                if model_words:
                    break
                continue

            # Never treat attached numeric specifications such as
            # 10000mAh, 20000mAh, 20W or 70hrs as a product model.
            if re.fullmatch(
                r"\d+(?:\.\d+)?(?:mah|mAh|hrs?|hours?|gb|tb|mb|w|watts|mm|cm|hz|khz)",
                lower_word,
                re.IGNORECASE
            ):
                if model_words:
                    break
                continue

            if lower_word in specification_tokens:
                if model_words:
                    model_words.append(word)
                continue

            # Stop at dimension/display syntax after the model.
            if (
                model_words
                and (
                    re.search(r"\d", lower_word)
                    or lower_word.startswith(("1.", "2.", "3.", "4.", "5."))
                )
            ):
                break

            model_words.append(word)

            if len(model_words) >= 3:
                break

        return " ".join(model_words).strip() or None

    # ========================================================
    # PRICE EXTRACTION
    # ========================================================

    def _extract_price(
        self,
        text
    ):

        if not text:

            return None

        try:

            cleaned = (
                str(text)
                .replace(",", "")
                .replace("₹", "")
            )

            match = re.search(
                r"(\d+(?:\.\d{1,2})?)",
                cleaned
            )

            if match:

                value = float(
                    match.group(1)
                )

                # Avoid treating years etc. as prices.
                if value > 0:

                    return value

        except Exception:

            pass

        return None

    # ========================================================
    # RATING EXTRACTION
    # ========================================================

    def _extract_rating(
        self,
        text
    ):

        if not text:

            return None

        try:

            match = re.search(
                r"([0-5](?:\.\d+)?)\s*out\s*of\s*5",
                str(text),
                re.IGNORECASE
            )

            if match:

                return float(
                    match.group(1)
                )

            match = re.search(
                r"([0-5](?:\.\d+)?)",
                str(text)
            )

            if match:

                value = float(
                    match.group(1)
                )

                if 0 <= value <= 5:

                    return value

        except Exception:

            pass

        return None

    # ========================================================
    # REVIEW COUNT
    # ========================================================

    def _extract_review_count(
        self,
        text
    ):

        if not text:

            return None

        try:

            cleaned = str(
                text
            ).lower()

            match = re.search(
                r"([\d,]+(?:\.\d+)?)\s*(k|m)?",
                cleaned
            )

            if not match:

                return None

            number = float(
                match.group(1).replace(
                    ",",
                    ""
                )
            )

            suffix = match.group(2)

            if suffix == "k":

                number *= 1000

            elif suffix == "m":

                number *= 1000000

            return int(number)

        except Exception:

            return None

    # ========================================================
    # BRAND CLEANING
    # ========================================================

    def _clean_brand(
        self,
        text
    ):

        if not text:

            return None

        text = str(
            text
        ).strip()

        text = re.sub(
            r"^Visit the\s+",
            "",
            text,
            flags=re.IGNORECASE
        )

        text = re.sub(
            r"\s+Store$",
            "",
            text,
            flags=re.IGNORECASE
        )

        text = re.sub(
            r"^Brand:\s*",
            "",
            text,
            flags=re.IGNORECASE
        )

        return text.strip() or None

    # ========================================================
    # AMAZON URL CLEANING
    # ========================================================

    def _clean_amazon_url(
        self,
        url
    ):

        if not url:

            return url

        match = re.search(
            r"(https?://www\.amazon\.in)?"
            r"(/dp/[A-Z0-9]{10})",
            url,
            re.IGNORECASE
        )

        if match:

            return (
                "https://www.amazon.in"
                + match.group(2)
            )

        match = re.search(
            r"(https?://www\.amazon\.in)?"
            r"(/gp/product/[A-Z0-9]{10})",
            url,
            re.IGNORECASE
        )

        if match:

            return (
                "https://www.amazon.in"
                + match.group(2)
            )

        return (
            url
            .split("?")[0]
            .rstrip("/")
        )

    # ========================================================
    # REMOVE DUPLICATES
    # ========================================================

    def _remove_duplicate_candidates(
        self,
        candidates
    ):

        unique_candidates = []

        seen = set()

        for candidate in candidates:

            url = candidate.get(
                "product_url"
            )

            if not url:

                continue

            clean_url = (
                url
                .split("?")[0]
                .rstrip("/")
            )

            if clean_url in seen:

                continue

            seen.add(
                clean_url
            )

            candidate["product_url"] = (
                clean_url
            )

            unique_candidates.append(
                candidate
            )

        return unique_candidates

    # ========================================================
    # FLIPKART SEARCH
    # ========================================================

    def _flipkart_search(
        self,
        query
    ):

        return (
            "https://www.flipkart.com/search?"
            f"q={quote_plus(query)}"
        )

    # ========================================================
    # AMAZON SEARCH
    # ========================================================

    def _amazon_search(
        self,
        query
    ):

        return (
            "https://www.amazon.in/s?"
            f"k={quote_plus(query)}"
        )

    # ========================================================
    # SNAPDEAL SEARCH
    # ========================================================

    def _snapdeal_search(
        self,
        query
    ):

        return (
            "https://www.snapdeal.com/search?"
            f"keyword={quote_plus(query)}"
        )

    # ========================================================
    # CROMA SEARCH
    # ========================================================
    # TEMPORARILY DISABLED
    # ========================================================

    def _croma_search(
        self,
        query
    ):

        return (
            "https://www.croma.com/searchB?"
            f"text={quote_plus(query)}"
        )

    # ========================================================
    # RELIANCE DIGITAL SEARCH
    # ========================================================
    # TEMPORARILY DISABLED
    # ========================================================

    def _reliance_search(
        self,
        query
    ):

        return (
            "https://www.reliancedigital.in/search?"
            f"query={quote_plus(query)}"
        )

    # ========================================================
    # FLIPKART PARSER
    # ========================================================

    def _parse_flipkart(
        self,
        soup
    ):

        candidates = []

        seen_urls = set()

        for link in soup.select(
            "a[href]"
        ):

            href = link.get(
                "href"
            )

            text = link.get_text(
                " ",
                strip=True
            )

            if not href or not text:

                continue

            if "/p/" not in href:

                continue

            if text.startswith("₹"):

                continue

            if len(text) < 15:

                continue

            if href.startswith("/"):

                href = (
                    "https://www.flipkart.com"
                    + href
                )

            clean_url = (
                href
                .split("&q=")[0]
            )

            if clean_url in seen_urls:

                continue

            seen_urls.add(
                clean_url
            )

            # =================================================
            # TRY TO FIND PRODUCT CARD
            # =================================================

            card = (
                link.find_parent(
                    "div"
                )
            )

            card_text = ""

            if card:

                card_text = card.get_text(
                    " ",
                    strip=True
                )

            price = None
            rating = None
            review_count = None
            image_url = None

            # -------------------------------------------------
            # PRICE
            # -------------------------------------------------

            price_match = re.search(
                r"₹\s*([\d,]+(?:\.\d+)?)",
                card_text
            )

            if price_match:

                price = self._extract_price(
                    price_match.group(1)
                )

            # -------------------------------------------------
            # RATING
            # -------------------------------------------------

            rating_match = re.search(
                r"\b([0-5](?:\.\d+)?)\s*[★⭐]",
                card_text
            )

            if rating_match:

                rating = float(
                    rating_match.group(1)
                )

            # -------------------------------------------------
            # REVIEW COUNT
            # -------------------------------------------------

            review_match = re.search(
                r"\(?\s*([\d,]+)\s*(?:Ratings?|Reviews?)",
                card_text,
                re.IGNORECASE
            )

            if review_match:

                review_count = (
                    self._extract_review_count(
                        review_match.group(1)
                    )
                )

            # -------------------------------------------------
            # IMAGE
            # -------------------------------------------------

            if card:

                image = card.select_one(
                    "img"
                )

                if image:

                    image_url = (
                        image.get("src")
                        or
                        image.get("data-src")
                    )

            candidates.append({

                "marketplace":
                    "Flipkart",

                "name":
                    text[:500],

                "product_url":
                    clean_url,

                "price":
                    price,

                "rating":
                    rating,

                "review_count":
                    review_count,

                "image_url":
                    image_url

            })

            if len(candidates) >= self.search_result_limit:

                break

        return candidates

    # ========================================================
    # AMAZON PARSER
    # ========================================================

    def _extract_amazon_product_url(self, href, asin=None):
        """Unwrap direct, sponsored, and ASIN-only Amazon result links."""
        hrefs = []
        if href:
            hrefs.append(str(href))
            parsed = urlparse(str(href))
            for wrapped in parse_qs(parsed.query).get("url", []):
                hrefs.append(unquote(wrapped))

        for value in hrefs:
            match = re.search(
                r"/(?:dp|gp/product)/([A-Z0-9]{10})",
                value,
                re.IGNORECASE,
            )
            if match:
                return "https://www.amazon.in/dp/" + match.group(1).upper()

        if asin and re.fullmatch(r"[A-Z0-9]{10}", str(asin), re.I):
            return "https://www.amazon.in/dp/" + str(asin).upper()
        return None

    def _parse_amazon(
        self,
        soup
    ):

        candidates = []

        seen_urls = set()

        products = soup.select(
            "[data-component-type='s-search-result']"
        )

        if not products:

            products = soup.select(
                "div[data-asin]"
            )

        for product in products:

            title = product.select_one(
                "h2"
            )

            link = None

            if title:
                link = title.select_one("a")
            if not link:
                link = product.select_one("a[href]")

            asin = product.get("data-asin")
            href = link.get("href") if link else None
            clean_url = self._extract_amazon_product_url(href, asin)
            if not clean_url:
                for possible_link in product.select("a[href]"):
                    clean_url = self._extract_amazon_product_url(
                        possible_link.get("href"), asin
                    )
                    if clean_url:
                        link = possible_link
                        break
            if not clean_url:
                continue

            name = None

            if title:
                name = title.get_text(" ", strip=True)

            # Amazon often puts only the brand in h2 and the actual title in
            # another link in the same card. Prefer a meaningful card link.
            if not name or len(name) < 12 or name.lower() in {
                "boat", "goboult", "portronics", "sony", "noise"
            }:
                for possible_link in product.select("a[href]"):
                    possible_text = possible_link.get_text(" ", strip=True)
                    if (
                        len(possible_text) >= 20
                        and "sponsored" not in possible_text.lower()
                        and not re.search(r"\b(?:stars?|ratings?|reviews?)\b", possible_text, re.I)
                    ):
                        name = possible_text
                        break

            if not name:
                name = link.get_text(" ", strip=True)

            if clean_url in seen_urls:

                continue

            seen_urls.add(
                clean_url
            )

            # =================================================
            # SEARCH CARD DATA
            # =================================================

            price = None
            rating = None
            review_count = None
            image_url = None

            # -------------------------------------------------
            # PRICE
            # -------------------------------------------------

            price_element = product.select_one(
                ".a-price .a-offscreen"
            )

            if price_element:

                price = self._extract_price(
                    price_element.get_text(
                        " ",
                        strip=True
                    )
                )

            if price is None:

                price_element = product.select_one(
                    ".a-price-whole"
                )

                if price_element:

                    price = self._extract_price(
                        price_element.get_text(
                            " ",
                            strip=True
                        )
                    )

            # -------------------------------------------------
            # RATING
            # -------------------------------------------------

            rating_element = product.select_one(
                ".a-icon-alt"
            )

            if rating_element:

                rating = self._extract_rating(
                    rating_element.get_text(
                        " ",
                        strip=True
                    )
                )

            # -------------------------------------------------
            # REVIEWS
            # -------------------------------------------------

            review_element = product.select_one(
                "a[href*='#customerReviews']"
            )

            if review_element:

                review_count = (
                    self._extract_review_count(
                        review_element.get_text(
                            " ",
                            strip=True
                        )
                    )
                )

            # -------------------------------------------------
            # IMAGE
            # -------------------------------------------------

            image = product.select_one(
                "img.s-image"
            )

            if image:

                image_url = (
                    image.get("src")
                    or
                    image.get("data-src")
                )

            # -------------------------------------------------
            # BRAND
            # -------------------------------------------------

            brand = (
                self._extract_brand_from_name(
                    name
                )
            )

            # -------------------------------------------------
            # MODEL
            # -------------------------------------------------

            model = (
                self._extract_model_from_name(
                    name
                )
            )

            # -------------------------------------------------
            # CATEGORY
            # -------------------------------------------------

            category = (
                self._infer_category(
                    name
                )
            )

            candidates.append({

                "marketplace":
                    "Amazon",

                "name":
                    name[:500]
                    if name
                    else None,

                "product_url":
                    clean_url,

                "price":
                    price,

                "rating":
                    rating,

                "review_count":
                    review_count,

                "image_url":
                    image_url,

                "brand":
                    brand,

                "model":
                    model,

                "category":
                    category

            })

            if len(candidates) >= self.search_result_limit:

                break

        return candidates

    # ========================================================
    # CROMA PARSER
    # ========================================================
    # KEPT FOR FUTURE RE-ENABLEMENT
    # ========================================================

    def _parse_snapdeal(self, soup):
        """
        Parse Snapdeal search-result product cards.

        Snapdeal can expose multiple links for the same product
        (including Quick View, colour and size controls). We use
        the product URL but extract the actual product title from
        the surrounding card instead of using the Quick View text.
        """

        candidates = []
        seen = set()

        for link in soup.select('a[href*="/product/"]'):

            href = str(
                link.get("href") or ""
            ).strip()

            if not href:
                continue

            if href.startswith("//"):
                clean_url = "https:" + href
            elif href.startswith("/"):
                clean_url = (
                    "https://www.snapdeal.com" + href
                )
            elif (
                href.startswith("http://")
                or href.startswith("https://")
            ):
                clean_url = href
            else:
                continue

            clean_url = clean_url.split("#", 1)[0]

            if "snapdeal.com/product/" not in clean_url.lower():
                continue

            if clean_url in seen:
                continue

            # ------------------------------------------------
            # Find the actual product-card text.
            # ------------------------------------------------
            text = ""

            # First try the link itself.
            link_text = " ".join(
                link.stripped_strings
            ).strip()

            if (
                link_text
                and link_text.lower() not in {
                    "quick view",
                    "view",
                    "buy now",
                }
                and len(link_text) > 15
            ):
                text = link_text

            # Walk up the DOM looking for a meaningful card.
            parent = link

            for _ in range(4):

                parent = parent.parent

                if not parent:
                    break

                parent_text = " ".join(
                    parent.stripped_strings
                ).strip()

                if not parent_text:
                    continue

                # Remove obvious UI-only cards.
                if (
                    len(parent_text) >= 25
                    and "Quick View" not in parent_text
                    or (
                        len(parent_text) >= 25
                        and "Rs." in parent_text
                    )
                ):
                    text = parent_text
                    break

            # ------------------------------------------------
            # Extract a cleaner title from the card.
            # ------------------------------------------------
            if text:

                # Remove common pricing / offer suffixes.
                import re

                text = re.sub(
                    r"Rs\.\s*[\d,]+(?:\.\d+)?",
                    " ",
                    text,
                    flags=re.IGNORECASE
                )

                text = re.sub(
                    r"\b\d+%\s*Off\b",
                    " ",
                    text,
                    flags=re.IGNORECASE
                )

                text = re.sub(
                    r"\(\s*\d+\s*\)",
                    " ",
                    text
                )

                text = re.sub(
                    r"\bColor\s+Size\b.*$",
                    " ",
                    text,
                    flags=re.IGNORECASE
                )

                text = re.sub(
                    r"^\s*Quick\s*View\s*",
                    "",
                    text,
                    flags=re.IGNORECASE
                )

                text = re.sub(
                    r"\s+",
                    " ",
                    text
                ).strip()

            if not text or len(text) < 5:
                continue

            seen.add(clean_url)

            candidates.append({
                "marketplace": "Snapdeal",
                "name": text[:500],
                "product_url": clean_url
            })

            if len(candidates) >= (
                self.max_candidates_per_marketplace
            ):
                break

        return candidates
    def _parse_croma(
        self,
        soup
    ):

        candidates = []

        seen_urls = set()

        for link in soup.select(
            "a[href]"
        ):

            href = link.get(
                "href",
                ""
            ).strip()

            text = link.get_text(
                " ",
                strip=True
            )

            if not href:

                continue

            href_lower = href.lower()

            is_product = (
                "/p/" in href_lower
                or "/product/" in href_lower
                or "/products/" in href_lower
            )

            if not is_product:

                continue

            if href.startswith("/"):

                href = (
                    "https://www.croma.com"
                    + href
                )

            if not href.startswith("http"):

                continue

            clean_url = (
                href
                .split("?")[0]
                .rstrip("/")
            )

            excluded = [
                "/search",
                "/category",
                "/collections",
                "/offers",
                "/store",
                "/brand"
            ]

            if any(
                item in clean_url.lower()
                for item in excluded
            ):

                continue

            if clean_url in seen_urls:

                continue

            if (
                not text
                or len(text) < 10
            ):

                parent = link.find_parent()

                if parent:

                    text = parent.get_text(
                        " ",
                        strip=True
                    )

            if (
                not text
                or len(text) < 10
            ):

                text = link.get(
                    "aria-label",
                    ""
                ).strip()

            if (
                not text
                or len(text) < 10
            ):

                continue

            seen_urls.add(
                clean_url
            )

            candidates.append({

                "marketplace":
                    "Croma",

                "name":
                    text[:500],

                "product_url":
                    clean_url

            })

            if len(candidates) >= (
                self.max_candidates_per_marketplace
            ):

                break

        return candidates

    # ========================================================
    # RELIANCE DIGITAL PARSER
    # ========================================================
    # KEPT FOR FUTURE RE-ENABLEMENT
    # ========================================================

    def _parse_reliance(
        self,
        soup
    ):

        candidates = []

        seen_urls = set()

        # ====================================================
        # NORMAL LINKS
        # ====================================================

        for link in soup.select(
            "a[href]"
        ):

            href = link.get(
                "href",
                ""
            ).strip()

            text = link.get_text(
                " ",
                strip=True
            )

            if not href:

                continue

            href_lower = href.lower()

            is_product = (

                "/product/" in href_lower

                or "/products/" in href_lower

                or "/p/" in href_lower

                or "/buy/" in href_lower

                or "product" in href_lower

            )

            if not is_product:

                continue

            if href.startswith("/"):

                href = (
                    "https://www.reliancedigital.in"
                    + href
                )

            if not href.startswith("http"):

                continue

            clean_url = (
                href
                .split("?")[0]
                .rstrip("/")
            )

            excluded = [

                "/search",
                "/category",
                "/collections",
                "/offers",
                "/store",
                "/brand",
                "/blog",
                "/support",
                "/login",
                "/cart",
                "/help"

            ]

            if any(
                item in clean_url.lower()
                for item in excluded
            ):

                continue

            if clean_url in seen_urls:

                continue

            if (
                not text
                or len(text) < 10
            ):

                parent = link.find_parent()

                if parent:

                    text = parent.get_text(
                        " ",
                        strip=True
                    )

            if (
                not text
                or len(text) < 10
            ):

                text = link.get(
                    "aria-label",
                    ""
                ).strip()

            if (
                not text
                or len(text) < 10
            ):

                text = link.get(
                    "title",
                    ""
                ).strip()

            if (
                not text
                or len(text) < 10
            ):

                continue

            bad_text = {

                "login",
                "sign in",
                "add to cart",
                "view all",
                "shop now",
                "buy now",
                "see all",
                "compare"

            }

            if text.lower() in bad_text:

                continue

            seen_urls.add(
                clean_url
            )

            candidates.append({

                "marketplace":
                    "Reliance Digital",

                "name":
                    text[:500],

                "product_url":
                    clean_url

            })

            if len(candidates) >= (
                self.max_candidates_per_marketplace
            ):

                break

        # ====================================================
        # DATA ATTRIBUTE FALLBACK
        # ====================================================

        if len(candidates) < (
            self.max_candidates_per_marketplace
        ):

            elements = soup.select(
                "[data-product-url], "
                "[data-url], "
                "[data-href], "
                "[data-product-link]"
            )

            for element in elements:

                href = (

                    element.get(
                        "data-product-url"
                    )

                    or element.get(
                        "data-product-link"
                    )

                    or element.get(
                        "data-url"
                    )

                    or element.get(
                        "data-href"
                    )

                )

                if not href:

                    continue

                if href.startswith("/"):

                    href = (
                        "https://www.reliancedigital.in"
                        + href
                    )

                if not href.startswith("http"):

                    continue

                clean_url = (
                    href
                    .split("?")[0]
                    .rstrip("/")
                )

                if clean_url in seen_urls:

                    continue

                text = element.get_text(
                    " ",
                    strip=True
                )

                if (
                    not text
                    or len(text) < 10
                ):

                    text = (
                        element.get(
                            "aria-label",
                            ""
                        )
                        or
                        element.get(
                            "title",
                            ""
                        )
                    ).strip()

                if (
                    not text
                    or len(text) < 10
                ):

                    continue

                seen_urls.add(
                    clean_url
                )

                candidates.append({

                    "marketplace":
                        "Reliance Digital",

                    "name":
                        text[:500],

                    "product_url":
                        clean_url

                })

                if len(candidates) >= (
                    self.max_candidates_per_marketplace
                ):

                    break

        return candidates
