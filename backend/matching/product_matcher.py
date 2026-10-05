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

        # Amazon search cards sometimes omit the manufacturer/brand
        # even when the model identity is correct. In that case,
        # infer the missing brand only after the model itself matches.
        # An explicitly different brand is never overridden.
        if (
            target_brand
            and not candidate_brand
            and target_model
            and candidate_model
            and self._model_matches_target(
                self._normalize_model(candidate_model),
                self._normalize_model(target_model)
            )
        ):
            candidate_brand = target_brand

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
        # IMPORTANT PRODUCT VARIANT CHECK
        # ====================================================
        # A model can be identical while the actual sellable variant
        # is different.
        #
        # Example:
        #   Google Pixel 11 (256 GB)
        #   Google Pixel 11 (512 GB)
        #
        # These must NOT be treated as equivalent products.
        #
        # At the same time, harmless specifications such as:
        #   Studio Evo
        #   Studio Evo 70hrs
        #
        # should remain compatible.
        if not self._variant_specs_match(
            target_name,
            candidate_name
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
        """Check whether two marketplace model identities represent the same
        core model, allowing harmless specification tokens on either side.

        Examples:
            target:    Studio Evo
            candidate: Studio Evo 70hrs
            -> MATCH

            target:    Studio Evo 70hrs
            candidate: Studio Evo
            -> MATCH

            target:    Rockerz 370
            candidate: Rockerz 370 Pro
            -> NO MATCH

            target:    Studio Evo
            candidate: Studio Pro
            -> NO MATCH
        """

        candidate_model = self._normalize_model(candidate_model)
        target_model = self._normalize_model(target_model)

        if not candidate_model or not target_model:
            return False

        if candidate_model == target_model:
            return True

        candidate_tokens = candidate_model.split()
        target_tokens = target_model.split()

        # ----------------------------------------------------
        # CORE MODEL PREFIX MATCH
        # ----------------------------------------------------
        # Marketplace metadata may include specifications such as:
        # 70hrs, 50 hours, 5g, 32gb, 10000mah, etc.
        #
        # If one model is a prefix of the other, check whether the
        # extra tokens look like specifications rather than a variant.
        # ----------------------------------------------------

        def is_specification(token):
            token = token.lower()

            specification_patterns = (
                r"^\d+(?:\.\d+)?(?:hrs?|hours?|h)$",
                r"^(?:2g|3g|4g|5g)$",
                r"^\d+(?:\.\d+)?(?:gb|tb|mb)$",
                r"^\d+(?:\.\d+)?(?:mah)$",
                r"^\d+(?:\.\d+)?(?:w|watts?)$",
                r"^\d+(?:\.\d+)?(?:mm|cm)$",
                r"^\d+(?:\.\d+)?(?:hz|khz)$",
                r"^\d+(?:\.\d+)?(?:ms)$",
                r"^\d+(?:\.\d+)?(?:inch|in)$",
                r"^\d+(?:\.\d+)?(?:mp)$",
                r"^\d+(?:\.\d+)?(?:mah)$",
                r"^\d+(?:\.\d+)?$",
            )

            return any(
                re.match(pattern, token)
                for pattern in specification_patterns
            )

        # Candidate has extra specification tokens.
        if (
            len(candidate_tokens) > len(target_tokens)
            and candidate_tokens[:len(target_tokens)] == target_tokens
        ):
            extras = candidate_tokens[len(target_tokens):]
            return all(is_specification(token) for token in extras)

        # Target has extra specification tokens.
        if (
            len(target_tokens) > len(candidate_tokens)
            and target_tokens[:len(candidate_tokens)] == candidate_tokens
        ):
            extras = target_tokens[len(candidate_tokens):]
            return all(is_specification(token) for token in extras)

        return False


    # ========================================================
    # PRODUCT VARIANT COMPATIBILITY
    # ========================================================

    def _variant_specs_match(self, target_name, candidate_name):
        """Reject materially different product variants.

        The model identity alone is not enough for products such as
        smartphones and laptops because storage/RAM/network variants
        can share the exact same model name.

        Important differences:
            256 GB vs 512 GB
            8 GB RAM vs 12 GB RAM
            4G vs 5G

        Harmless specifications such as battery capacity, playtime,
        wattage, dimensions, etc. are intentionally ignored here.
        """

        target = self._normalize(target_name)
        candidate = self._normalize(candidate_name)

        if not target or not candidate:
            return True

        def extract_specs(text):
            specs = {}

            # Storage capacity.
            storage_matches = re.findall(
                r"\b(\d+(?:\.\d+)?)\s*(gb|tb)\b(?!\s*(?:ram|memory)\b)",
                text,
                flags=re.IGNORECASE
            )

            if storage_matches:
                values = []
                for number, unit in storage_matches:
                    value = float(number)
                    if unit.lower() == "tb":
                        value *= 1024
                    values.append(int(value) if value.is_integer() else value)
                specs["storage"] = tuple(sorted(set(values)))

            # RAM. Only capture values explicitly associated with RAM.
            ram_matches = re.findall(
                r"\b(\d+(?:\.\d+)?)\s*gb\s*(?:ram|memory)\b",
                text,
                flags=re.IGNORECASE
            )

            if ram_matches:
                specs["ram"] = tuple(
                    sorted(set(float(value) for value in ram_matches))
                )

            # Network generation is a meaningful phone variant.
            network_matches = re.findall(
                r"\b([2345]g)\b",
                text,
                flags=re.IGNORECASE
            )

            if network_matches:
                specs["network"] = tuple(
                    sorted(set(value.lower() for value in network_matches))
                )

            return specs

        target_specs = extract_specs(target)
        candidate_specs = extract_specs(candidate)

        # If the target explicitly specifies a material variant,
        # the candidate MUST also specify that variant and it MUST match.
        #
        # Example:
        #   Target:    iPhone 16 256 GB
        #   Candidate: iPhone 16 128 GB  -> reject
        #   Candidate: iPhone 16         -> reject (variant unknown)
        #   Candidate: iPhone 16 256 GB  -> accept
        #
        # This prevents an unverified candidate from being treated as
        # an equivalent product when the source has a specific variant.
        for key in ("storage", "ram", "network"):
            target_value = target_specs.get(key)
            candidate_value = candidate_specs.get(key)

            if target_value:
                if not candidate_value:
                    print(
                        f"Variant missing: {key} | "
                        f"target={target_value} | "
                        f"candidate=unknown"
                    )
                    return False

                if target_value != candidate_value:
                    print(
                        f"Variant mismatch: {key} | "
                        f"target={target_value} | "
                        f"candidate={candidate_value}"
                    )
                    return False

        return True


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

            # Product-specification boundary.
            # Check the original token BEFORE punctuation is removed,
            # otherwise "w/" becomes just "w".
            if re.match(r"^(?:w/|with(?:/|$))", word, flags=re.IGNORECASE):
                break

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
