import re
from difflib import SequenceMatcher


class ProductMatcher:

    def __init__(self):
        self.minimum_match_score = 70


    # ========================================================
    # MAIN MATCH METHOD
    # ========================================================

    def match(self, canonical_product, candidates):

        results = []

        print(
            "\n========================================"
        )

        print(
            "PRODUCT MATCHING"
        )

        print(
            "Target:",
            canonical_product.get("product_name")
        )

        print(
            "========================================"
        )

        for candidate in candidates:

            result = self._compare_products(
                canonical_product,
                candidate
            )

            results.append(result)

        # Highest score first
        results.sort(
            key=lambda x: x["match_score"],
            reverse=True
        )

        matched = [
            result
            for result in results
            if result["is_match"]
        ]

        print(
            "\nMatched candidates:",
            len(matched)
        )

        return {
            "success": True,
            "target": canonical_product,
            "match_count": len(matched),
            "best_match": matched[0] if matched else None,
            "matches": matched,
            "all_results": results
        }


    # ========================================================
    # COMPARE TWO PRODUCTS
    # ========================================================

    def _compare_products(
        self,
        canonical_product,
        candidate
    ):

        target_brand = self._normalize(
            canonical_product.get("brand")
        )

        candidate_brand = self._normalize(
            candidate.get("brand")
        )

        target_model = self._model_identity(
            canonical_product.get("model"),
            canonical_product.get("product_name"),
            target_brand
        )

        candidate_model = self._model_identity(
            candidate.get("model"),
            candidate.get("name"),
            candidate_brand
        )

        target_name = self._normalize(
            canonical_product.get("product_name")
        )

        candidate_name = self._normalize(
            candidate.get("name")
        )

        target_category = self._normalize(
            canonical_product.get("category")
        )

        candidate_category = self._normalize(
            candidate.get("category")
        )


        # ====================================================
        # MODEL EXTRACTION FALLBACK
        # ====================================================

        if not target_category:
            target_category = self._infer_category(target_name)

        if not candidate_category:
            candidate_category = self._infer_category(candidate_name)


        # ====================================================
        # INDIVIDUAL SCORES
        # ====================================================

        brand_score = self._brand_score(
            target_brand,
            candidate_brand
        )

        model_score = self._model_score(
            target_model,
            candidate_model
        )

        name_score = self._text_similarity(
            target_name,
            candidate_name
        )

        category_score = self._category_score(
            target_category,
            candidate_category
        )


        # ====================================================
        # FINAL WEIGHTED SCORE
        # ====================================================

        final_score = (
            brand_score * 0.35
            +
            model_score * 0.40
            +
            name_score * 0.20
            +
            category_score * 0.05
        )

        final_score = round(
            final_score,
            2
        )


        # ====================================================
        # MATCH DECISION
        # ====================================================

        is_match = (
            final_score >=
            self.minimum_match_score
        )


        # ====================================================
        # DIFFERENT BRAND = NOT MATCH
        # ====================================================

        if (
            target_brand
            and candidate_brand
            and target_brand != candidate_brand
        ):

            is_match = False


        # ====================================================
        # MODEL COMPATIBILITY CHECK
        # ====================================================

        # Marketplace product titles often append specifications to the
        # actual model name.
        #
        # Example:
        #
        # target:    Studio Evo
        # candidate: Studio Evo 70hrs
        #
        # These should match because the candidate starts with the complete
        # target model tokens.
        #
        # But clearly different models must still be rejected:
        #
        # Studio Pro   != Studio Evo
        # Studio M2    != Studio Evo

        if target_model and candidate_model:
            target_model_normalized = self._normalize_model(target_model)
            candidate_model_normalized = self._normalize_model(candidate_model)

            if not self._model_matches_target(
                candidate_model_normalized,
                target_model_normalized
            ):
                is_match = False


        # ====================================================
        # RESULT
        # ====================================================

        result = {

            "marketplace":
                candidate.get("marketplace"),

            "name":
                candidate.get("name"),

            "product_url":
                candidate.get("product_url"),

            "brand":
                candidate.get("brand"),

            "model":
                candidate_model,

            "price":
                candidate.get("price"),

            "rating":
                candidate.get("rating"),

            "review_count":
                candidate.get("review_count"),

            "image_url":
                candidate.get("image_url"),

            "brand_score":
                round(
                    brand_score,
                    2
                ),

            "model_score":
                round(
                    model_score,
                    2
                ),

            "name_score":
                round(
                    name_score,
                    2
                ),

            "category_score":
                round(
                    category_score,
                    2
                ),

            "match_score":
                final_score,

            "is_match":
                is_match
        }


        # ====================================================
        # DEBUG OUTPUT
        # ====================================================

        print(
            "\nCandidate:",
            candidate.get("name")
        )

        print(
            "Brand score:",
            round(
                brand_score,
                2
            )
        )

        print(
            "Model score:",
            round(
                model_score,
                2
            )
        )

        print(
            "Name score:",
            round(
                name_score,
                2
            )
        )

        print(
            "Category score:",
            round(
                category_score,
                2
            )
        )

        print(
            "Final score:",
            final_score
        )

        print(
            "MATCH:",
            "YES" if is_match else "NO"
        )


        return result


    # ========================================================
    # NORMALIZATION
    # ========================================================

    def _normalize(self, text):

        if not text:

            return ""

        text = str(text).lower()

        text = re.sub(
            r"[^a-z0-9\s]",
            " ",
            text
        )

        text = re.sub(
            r"\s+",
            " ",
            text
        )

        return text.strip()

    def _model_identity(self, explicit_model, name, brand):
        """Return a stable, distinctive model key for cross-site titles.

        Marketplace metadata is often incomplete or truncated.  A title such
        as ``boAt Rockerz 370 Bluetooth Headphones`` is more authoritative
        than a partial metadata value of ``Rockerz``.  Numeric/alphanumeric
        model tokens are retained, while generic product-type words are not.
        """
        explicit = self._normalize(explicit_model)
        derived = self._extract_model_from_name(
            self._normalize(name),
            self._normalize(brand)
        )
        if derived and any(char.isdigit() for char in derived):
            return derived
        if explicit and any(char.isdigit() for char in explicit):
            return explicit
        return explicit or derived

    def _infer_category(self, text):
        text = self._normalize(text)
        if any(word in text.split() for word in {
            "headphone", "headphones", "headset", "earphone",
            "earphones", "earbuds", "neckband"
        }):
            return "headphone"
        if "power" in text.split() and "bank" in text.split():
            return "powerbank"
        if any(word in text.split() for word in {"speaker"}):
            return "speaker"
        if any(word in text.split() for word in {"laptop", "notebook"}):
            return "laptop"
        if any(word in text.split() for word in {"mobile", "smartphone"}):
            return "mobile"
        return ""


    # ========================================================
    # BRAND SCORE
    # ========================================================

    def _brand_score(
        self,
        target_brand,
        candidate_brand
    ):

        if not target_brand:

            return 0

        if not candidate_brand:

            return 0

        if target_brand == candidate_brand:

            return 100

        similarity = SequenceMatcher(
            None,
            target_brand,
            candidate_brand
        ).ratio()

        return similarity * 100


    # ========================================================
    # MODEL COMPATIBILITY
    # ========================================================

    def _normalize_model(self, value):
        return " ".join(
            str(value or "").lower().strip().split()
        )

    def _model_matches_target(
        self,
        candidate_model,
        target_model
    ):
        """Check whether a candidate model contains the complete target model.

        Marketplace titles may append specifications to a model name.
        Example:
            target:    Studio Evo
            candidate: Studio Evo 70hrs

        The target tokens must appear as the complete prefix so that
        unrelated variants such as Studio Pro are not accepted.
        """

        candidate_model = self._normalize_model(candidate_model)
        target_model = self._normalize_model(target_model)

        if not candidate_model or not target_model:
            return False

        if candidate_model == target_model:
            return True

        candidate_tokens = candidate_model.split()
        target_tokens = target_model.split()

        return (
            len(candidate_tokens) > len(target_tokens)
            and candidate_tokens[:len(target_tokens)] == target_tokens
        )


    # ========================================================
    # MODEL SCORE
    # ========================================================

    def _model_score(
        self,
        target_model,
        candidate_model
    ):

        if not target_model:

            return 0

        if not candidate_model:

            return 0

        if target_model == candidate_model:

            return 100

        # Substring similarity is unsafe for model variants (370 vs 370 Pro).
        # Keep a useful diagnostic score, while the hard mismatch check above
        # prevents it from being accepted.
        return SequenceMatcher(None, target_model, candidate_model).ratio() * 100


    # ========================================================
    # TEXT SIMILARITY
    # ========================================================

    def _text_similarity(
        self,
        text1,
        text2
    ):

        if not text1 or not text2:

            return 0

        similarity = SequenceMatcher(
            None,
            text1,
            text2
        ).ratio()
        left = set(text1.split())
        right = set(text2.split())
        overlap = (len(left & right) / max(1, len(left))) * 100
        return max(similarity * 100, overlap)


    # ========================================================
    # CATEGORY SCORE
    # ========================================================

    def _category_score(
        self,
        target_category,
        candidate_category
    ):

        if not target_category:

            return 0

        if not candidate_category:

            return 0

        if target_category == candidate_category:

            return 100

        headphone_categories = {
            "headphone",
            "headphones",
            "headset",
            "earphone",
            "earphones",
            "earbuds"
        }

        if (
            target_category in headphone_categories
            and
            candidate_category in headphone_categories
        ):

            return 100

        equivalent_categories = {
            "powerbank": {"powerbank", "power bank"},
            "mobile": {"mobile", "smartphone", "phone"},
            "laptop": {"laptop", "notebook"},
            "speaker": {"speaker", "speakers"},
        }
        for categories in equivalent_categories.values():
            if target_category in categories and candidate_category in categories:
                return 100

        return 0


    # ========================================================
    # EXTRACT MODEL FROM PRODUCT NAME
    # ========================================================

    def _extract_model_from_name(
        self,
        name,
        brand
    ):

        if not name:

            return ""


        working_name = name


        # Remove brand
        if brand:

            brand_pattern = (
                r"\b"
                + re.escape(brand)
                + r"\b"
            )

            working_name = re.sub(
                brand_pattern,
                " ",
                working_name,
                flags=re.IGNORECASE
            )


        # Words that normally indicate
        # the model section has ended.

        stop_words = {

            "bluetooth",
            "wireless",
            "headphones",
            "headphone",
            "headset",
            "earbuds",
            "earphones",
            "neckband",

            "over",
            "ear",

            "with",
            "anc",

            "enabled",
            "playtime",
            "hours",
            "hrs",

            "driver",
            "drivers",

            "powerful",
            "bass",

            "wired",
            "water",
            "resistant",

            "microphone",

            "stereo",

            "hifi"
        }


        words = working_name.split()

        model_words = []
        numeric_seen = False
        variant_words = {"pro", "plus", "max", "mini", "ultra", "anc", "v2"}


        for word in words:

            clean_word = re.sub(
                r"[^a-z0-9-]",
                "",
                word.lower()
            )

            if not clean_word:

                continue

            if clean_word in stop_words:

                break

            if numeric_seen and clean_word not in variant_words:
                break

            model_words.append(
                word
            )

            # Numeric tokens are often the most important part of a model
            # (Rockerz 370, Muffs M2).  Keep them, but stop after a complete
            # identifier followed by a variant/product descriptor.
            if re.fullmatch(r"\d+[a-z]*", clean_word):
                numeric_seen = True

            if len(model_words) >= 4:

                break


        if not model_words:

            return ""


        return self._normalize(
            " ".join(model_words)
        )
