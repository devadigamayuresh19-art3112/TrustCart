import json
import re
import time
import requests
from urllib.parse import urlparse, urlunparse, parse_qsl

from bs4 import BeautifulSoup

from .base import BaseProductFetcher


class GenericProductFetcher(BaseProductFetcher):

    def __init__(self):

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 "
                "(X11; Linux x86_64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/131.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,"
                "image/webp,*/*;q=0.8"
            ),
            "Referer": "https://www.google.com/"
        }

        # Performance settings
        self.request_timeout = 8
        # This is a wall-clock budget for the complete Playwright fallback,
        # not just page.goto().  A blocked browser must not hold an API
        # request indefinitely.
        self.browser_timeout = 15000
        self.browser_launch_timeout = 5000
        self.browser_wait = 1200


    # ========================================================
    # MAIN FETCH METHOD
    # ========================================================

    def _canonicalize_url(self, url):
        if not url:
            return url

        parsed = urlparse(str(url).strip())
        if not parsed.scheme or not parsed.netloc:
            return str(url).strip()

        host = parsed.netloc.lower()
        if not (self._is_flipkart_url(str(url)) or self._is_amazon_url(str(url))):
            return str(url).strip().split("#", 1)[0]

        clean_segments = []
        for segment in parsed.path.split("/"):
            if not segment:
                continue
            if segment.lower().startswith((
                "ref=",
                "keywords=",
                "tag=",
                "marketplace=",
                "utm_",
                "m=",
                "pd_rd_",
                "qid=",
            )):
                continue
            clean_segments.append(segment)

        normalized = parsed._replace(
            path="/" + "/".join(clean_segments) if clean_segments else "/",
            query="",
            fragment=""
        )

        return urlunparse(normalized)

    def fetch(self, url):

        normalized_url = self._canonicalize_url(url)

        # ----------------------------------------------------
        # FIRST TRY: NORMAL REQUEST
        # ----------------------------------------------------

        try:

            response = requests.get(
                normalized_url,
                headers=self.headers,
                timeout=self.request_timeout,
                allow_redirects=True
            )

            response.raise_for_status()

            print(
                "Product page fetched using requests."
            )

            # Short Flipkart links (fkrt.it/dl.flipkart.com) redirect to the
            # product page.  Use the final URL so marketplace-specific
            # extraction is selected after that redirect.
            product = self._parse_html(
                response.text,
                self._canonicalize_url(response.url or normalized_url)
            )

            # A 200 response from Flipkart/Amazon can still be a
            # challenge, shell, or incomplete client-side page.
            # Never return a half-filled product just because HTTP
            # succeeded. Fall back to the real browser when the
            # extracted identity/price is insufficient.
            if self._needs_browser_fallback(product, url):

                print(
                    "HTTP page is incomplete; trying browser-based fetching..."
                )

                try:
                    browser_product = self._fetch_with_browser(
                        self._canonicalize_url(response.url or normalized_url)
                    )
                    if self._is_amazon_url(url):
                        if self._is_usable_product(browser_product):
                            return browser_product

                        if self._is_usable_amazon_identity(
                            browser_product,
                            url
                        ):
                            print(
                                "Amazon browser identity is valid; "
                                "preserving it despite missing price."
                            )
                            return browser_product
                    else:
                        if self._is_usable_product(browser_product):
                            return browser_product
                except Exception as browser_error:
                    print(
                        "Browser fallback after incomplete HTTP page failed:",
                        browser_error
                    )

            return product

        except requests.exceptions.RequestException as e:

            print(
                "Normal request failed:",
                e
            )

            # ------------------------------------------------
            # SECOND TRY: PLAYWRIGHT
            # ------------------------------------------------

            print(
                "Trying browser-based fetching..."
            )

            return self._fetch_with_browser(
                normalized_url
            )


    # ========================================================
    # PLAYWRIGHT FETCHER
    # ========================================================

    def _fetch_with_browser(self, url):

        try:

            from playwright.sync_api import (
                sync_playwright,
                TimeoutError as PlaywrightTimeoutError
            )

            deadline = time.monotonic() + (self.browser_timeout / 1000)

            def remaining_timeout():
                remaining = int((deadline - time.monotonic()) * 1000)
                if remaining <= 0:
                    raise PlaywrightTimeoutError(
                        "Browser fallback exceeded its time limit."
                    )
                return remaining

            with sync_playwright() as p:

                browser = p.chromium.launch(
                    headless=True,
                    timeout=min(
                        self.browser_launch_timeout,
                        remaining_timeout()
                    ),
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

                # Apply the same remaining budget to every Playwright call;
                # goto alone is not enough when a site blocks before it
                # commits or when the DOM never becomes ready.
                context.set_default_timeout(
                    remaining_timeout()
                )
                context.set_default_navigation_timeout(
                    remaining_timeout()
                )

                page = context.new_page()

                try:

                    page.goto(
                        url,
                        wait_until="commit",
                        timeout=remaining_timeout()
                    )

                    try:
                        page.wait_for_selector(
                            "h1, #productTitle, div.Nx9bqj, div._30jeq3, .priceToPay",
                            timeout=min(
                                self.browser_wait,
                                3000,
                                remaining_timeout()
                            )
                        )
                    except Exception:
                        page.wait_for_timeout(
                            self.browser_wait
                        )

                    # page.content() also uses the context default timeout.
                    remaining_timeout()
                    html = page.content()

                    print(
                        "Product page fetched using Playwright."
                    )

                    return self._parse_html(
                        html,
                        page.url or url
                    )

                except PlaywrightTimeoutError:

                    print(
                        "Playwright page load timed out."
                    )

                    raise

                finally:

                    context.close()
                    browser.close()

        except Exception as e:

            print(
                "Browser fetch failed:",
                e
            )

            raise


    # ========================================================
    # HTML PARSER
    # ========================================================

    def _parse_html(self, html, url):

        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        product = self._empty_product(
            url
        )

        # ----------------------------------------------------
        # JSON-LD
        # ----------------------------------------------------

        json_ld_products = (
            self._extract_json_ld(
                soup
            )
        )

        for data in json_ld_products:

            self._apply_json_ld(
                product,
                data
            )

        # ----------------------------------------------------
        # META / OPENGRAPH
        # ----------------------------------------------------

        self._apply_meta_data(
            product,
            soup
        )

        # ----------------------------------------------------
        # TITLE FALLBACK
        # ----------------------------------------------------

        if not product["name"]:

            title = soup.find(
                "title"
            )

            if title:

                product["name"] = (
                    title.get_text(
                        " ",
                        strip=True
                    )
                )

        # ----------------------------------------------------
        # BASIC HTML FALLBACKS
        # ----------------------------------------------------

        if not product["name"]:

            selectors = [
                "h1",
                "[class*='title']",
                "[class*='Title']",
                "[id*='title']",
                "[id*='Title']"
            ]

            for selector in selectors:

                element = soup.select_one(
                    selector
                )

                if element:

                    text = element.get_text(
                        " ",
                        strip=True
                    )

                    if text:

                        product["name"] = text
                        break

        # ----------------------------------------------------
        # GENERIC / AMAZON HTML FALLBACK
        # ----------------------------------------------------

        # Product name
        # Amazon can expose #productTitle twice:
        # once as the visible title and once as a hidden input.
        # Always prefer the visible product-title element.
        if self._is_amazon_url(url):

            amazon_title = soup.select_one(
                "#productTitle:not(input), "
                "h1#title, "
                "h1.a-size-large.product-title-word-break"
            )

            if amazon_title:

                amazon_name = amazon_title.get_text(
                    " ",
                    strip=True
                )

                if amazon_name:
                    product["name"] = self._clean(
                        amazon_name
                    )

        if not product["name"]:

            element = soup.select_one(
                "#productTitle, "
                "h1.a-size-large, "
                "h1.a-size-medium, "
                "[data-feature-name='title'] h1"
            )

            if element:

                product["name"] = self._clean(
                    element.get_text(
                        " ",
                        strip=True
                    )
                )

        # Amazon document titles can contain marketplace suffixes.
        if self._is_amazon_url(url) and product["name"]:

            product["name"] = re.sub(
                r"\s*:\s*Amazon(?:\.in|\.com(?:\.au|\.mx)?)?\s*:.*$",
                "",
                str(product["name"]),
                flags=re.I
            ).strip()

        # Brand
        if not product["brand"]:

            element = soup.select_one(
                "#bylineInfo, "
                "a#brand"
            )

            if element:

                brand = element.get_text(
                    " ",
                    strip=True
                )

                brand = re.sub(
                    r"^(Visit the|Brand:?)\s*",
                    "",
                    brand,
                    flags=re.I
                )

                brand = re.sub(
                    r"\s+Store$",
                    "",
                    brand,
                    flags=re.I
                )

                if brand:

                    product["brand"] = self._clean(
                        brand
                    )

        # Main image
        if not product["image_url"]:

            element = soup.select_one(
                "#landingImage, "
                "#imgBlkFront, "
                "#main-image, "
                "[data-old-hires]"
            )

            if element:

                image = (
                    element.get("data-old-hires")
                    or element.get("src")
                )

                if image:

                    product["image_url"] = (
                        self._clean(image)
                    )

        # Price
        # Prefer the visible current selling price over JSON-LD/meta
        # because structured data may describe a different offer.
        if self._is_amazon_url(url):

            # Current Amazon pages may omit the old #corePrice / .priceToPay
            # containers entirely. The visible product price is still exposed
            # as an .a-price element. Prefer one that belongs to the main
            # product section and reject recommendation/carousel containers.
            amazon_price = self._extract_amazon_price(soup)

            if amazon_price is not None and amazon_price > 0:
                product["price"] = amazon_price

        else:

            price_element = soup.select_one(
                ".priceToPay .a-offscreen, "
                "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen, "
                "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen, "
                "#priceblock_ourprice, "
                "#priceblock_dealprice, "
                "#priceblock_saleprice, "
                "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen, "
                ".a-price:not(.a-text-price) .a-offscreen"
            )

            if price_element:

                price_text = price_element.get_text(
                    " ",
                    strip=True
                )

                price = self._number(
                    price_text
                )

                if price is not None:
                    product["price"] = price

        # Rating
        if product["rating"] is None:

            rating_element = soup.select_one(
                "#acrPopover, "
                "[data-hook='rating-out-of-text'], "
                ".reviewCountTextLinkedHistogram"
            )

            if rating_element:

                rating_text = (
                    rating_element.get("title")
                    or rating_element.get_text(
                        " ",
                        strip=True
                    )
                )

                match = re.search(
                    r"([0-5](?:\.[0-9])?)",
                    rating_text
                )

                if match:

                    product["rating"] = (
                        self._number(
                            match.group(1)
                        )
                    )

        # Review count
        if product["review_count"] is None:

            review_element = soup.select_one(
                "#acrCustomerReviewText, "
                "[data-hook='total-review-count']"
            )

            if review_element:

                review_text = review_element.get_text(
                    " ",
                    strip=True
                )

                product["review_count"] = (
                    self._integer(
                        review_text
                    )
                )

        # Availability
        if not product["availability"]:

            availability_element = soup.select_one(
                "#availability span, "
                "#availability"
            )

            if availability_element:

                product["availability"] = (
                    self._clean(
                        availability_element.get_text(
                            " ",
                            strip=True
                        )
                    )
                )

        # Seller
        if not product["seller"]:

            seller_element = soup.select_one(
                "#sellerProfileTriggerId, "
                "#merchantInfo, "
                "#sellerProfileTrigger"
            )

            if seller_element:

                product["seller"] = (
                    self._clean(
                        seller_element.get_text(
                            " ",
                            strip=True
                        )
                    )
                )

        # ----------------------------------------------------
        # FLIPKART-SPECIFIC EXTRACTION
        # ----------------------------------------------------
        # Flipkart changes CSS class names frequently and may put
        # the live price in rendered DOM while JSON-LD contains a
        # stale/alternate offer price. Prefer the visible selling
        # price when it can be identified safely.
        if self._is_flipkart_url(url):
            self._apply_flipkart_data(product, soup, url)

        if self._is_amazon_url(url):
            self._apply_amazon_data(product, soup, url)

        return product


    # ========================================================
    # FETCH QUALITY / BROWSER FALLBACK
    # ========================================================

    def _is_usable_product(self, product):

        if not isinstance(product, dict):
            return False

        name = product.get("name")
        price = product.get("price")

        return bool(name and price and float(price) > 0)

    def _is_usable_amazon_identity(self, product, url=None):
        """Accept a valid Amazon product identity even when price is missing."""
        if not isinstance(product, dict):
            return False

        if url is not None and not self._is_amazon_url(url):
            return False

        name = str(product.get("name") or "").strip()
        if not name:
            return False

        lowered = name.lower()

        blocked_markers = (
            "access denied",
            "page not found",
            "something went wrong",
            "captcha",
            "robot check",
            "just a moment",
            "buy products online at best price in india",
        )

        if any(marker in lowered for marker in blocked_markers):
            return False

        return True

    def _needs_browser_fallback(self, product, url):

        host = str(url).lower()

        if not (self._is_flipkart_url(url) or "amazon." in host):
            return not self._is_usable_product(product)

        if not product.get("name") or not product.get("price"):
            return True

        # Challenge/shell pages often expose generic titles rather
        # than a real product identity.
        name = str(product.get("name") or "").lower()
        blocked_markers = [
            "access denied",
            "page not found",
            "something went wrong",
            "captcha",
            "robot check",
            "just a moment",
            "buy products online at best price in india"
        ]

        return any(marker in name for marker in blocked_markers)

    # ========================================================
    # FLIPKART DATA EXTRACTION
    # ========================================================

    def _is_flipkart_url(self, url):
        """Recognize normal, mobile/deep-link, and Flipkart short URLs."""
        host_match = re.match(
            r"^https?://(?:[^@/]+@)?([^/:?#]+)", str(url or ""), re.I
        )
        host = host_match.group(1).lower() if host_match else ""
        return (
            host == "flipkart.com"
            or host.endswith(".flipkart.com")
            or host == "fkrt.it"
            or host.endswith(".fkrt.it")
        )

    def _looks_like_placeholder_identity(self, value):
        if value is None:
            return False
        lowered = str(value).strip().lower()
        if not lowered:
            return False
        compact = re.sub(r"[^a-z0-9]", "", lowered)
        return (
            "nobody" in compact
            or compact in {"unknown", "generic", "brand", "notavailable", "na"}
        )

    def _extract_title_brand(self, title):
        if not title:
            return None

        words = re.findall(r"[A-Za-z0-9.-]+", str(title))
        stop_words = {
            "buy", "online", "india", "flipkart", "com", "price",
            "bluetooth", "wireless", "headphones", "headphone",
            "earphones", "earbuds", "neckband", "vibration", "alert",
            "playtime", "waterproof", "black", "white", "blue",
            "supports", "with", "for", "and", "in", "of"
        }

        for word in words:
            clean_word = re.sub(r"[^A-Za-z]", "", word)
            if not clean_word:
                continue
            lower_word = clean_word.lower()
            if len(clean_word) <= 2 or lower_word in stop_words:
                continue
            if re.search(r"\d", word):
                continue
            if word.isupper():
                return word
            return clean_word.title()

        return None

    def _restore_title_identity(self, product, soup):
        title = None
        title_match = soup.find("title")
        if title_match:
            title = title_match.get_text(" ", strip=True)

        if not title:
            return

        if self._looks_like_placeholder_identity(product.get("name")):
            product["name"] = self._clean(title)

        if self._looks_like_placeholder_identity(product.get("brand")):
            title_brand = self._extract_title_brand(title)
            if title_brand:
                product["brand"] = title_brand
            else:
                product["brand"] = None

        if self._looks_like_placeholder_identity(product.get("model")):
            model = self._extract_model_from_name(product["name"])
            if model:
                product["model"] = model
            else:
                product["model"] = None

    def _apply_flipkart_data(self, product, soup, url=None):

        # Current/legacy selectors are deliberately combined.
        # We do not rely on one generated class name.
        price_selectors = [
            "div.CxhGGd",
            "div._16J0da",
            "div.Nx9bqj",
            "div._30jeq3",
            "div[class*='CxhGGd']",
            "div[class*='_16J0da']",
            "div[class*='Nx9bqj']",
            "div[class*='_30jeq3']",
            "[data-testid*='price' i]",
            "[class*='price']",
            "[class*='Price']"
        ]

        visible_price = self._extract_flipkart_visible_price(
            soup, price_selectors
        )

        # Some current product pages hydrate the price from a JSON state
        # script and do not expose a stable price class in the initial HTML.
        # This is deliberately a fallback: a visible selling price wins.
        if visible_price is None:
            visible_price = self._extract_flipkart_embedded_price(soup)

        if visible_price is not None:
            product["price"] = visible_price

        # MRP is useful for the UI but is never used as the selling
        # price. Prefer struck/old-price elements and explicit MRP.
        mrp_selectors = [
            "div.yRaY8j",
            "div._3I9_wc",
            "div[class*='mrp']",
            "div[class*='MRP']",
            "div[class*='strike']",
            "div[class*='Strike']"
        ]

        mrp = self._extract_flipkart_mrp(soup, mrp_selectors)
        if mrp is not None:
            product["mrp"] = mrp

        # Flipkart title/brand fallbacks.
        if not product.get("name"):
            title = soup.select_one(
                "span.B_NuCI, h1, h1[class*='title'], h1[class*='Title']"
            )
            if title:
                product["name"] = self._clean(
                    title.get_text(" ", strip=True)
                )

        self._restore_title_identity(product, soup)

        if not product.get("brand") and product.get("name"):
            product["brand"] = self._extract_brand_from_name(
                product.get("name")
            ) or self._extract_title_brand(product.get("name"))

        if not product.get("model") and product.get("name"):
            product["model"] = self._extract_model_from_name(
                product.get("name")
            )

        if not product.get("category") and product.get("name"):
            product["category"] = self._infer_category_from_name(
                product.get("name")
            )

        # Flipkart's current JSON-LD/title for some legacy listings drops a
        # distinctive family token (e.g. ``Rockerz``) even though it remains
        # in the canonical URL slug and image identity.  Restore that token
        # only when the slug has an alphanumeric model number already present
        # in the parsed title; this avoids inventing product names from URLs.
        if url and product.get("name"):
            slug = urlparse(str(url)).path.lower()
            slug_words = re.findall(r"[a-z0-9]+", slug)
            title = str(product["name"])
            title_model = re.search(r"\b\d+[a-z]*\b", title.lower())
            if title_model:
                number = title_model.group(0)
                try:
                    index = slug_words.index(number)
                except ValueError:
                    index = -1
                if index > 0:
                    family = slug_words[index - 1]
                    ignored = {"boat", "flipkart", "bluetooth", "headset", "headphones"}
                    if family not in ignored and family not in title.lower().split():
                        family = family.title()
                        product["name"] = re.sub(
                            r"\b" + re.escape(number) + r"\b",
                            family + " " + number,
                            title,
                            count=1,
                            flags=re.IGNORECASE,
                        )
                        if product.get("model") and product["model"] == number:
                            product["model"] = family + " " + number

    def _extract_flipkart_discount_price(self, text, classes="", attributes=""):
        if not text:
            return None

        values = [
            self._number(match.group(1))
            for match in re.finditer(r"₹\s*([\d,]+(?:\.\d{1,2})?)", text)
        ]
        values = [value for value in values if value is not None and value > 0]
        if len(values) < 2:
            return None

        context = " ".join([str(text), str(classes), str(attributes)]).lower()
        if not any(token in context for token in [
            "% off", "off", "buy at", "best value for you", "save"
        ]):
            return None
        if any(token in context for token in [
            "emi", "per month", "bank offers", "coupon", "mrp", "maximum retail"
        ]):
            return None

        # In Flipkart's discount blocks the original price and the current
        # sell price are both present. The product's current selling price is the
        # lower amount within the same product-specific block, not the MRP or a
        # bank-offer badge.
        return min(values)

    def _extract_flipkart_visible_price(self, soup, selectors):

        candidates = []
        seen = set()

        for selector in selectors:
            try:
                elements = soup.select(selector)
            except Exception:
                continue

            for element in elements:
                text = element.get_text(" ", strip=True)
                if not text or id(element) in seen:
                    continue
                seen.add(id(element))

                # Exclude obvious MRP/EMI/discount labels. Include nearby
                # attributes because Flipkart often uses data-testid/labels
                # instead of meaningful class names.
                classes = " ".join(element.get("class") or []).lower()
                attributes = " ".join(
                    str(value) for value in element.attrs.values()
                ).lower()
                context = " ".join([text.lower(), classes, attributes])

                discount_price = self._extract_flipkart_discount_price(
                    text, classes, attributes
                )
                if discount_price is not None:
                    candidates.append((90, discount_price))
                    continue
                if any(token in context for token in [
                    "emi", "per month", "mrp", "maximum retail",
                    "discount", "% off", "you save", "bank offers", "coupon"
                ]):
                    continue

                match = re.search(
                    r"₹\s*([\d,]+(?:\.\d{1,2})?)",
                    text
                )
                if not match:
                    continue

                value = self._number(match.group(1))
                if value is None or value <= 0:
                    continue

                # A struck element is normally MRP, not selling price.
                style = (element.get("style") or "").lower()
                if "line-through" in style or "strike" in classes or "mrp" in classes:
                    continue

                # Strong score for explicit headline and price classes; weak score for
                # generic price-like elements.
                score = 0
                if any(token in classes for token in ["cxhggd", "_16j0da"]):
                    score += 15
                if any(token in classes for token in ["nx9bqj", "30jeq3"]):
                    score += 10
                if "price" in classes:
                    score += 4
                if "sale" in classes or "selling" in classes:
                    score += 3

                candidates.append((score, value))

        if not candidates:
            return None

        # Prefer the product-specific sold-price block, then the strongest price
        # signal. We intentionally avoid simply picking the maximum or minimum of
        # all visible rupee values because MRP/old prices and bank-offer badges are
        # often larger or smaller than the actual current selling price.
        candidates.sort(key=lambda item: (-item[0], -item[1]))
        return candidates[0][1]

    def _extract_flipkart_embedded_price(self, soup):
        """Get a selling price from Flipkart's inline JSON/state scripts.

        Flipkart has used both normal JSON and JSON serialized inside a
        JavaScript string.  Searching labelled price fields keeps this
        fallback narrow and avoids treating an unlabelled MRP as an offer.
        """
        candidates = []
        field_pattern = re.compile(
            r'["\\\'](?:sellingPrice|salePrice|finalPrice|offerPrice|'
            r'discountedPrice|currentPrice|flipkartSellingPrice)["\\\']'
            r'\s*[:=]\s*(?:["\\\'])?'
            r'(?:\\u20b9|₹|Rs\.?\s*)?\s*'
            r'([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
            re.I,
        )

        for script in soup.find_all("script"):
            raw = script.string or script.get_text() or ""
            if not raw:
                continue
            # Decode the common escaped-Rupee form without attempting to
            # execute or broadly unescape arbitrary JavaScript.
            text = raw.replace("\\\\u20b9", "₹").replace("\\u20b9", "₹")
            for match in field_pattern.finditer(text):
                value = self._number(match.group(1))
                if value is not None and value > 0:
                    candidates.append(value)

        return max(candidates) if candidates else None

    def _extract_flipkart_price(self, soup):
        price_selectors = [
            "div.Nx9bqj.CxhGGd",
            "div._30jeq3._16J0da",
            "div.CxhGGd",
            "div._16J0da",
            "div.Nx9bqj",
            "div._30jeq3",
            "div[class*='CxhGGd']",
            "div[class*='_16J0da']",
            "div[class*='Nx9bqj']",
            "div[class*='_30jeq3']",
            "[data-testid*='price' i]",
            "[class*='price']",
            "[class*='Price']"
        ]
        return self._extract_flipkart_visible_price(soup, price_selectors)

    def _extract_flipkart_mrp(self, soup, selectors):

        for selector in selectors:
            try:
                elements = soup.select(selector)
            except Exception:
                continue

            for element in elements:
                text = element.get_text(" ", strip=True)
                match = re.search(
                    r"₹\s*([\d,]+(?:\.\d{1,2})?)",
                    text
                )
                if match:
                    value = self._number(match.group(1))
                    if value and value > 0:
                        return value

        return None

    # ========================================================
    # AMAZON DATA EXTRACTION
    # ========================================================

    def _is_amazon_url(self, url):
        """Recognize Amazon domains."""
        host_match = re.match(
            r"^https?://(?:[^@/]+@)?([^/:?#]+)", str(url or ""), re.I
        )
        host = host_match.group(1).lower() if host_match else ""
        return "amazon." in host or host.endswith("amazon")

    def _apply_amazon_data(self, product, soup, url=None):
        """Extract authoritative Amazon selling price and metadata, ignoring MRP and recommendations."""
        selling_price = self._extract_amazon_price(soup)
        if selling_price is not None and selling_price > 0:
            product["price"] = selling_price

        mrp = self._extract_amazon_mrp(soup)
        if mrp is not None and mrp > 0:
            product["mrp"] = mrp

    def _is_amazon_unrelated_or_mrp_price(self, element):
        """Reject strike-through, basis price, EMI, savings, or recommendation carousel elements."""
        unrelated_indicators = (
            "sims", "p13n", "fbt", "dp-ads", "rhf", "recommendation",
            "carousel", "similarities", "basisprice", "a-text-price",
            "strike", "savings", "discount", "emi"
        )
        curr = element
        while curr and curr.name not in ("body", "html", "[document]"):
            classes = " ".join(curr.get("class", [])).lower()
            elem_id = str(curr.get("id", "")).lower()
            feature = str(curr.get("data-feature-name", "")).lower()
            strike = str(curr.get("data-a-strike", "")).lower()

            if strike == "true":
                return True
            for ind in unrelated_indicators:
                if ind in classes or ind in elem_id or ind in feature:
                    return True
            curr = curr.parent
        return False

    def _parse_amazon_price_element(self, element):
        """Parse price from an Amazon price container (handles offscreen, whole+fraction, or text)."""
        # 1. First check .a-offscreen if it contains non-whitespace text
        offscreen = element.select_one(".a-offscreen")
        if offscreen:
            txt = offscreen.get_text(" ", strip=True)
            if txt:
                val = self._extract_price_from_text(txt) or self._number(txt)
                if val is not None and val > 0:
                    return val

        # 2. Check .a-price-whole and optional .a-price-fraction
        whole = element.select_one(".a-price-whole")
        if whole:
            fraction = element.select_one(".a-price-fraction")
            frac_digits = re.sub(r"[^\d]", "", fraction.get_text(strip=True)) if fraction else "00"
            whole_digits = re.sub(r"[^\d]", "", whole.get_text(strip=True))
            if whole_digits:
                try:
                    val = float(f"{whole_digits}.{frac_digits}")
                    if val > 0:
                        return val
                except ValueError:
                    pass

        # 3. Fallback to clean element text
        raw_text = element.get_text(" ", strip=True)
        val = self._extract_price_from_text(raw_text) or self._number(raw_text)
        if val is not None and val > 0:
            return val

        return None

    def _extract_amazon_price(self, soup):
        """Find Amazon's current selling price while avoiding MRP/recommendations."""

        # ----------------------------------------------------
        # 1. Known Amazon price containers
        # ----------------------------------------------------

        price_selectors = [
            ".priceToPay",
            "#corePriceDisplay_desktop_feature_div .priceToPay",
            "#corePrice_feature_div .apex-core-price-identifier .a-price:not(.a-text-price)",
            "#corePrice_feature_div .a-price:not(.a-text-price)",
            "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price):not(.basisPrice)",
            "#priceblock_dealprice",
            "#priceblock_ourprice",
            "#priceblock_saleprice",
            "#apex_desktop .priceToPay",
        ]

        for selector in price_selectors:

            for element in soup.select(selector):

                if self._is_amazon_unrelated_or_mrp_price(element):
                    continue

                price = self._parse_amazon_price_element(element)

                if price is not None and price > 0:
                    return price

        # ----------------------------------------------------
        # 2. Modern Amazon HTML fallback
        #
        # Some Amazon variants remove the normal .a-price
        # selector from the parsed DOM while the price markup
        # is still present in the raw HTML.
        # ----------------------------------------------------

        raw_html = str(soup)

        price_markup = re.search(
            r'<span[^>]*class=["\'][^"\']*\ba-price\b[^"\']*["\'][^>]*>'
            r'\s*<span[^>]*class=["\'][^"\']*\ba-offscreen\b[^"\']*["\'][^>]*>'
            r'\s*₹\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
            raw_html,
            flags=re.I | re.S
        )

        if price_markup:

            value = self._number(
                price_markup.group(1)
            )

            if value is not None and value > 0:
                return value

        # ----------------------------------------------------
        # 3. HTML fallback without relying on class parsing
        #
        # Search only the portion beginning at the product
        # title. This prevents navigation prices such as
        # "Under ₹500" from becoming the product price.
        # ----------------------------------------------------

        title_match = re.search(
            r'id=["\']productTitle["\']',
            raw_html,
            flags=re.I
        )

        if title_match:

            product_html = raw_html[
                title_match.start():
            ]

            price_matches = re.findall(
                r'₹\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)',
                product_html,
                flags=re.I
            )

            for raw_value in price_matches:

                value = self._number(raw_value)

                if value is not None and value > 0:
                    return value

        # ----------------------------------------------------
        # 4. Embedded buying-options data
        # ----------------------------------------------------

        for script in soup.find_all("script"):

            script_text = script.string or script.get_text(
                " ",
                strip=False
            )

            if not script_text:
                continue

            match = re.search(
                r'"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)',
                script_text,
                flags=re.I
            )

            if match:

                try:

                    value = float(
                        match.group(1)
                    )

                    if value > 0:
                        return value

                except ValueError:
                    pass

        return None

    def _extract_amazon_mrp(self, soup):
        """Extract MRP/list price from Amazon if present."""
        mrp_selectors = [
            "#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen",
            "#corePrice_feature_div .basisPrice .a-offscreen",
            "#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen",
            "#corePrice_feature_div .a-text-price .a-offscreen",
            "#priceblock_listprice .a-offscreen",
            "#priceblock_listprice",
            "#listPrice .a-offscreen",
            "#listPrice"
        ]
        for sel in mrp_selectors:
            el = soup.select_one(sel)
            if el:
                val = self._extract_price_from_text(el.get_text(strip=True)) or self._number(el.get_text(strip=True))
                if val is not None and val > 0:
                    return val
        return None

    def _extract_model_from_name(self, name):

        if not name:
            return None

        text = str(name)

        words = re.findall(r"[A-Za-z0-9-]+", text)
        brand = self._extract_brand_from_name(text)
        if brand:
            words = [word for word in words if word.lower() != brand.lower()]

        stop_words = {
            "bluetooth", "wireless", "headphone", "headphones", "headset",
            "earphone", "earphones", "earbuds", "neckband", "with", "for",
            "power", "bank", "mah", "w", "gb", "tb"
        }
        model_words = []
        numeric_seen = False
        variant_words = {"pro", "plus", "max", "mini", "ultra", "anc", "v2"}
        for word in words:
            if word.lower() in stop_words:
                break
            if numeric_seen and word.lower() not in variant_words:
                break
            model_words.append(word)
            if re.search(r"\d", word):
                numeric_seen = True
            if len(model_words) >= 4:
                break

        return " ".join(model_words).strip() or None

    def _infer_category_from_name(self, name):

        text = str(name or "").lower()
        if any(x in text for x in ["headphone", "headset", "earphone", "earbuds", "neckband"]):
            return "headphone"
        if "power" in text and "bank" in text:
            return "powerbank"
        if any(x in text for x in ["laptop", "notebook"]):
            return "laptop"
        if any(x in text for x in ["iphone", "smartphone", "mobile", "galaxy"]):
            return "mobile"
        if any(x in text for x in ["smartwatch", "watch"]):
            return "smartwatch"
        if any(x in text for x in ["television", " tv ", "tv "]):
            return "television"
        return None

    def _extract_brand_from_name(self, name):
        if not name:
            return None
        text = str(name).strip()
        known_brands = [
            "Portronics", "PTron", "Jabra", "Sony", "Samsung", "Apple", "Boat",
            "boAt", "JBL", "OnePlus", "Realme", "Noise", "Boult",
            "HP", "Dell", "Lenovo", "Asus", "Acer", "LG", "Oppo",
            "Vivo", "Xiaomi", "Redmi"
        ]
        lower_text = text.lower()
        for brand in known_brands:
            pattern = r"\b" + re.escape(brand.lower()) + r"\b"
            if re.search(pattern, lower_text):
                return brand
        return None

    def _is_bot_challenge(self, html, url=None):
        if not html:
            return False
        lower_html = str(html).lower()
        markers = [
            "click the button below to continue shopping",
            "robot check",
            "enter the characters you see below",
            "flipkart recaptcha",
            "recaptcha",
            "access denied",
            "type the characters you see in this image",
            "something went wrong"
        ]
        return any(marker in lower_html for marker in markers)

    def _extract_price_from_text(self, text):
        if not text:
            return None
        context = str(text).lower()
        if any(token in context for token in ["save", "% off", "off", "emi", "per month", "/month", "m.r.p", "mrp"]):
            return None
        match = re.search(r"₹\s*([\d,]+(?:\.\d{1,2})?)", str(text))
        if not match:
            return None
        return self._number(match.group(1))

    # ========================================================
    # EMPTY PRODUCT
    # ========================================================

    def _empty_product(self, url):

        return {

            "name": None,
            "brand": None,
            "model": None,
            "category": None,
            "price": None,
            "mrp": None,
            "currency": "INR",
            "rating": None,
            "review_count": None,
            "availability": None,
            "seller": None,
            "image_url": None,
            "product_url": url,
            "source_url": url

        }


    # ========================================================
    # JSON-LD EXTRACTION
    # ========================================================

    def _extract_json_ld(self, soup):

        results = []

        scripts = soup.find_all(
            "script",
            type="application/ld+json"
        )

        for script in scripts:

            try:

                raw = (
                    script.string
                    or script.get_text()
                )

                if not raw:
                    continue

                data = json.loads(
                    raw
                )

                if isinstance(
                    data,
                    list
                ):

                    results.extend(
                        data
                    )

                elif isinstance(
                    data,
                    dict
                ):

                    results.append(
                        data
                    )

            except (
                json.JSONDecodeError,
                TypeError
            ):

                continue

        return results


    # ========================================================
    # APPLY JSON-LD
    # ========================================================

    def _apply_json_ld(
        self,
        product,
        data
    ):

        if not isinstance(
            data,
            dict
        ):

            return

        # ----------------------------------------------------
        # HANDLE @GRAPH
        # ----------------------------------------------------

        if "@graph" in data:

            graph = data["@graph"]

            if isinstance(
                graph,
                list
            ):

                for item in graph:

                    self._apply_json_ld(
                        product,
                        item
                    )

            return

        # ----------------------------------------------------
        # PRODUCT TYPE
        # ----------------------------------------------------

        item_type = data.get(
            "@type"
        )

        if isinstance(
            item_type,
            list
        ):

            item_types = item_type

        else:

            item_types = [
                item_type
            ]

        if (
            "Product" not in item_types
            and
            "ProductGroup" not in item_types
        ):

            return

        # ----------------------------------------------------
        # NAME
        # ----------------------------------------------------

        if not product["name"]:

            product["name"] = (
                self._clean(
                    data.get("name")
                )
            )

        # ----------------------------------------------------
        # BRAND
        # ----------------------------------------------------

        if not product["brand"]:

            brand = data.get(
                "brand"
            )

            if isinstance(
                brand,
                dict
            ):

                brand = brand.get(
                    "name"
                )

            product["brand"] = (
                self._clean(
                    brand
                )
            )

        # ----------------------------------------------------
        # CATEGORY
        # ----------------------------------------------------

        if not product["category"]:

            product["category"] = (
                self._clean(
                    data.get(
                        "category"
                    )
                )
            )

        # ----------------------------------------------------
        # MODEL
        # ----------------------------------------------------

        if not product["model"]:

            product["model"] = (
                self._clean(
                    data.get(
                        "model"
                    )
                )
            )

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        if not product["image_url"]:

            image = data.get(
                "image"
            )

            if isinstance(
                image,
                list
            ) and image:

                image = image[0]

            if isinstance(
                image,
                dict
            ):

                image = image.get(
                    "url"
                )

            product["image_url"] = (
                self._clean(
                    image
                )
            )

        # ----------------------------------------------------
        # OFFERS
        # ----------------------------------------------------

        offers = data.get(
            "offers"
        )

        if isinstance(
            offers,
            list
        ) and offers:

            offers = offers[0]

        if isinstance(
            offers,
            dict
        ):

            price = offers.get(
                "price"
            )

            if price is not None:

                product["price"] = (
                    self._number(
                        price
                    )
                )

            currency = offers.get(
                "priceCurrency"
            )

            if currency:

                product["currency"] = (
                    currency
                )

            availability = (
                offers.get(
                    "availability"
                )
            )

            if availability:

                product["availability"] = (
                    availability.split("/")[-1]
                )

            seller = offers.get(
                "seller"
            )

            if isinstance(
                seller,
                dict
            ):

                seller = seller.get(
                    "name"
                )

            product["seller"] = (
                self._clean(
                    seller
                )
            )

        # ----------------------------------------------------
        # RATING
        # ----------------------------------------------------

        rating = data.get(
            "aggregateRating"
        )

        if isinstance(
            rating,
            dict
        ):

            value = rating.get(
                "ratingValue"
            )

            count = rating.get(
                "reviewCount"
            )

            if count is None:

                count = rating.get(
                    "ratingCount"
                )

            if value is not None:

                product["rating"] = (
                    self._number(
                        value
                    )
                )

            if count is not None:

                product["review_count"] = (
                    self._integer(
                        count
                    )
                )


    # ========================================================
    # META DATA
    # ========================================================

    def _apply_meta_data(
        self,
        product,
        soup
    ):

        if not product["name"]:

            product["name"] = (
                self._meta(
                    soup,
                    [
                        "og:title",
                        "twitter:title"
                    ]
                )
            )

        if not product["image_url"]:

            product["image_url"] = (
                self._meta(
                    soup,
                    [
                        "og:image",
                        "twitter:image"
                    ]
                )
            )

        if product["price"] is None:

            price = self._meta(
                soup,
                [
                    "product:price:amount",
                    "og:price:amount"
                ]
            )

            if price:

                product["price"] = (
                    self._number(
                        price
                    )
                )

        currency = self._meta(
            soup,
            [
                "product:price:currency",
                "og:price:currency"
            ]
        )

        if currency:

            product["currency"] = currency


    # ========================================================
    # META HELPER
    # ========================================================

    def _meta(
        self,
        soup,
        names
    ):

        for name in names:

            tag = soup.find(
                "meta",
                attrs={
                    "property": name
                }
            )

            if not tag:

                tag = soup.find(
                    "meta",
                    attrs={
                        "name": name
                    }
                )

            if tag:

                content = tag.get(
                    "content"
                )

                if content:

                    return content.strip()

        return None


    # ========================================================
    # CLEAN
    # ========================================================

    def _clean(self, value):

        if value is None:

            return None

        value = str(
            value
        ).strip()

        return value if value else None


    # ========================================================
    # NUMBER
    # ========================================================

    def _number(self, value):

        try:

            cleaned = re.sub(
                r"[^\d.]",
                "",
                str(value)
            )

            return float(
                cleaned
            )

        except (
            ValueError,
            TypeError
        ):

            return None


    # ========================================================
    # INTEGER
    # ========================================================

    def _integer(self, value):

        try:

            cleaned = re.sub(
                r"[^\d]",
                "",
                str(value)
            )

            return int(
                cleaned
            )

        except (
            ValueError,
            TypeError
        ):

            return None
