
import re


class CanonicalProductGenerator:

    def generate(self, product):

        name = product.get("name") or ""
        brand = product.get("brand") or self._infer_brand(name)
        model = product.get("model")
        category = product.get("category")

        # --------------------------------------------------
        # CLEAN PRODUCT NAME
        # --------------------------------------------------

        clean_name = self._clean_text(name)
        if not category:
            category = self._infer_category(clean_name)

        # --------------------------------------------------
        # DETECT MODEL
        # --------------------------------------------------

        # A fetcher may provide a partial model (for example ``Rockerz``
        # from a title containing ``Rockerz 370``).  Prefer the identity
        # found in the complete title when it contains a stronger
        # alphanumeric identifier.
        extracted_model = self._extract_model(clean_name, brand)
        if not model or (
            extracted_model
            and any(char.isdigit() for char in extracted_model)
            and not any(char.isdigit() for char in str(model))
        ):
            model = extracted_model

        # --------------------------------------------------
        # CREATE SEARCH QUERY
        # --------------------------------------------------

        search_query = self._generate_search_query(
            clean_name,
            brand,
            model,
            category
        )

        return {
            "brand": brand,
            "model": model,
            "product_name": clean_name,
            "category": category,
            "search_query": search_query,
            "source_url": product.get("source_url"),
            "image_url": product.get("image_url"),
            "price": product.get("price"),
            "rating": product.get("rating"),
            "review_count": product.get("review_count")
        }


    # ==================================================
    # CLEAN TEXT
    # ==================================================

    def _clean_text(self, text):

        text = str(text).strip()

        # Replace repeated whitespace
        text = re.sub(
            r"\s+",
            " ",
            text
        )

        # Fix spaces around commas
        text = re.sub(
            r"\s*,\s*",
            ", ",
            text
        )

        # Fix spaces around &
        text = re.sub(
            r"\s*&\s*",
            " & ",
            text
        )

        return text


    # ==================================================
    # MODEL EXTRACTION
    # ==================================================

    def _extract_model(
        self,
        name,
        brand
    ):

        if not name:
            return None

        working_name = name

        # Remove brand from beginning
        if brand:

            pattern = (
                r"^"
                + re.escape(brand)
                + r"\s*"
            )

            working_name = re.sub(
                pattern,
                "",
                working_name,
                flags=re.IGNORECASE
            )

        # --------------------------------------------------
        # Common model pattern
        #
        # Example:
        # Muffs M2 Bluetooth Headphones
        #
        # We keep the first meaningful product words
        # before specifications.
        # --------------------------------------------------

        specification_words = [
            "bluetooth",
            "wireless",
            "headphones",
            "headphone",
            "earbuds",
            "earphones",
            "smartwatch",
            "mobile",
            "phone",
            "laptop",
            "television",
            "tv",
            "monitor",
            "speaker",
            "camera",
            "power",
            "bank",
            "mah",
            "wh",
            "over",
            "ear",
            "with",
            "mic",
            "playtime",
            "drivers"
        ]

        words = working_name.split()

        model_words = []

        for word in words:

            clean_word = re.sub(
                r"[^\w-]",
                "",
                word
            ).lower()

            if clean_word in specification_words:
                break

            model_words.append(word)

            # Prevent excessively long model names
            if len(model_words) >= 5:
                break

        if not model_words:
            return None

        return " ".join(
            model_words
        )


    # ==================================================
    # SEARCH QUERY
    # ==================================================

    def _generate_search_query(
        self,
        name,
        brand,
        model,
        category
    ):

        parts = []

        # Brand
        if brand:
            parts.append(
                brand.strip()
            )

        # Model
        if model:

            if model.lower() not in [
                p.lower()
                for p in parts
            ]:

                parts.append(model.strip())

        # A numeric/alphanumeric model is the strongest identity signal.
        # Extra generic category words can make marketplace search rank close
        # variants (Rockerz 411/371) above the exact Rockerz 370 listing.
        if model and re.search(r"\d", str(model)) and re.search(r"[a-zA-Z]", str(model)):
            return self._clean_text(" ".join(parts))

        # Category
        category_map = {

            "headphone":
                "Bluetooth Headphones",

            "headphones":
                "Bluetooth Headphones",

            "earphone":
                "Earphones",

            "earbuds":
                "Wireless Earbuds",

            "laptop":
                "Laptop",

            "mobile":
                "Smartphone",

            "mobiles":
                "Smartphone",

            "smartwatch":
                "Smartwatch",

            "television":
                "TV",

            "tv":
                "TV",

            "speaker":
                "Bluetooth Speaker",

            "powerbank":
                "Power Bank",

            "power_bank":
                "Power Bank"
        }

        if category:

            category_text = category_map.get(
                category.lower()
            )

            if category_text:

                parts.append(
                    category_text
                )

        # Keep the query compact, but retain distinctive product words when
        # the source has no reliable model (common for power banks and
        # marketplace titles with marketing-heavy names).
        if len(parts) < 2:
            fallback_words = []
            stop_words = {
                "with", "for", "and", "the", "new", "original",
                "sale", "offer", "discount", "free", "shipping",
                "warranty", "emi", "cashback", "seller"
            }
            for word in re.findall(r"[A-Za-z0-9]+", name):
                lower_word = word.lower()
                if lower_word in stop_words or lower_word in {
                    "bluetooth", "wireless", "headset", "headphones",
                    "headphone", "earphones", "earbuds"
                }:
                    continue
                if word not in fallback_words:
                    fallback_words.append(word)
                if len(fallback_words) >= 4:
                    break
            if fallback_words:
                parts.extend(fallback_words)

        # --------------------------------------------------
        # Fallback
        # --------------------------------------------------

        if len(parts) < 2:

            fallback = name

            # Remove excessive specification text
            fallback = re.sub(
                r"\b\d+\s*(hrs?|hours?|mm|gb|tb|mah|w)\b",
                "",
                fallback,
                flags=re.IGNORECASE
            )

            parts = [
                fallback.strip()
            ]

        return self._clean_text(
            " ".join(parts)
        )

    def _infer_category(self, name):
        text = str(name or '').lower()
        if any(word in text for word in {
            'headphone', 'headset', 'earphone', 'earbuds', 'neckband'
        }):
            return 'headphone'
        if 'power' in text and 'bank' in text:
            return 'powerbank'
        if 'laptop' in text or 'notebook' in text:
            return 'laptop'
        if 'smartphone' in text or 'mobile' in text:
            return 'mobile'
        if 'smartwatch' in text:
            return 'smartwatch'
        return None

    def _infer_brand(self, name):
        known_brands = [
            'Portronics', 'PTron', 'Jabra', 'Sony', 'Samsung', 'Apple', 'Boat',
            'JBL', 'OnePlus', 'Realme', 'Noise', 'Boult', 'HP', 'Dell',
            'Lenovo', 'Asus', 'Acer', 'LG', 'Oppo', 'Vivo', 'Xiaomi', 'Redmi',
            'PTROX', 'PTron', 'pTron'
        ]
        text = str(name or '')
        for brand in known_brands:
            if re.search(r'\b' + re.escape(brand) + r'\b', text, re.I):
                return brand

        words = re.findall(r'[A-Za-z0-9.-]+', text)
        for word in words:
            clean = re.sub(r'[^A-Za-z]', '', word)
            if len(clean) > 2 and clean.lower() not in {
                'bluetooth', 'wireless', 'headphone', 'headphones', 'earbuds',
                'earphones', 'neckband', 'vibration', 'alert', 'playtime',
                'waterproof', 'india', 'buy', 'online'
            }:
                return clean.title()
        return None
