import time

try:
    from ..processors.canonical import CanonicalProductGenerator
    from ..discovery.product_discovery import ProductDiscovery
    from ..matching.product_matcher import ProductMatcher
    from ..comparison.price_comparator import PriceComparator
    from ..trust.trust_analyzer import TrustAnalyzer
    from ..recommendation.recommendation_engine import RecommendationEngine
except ImportError:  # supports running app.py directly from backend
    from processors.canonical import CanonicalProductGenerator
    from discovery.product_discovery import ProductDiscovery
    from matching.product_matcher import ProductMatcher
    from comparison.price_comparator import PriceComparator
    from trust.trust_analyzer import TrustAnalyzer
    from recommendation.recommendation_engine import RecommendationEngine


class ComparisonPipeline:

    def __init__(self):

        self.canonical_generator = (
            CanonicalProductGenerator()
        )

        self.discovery = (
            ProductDiscovery()
        )

        self.matcher = (
            ProductMatcher()
        )

        self.price_comparator = (
            PriceComparator()
        )

        self.trust_analyzer = (
            TrustAnalyzer()
        )

        self.recommendation_engine = (
            RecommendationEngine()
        )

    # ========================================================
    # DETECT SOURCE MARKETPLACE
    # ========================================================

    def _get_marketplace_from_url(self, url):

        if not url:
            return None

        url = str(url).lower()

        if "amazon." in url:
            return "Amazon"

        if "flipkart.com" in url:
            return "Flipkart"

        if "croma.com" in url:
            return "Croma"

        if "reliancedigital.in" in url:
            return "Reliance Digital"

        return None

    # ========================================================
    # PREPARE SOURCE PRODUCT
    # ========================================================

    def _prepare_source_product(
        self,
        product,
        canonical
    ):

        source_product = dict(
            product or {}
        )

        source_url = (
            source_product.get("product_url")
            or
            source_product.get("source_url")
            or
            canonical.get("source_url")
        )

        marketplace = (
            self._get_marketplace_from_url(
                source_url
            )
        )

        source_product["product_url"] = source_url
        source_product["source_url"] = source_url
        source_product["marketplace"] = marketplace
        source_product["is_source"] = True

        # ----------------------------------------------------
        # Use canonical information only when the fetched
        # source product does not have it.
        #
        # IMPORTANT:
        # Never overwrite source price.
        # ----------------------------------------------------

        if not source_product.get("name"):

            source_product["name"] = (
                canonical.get("product_name")
            )

        if not source_product.get("brand"):

            source_product["brand"] = (
                canonical.get("brand")
            )

        if not source_product.get("model"):

            source_product["model"] = (
                canonical.get("model")
            )

        if not source_product.get("category"):

            source_product["category"] = (
                canonical.get("category")
            )

        return source_product

    # ========================================================
    # REMOVE DISCOVERED LISTINGS FROM SOURCE MARKETPLACE
    # ========================================================

    def _protect_source_marketplace(
        self,
        candidates,
        source_product
    ):

        source_marketplace = (
            source_product.get("marketplace")
        )

        if not source_marketplace:

            return candidates

        protected_candidates = []

        for candidate in candidates:

            candidate_marketplace = (
                candidate.get("marketplace")
            )

            # ------------------------------------------------
            # IMPORTANT:
            #
            # If user entered Amazon URL:
            #
            #   Original Amazon ₹869
            #
            # and discovery finds:
            #
            #   Amazon ₹699
            #
            # Do NOT allow discovered Amazon listing
            # to replace the original Amazon listing.
            #
            # We will use the original listing instead.
            # ------------------------------------------------

            if (
                candidate_marketplace
                == source_marketplace
            ):

                continue

            protected_candidates.append(
                candidate
            )

        # ----------------------------------------------------
        # Add original source listing
        # ----------------------------------------------------

        protected_candidates.append(
            source_product
        )

        return protected_candidates

    # ========================================================
    # MAIN PIPELINE
    # ========================================================

    def run(self, product):

        pipeline_started = time.perf_counter()
        timings = {}

        print(
            "\n########################################"
        )

        print(
            "TRUSTCART COMPARISON PIPELINE"
        )

        print(
            "########################################"
        )

        # ====================================================
        # STEP 1: CANONICALIZATION
        # ====================================================

        print(
            "\n[STEP 1] Canonicalization"
        )

        step_started = time.perf_counter()
        canonical = (
            self.canonical_generator.generate(
                product
            )
        )
        timings["canonicalization_seconds"] = round(
            time.perf_counter() - step_started, 3
        )

        print(
            "Canonical product:",
            canonical.get("product_name")
        )

        print(
            "Search query:",
            canonical.get("search_query")
        )

        # ====================================================
        # PRESERVE ORIGINAL SOURCE PRODUCT
        # ====================================================

        source_product = (
            self._prepare_source_product(
                product,
                canonical
            )
        )

        print(
            "\nSOURCE PRODUCT"
        )

        print(
            "Marketplace:",
            source_product.get("marketplace")
        )

        print(
            "Price:",
            source_product.get("price")
        )

        print(
            "URL:",
            source_product.get("product_url")
        )

        # ====================================================
        # STEP 2: PRODUCT DISCOVERY
        # ====================================================

        print(
            "\n[STEP 2] Product Discovery"
        )

        step_started = time.perf_counter()
        discovery_result = (
            self.discovery.discover(
                canonical
            )
        )
        timings["discovery_seconds"] = round(
            time.perf_counter() - step_started, 3
        )

        candidates = (
            discovery_result.get(
                "candidates",
                []
            )
        )

        print(
            "Discovered candidates:",
            len(candidates)
        )

        # ====================================================
        # PROTECT ORIGINAL MARKETPLACE
        # ====================================================

        candidates = (
            self._protect_source_marketplace(
                candidates,
                source_product
            )
        )

        print(
            "Candidates after source protection:",
            len(candidates)
        )

        # ====================================================
        # STEP 3: PRODUCT MATCHING
        # ====================================================

        print(
            "\n[STEP 3] Product Matching"
        )

        print("\n===== CANDIDATES SENT TO MATCHER =====")
        for i, candidate in enumerate(candidates, 1):
            print(f"\nCANDIDATE {i}")
            print("marketplace:", candidate.get("marketplace"))
            print("brand:", candidate.get("brand"))
            print("model:", candidate.get("model"))
            print("price:", candidate.get("price"))
            print("name:", candidate.get("name"))
            print("url:", candidate.get("product_url"))

        step_started = time.perf_counter()
        matching_result = (
            self.matcher.match(
                canonical,
                candidates
            )
        )

        print("\n===== MATCHER ALL RESULTS =====")
        for i, result in enumerate(
            matching_result.get("all_results", []),
            1
        ):
            print(f"\nMATCH RESULT {i}")
            print("marketplace:", result.get("marketplace"))
            print("model:", result.get("model"))
            print("price:", result.get("price"))
            print("match_score:", result.get("match_score"))
            print("is_match:", result.get("is_match"))
        timings["matching_seconds"] = round(
            time.perf_counter() - step_started, 3
        )

        matched_products = (
            matching_result.get(
                "matches",
                []
            )
        )

        source_marketplace = source_product.get("marketplace")
        has_other_marketplace_match = any(
            candidate.get("marketplace")
            and candidate.get("marketplace") != source_marketplace
            for candidate in matched_products
        )

        print(
            "Matched products:",
            len(matched_products)
        )

        # ====================================================
        # STEP 4: PRICE COMPARISON
        # ====================================================

        print(
            "\n[STEP 4] Price Comparison"
        )

        step_started = time.perf_counter()
        price_result = (
            self.price_comparator.compare(
                matched_products
            )
        )
        timings["price_comparison_seconds"] = round(
            time.perf_counter() - step_started, 3
        )

        # ====================================================
        # STEP 5: TRUST ANALYSIS
        # ====================================================

        print(
            "\n[STEP 5] Trust Analysis"
        )

        step_started = time.perf_counter()
        trust_result = (
            self.trust_analyzer.analyze(
                price_result.get(
                    "products",
                    []
                )
            )
        )
        timings["trust_seconds"] = round(
            time.perf_counter() - step_started, 3
        )

        # ====================================================
        # STEP 6: RECOMMENDATION
        # ====================================================

        print(
            "\n[STEP 6] Recommendation"
        )

        step_started = time.perf_counter()
        recommendation_result = (
            self.recommendation_engine.recommend(
                price_result,
                trust_result
            )
        )
        timings["recommendation_seconds"] = round(
            time.perf_counter() - step_started, 3
        )
        timings["total_seconds"] = round(
            time.perf_counter() - pipeline_started, 3
        )

        comparison_complete = bool(
            has_other_marketplace_match
            and price_result.get("product_count", 0) >= 2
        )

        # ====================================================
        # COMPLETE
        # ====================================================

        print(
            "\n########################################"
        )

        print(
            "PIPELINE COMPLETE"
        )

        print(
            "########################################"
        )

        return {

            "success": comparison_complete,
            "comparison_complete": comparison_complete,

            "canonical":
                canonical,

            "source_product":
                source_product,

            "discovery":
                discovery_result,

            "matching":
                matching_result,

            "price_comparison":
                price_result,

            "trust_analysis":
                trust_result,

            "recommendation":
                recommendation_result
            ,
            "timings": timings
        }
