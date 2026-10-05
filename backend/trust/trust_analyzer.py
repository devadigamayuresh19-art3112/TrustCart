class TrustAnalyzer:

    def __init__(self):

        self.weights = {
            "rating": 0.35,
            "review_count": 0.30,
            "price": 0.15,
            "seller": 0.20
        }


    # ========================================================
    # MAIN ANALYSIS
    # ========================================================

    def analyze(self, products):

        print(
            "\n========================================"
        )

        print(
            "TRUST ANALYSIS"
        )

        print(
            "========================================"
        )


        analyzed_products = []


        for product in products:

            analysis = self._analyze_product(
                product
            )

            analyzed_products.append(
                analysis
            )


        analyzed_products.sort(
            key=lambda product:
            product["trust_score"],
            reverse=True
        )


        print(
            "\nTrust analysis complete."
        )

        print(
            "Products analyzed:",
            len(analyzed_products)
        )


        return {
            "success": True,
            "product_count": len(
                analyzed_products
            ),
            "products": analyzed_products
        }


    # ========================================================
    # PRODUCT ANALYSIS
    # ========================================================

    def _analyze_product(self, product):

        rating = self._safe_float(
            product.get("rating")
        )

        review_count = self._safe_float(
            product.get("review_count")
        )

        price = self._safe_float(
            product.get("price")
        )

        marketplace = (
            product.get("marketplace")
            or ""
        )


        # ----------------------------------------------------
        # RATING SCORE
        # ----------------------------------------------------

        rating_score = self._rating_score(
            rating
        )


        # ----------------------------------------------------
        # REVIEW SCORE
        # ----------------------------------------------------

        review_score = self._review_score(
            review_count
        )


        # ----------------------------------------------------
        # SELLER SCORE
        # ----------------------------------------------------

        seller_score = self._seller_score(
            marketplace
        )


        # ----------------------------------------------------
        # PRICE SCORE
        # ----------------------------------------------------

        price_score = self._price_score(
            price
        )


        # ----------------------------------------------------
        # FINAL TRUST SCORE
        # ----------------------------------------------------

        trust_score = (

            rating_score *
            self.weights["rating"]

            +

            review_score *
            self.weights["review_count"]

            +

            price_score *
            self.weights["price"]

            +

            seller_score *
            self.weights["seller"]
        )


        trust_score = round(
            trust_score,
            2
        )


        trust_level = (
            self._trust_level(
                trust_score
            )
        )


        result = {

            "marketplace":
                marketplace,

            "name":
                product.get("name"),

            "product_url":
                product.get("product_url"),

            "price":
                price,

            "rating":
                rating,

            "review_count":
                int(review_count)
                if review_count is not None
                else None,

            "rating_score":
                round(
                    rating_score,
                    2
                ),

            "review_score":
                round(
                    review_score,
                    2
                ),

            "seller_score":
                round(
                    seller_score,
                    2
                ),

            "price_score":
                round(
                    price_score,
                    2
                ),

            "trust_score":
                trust_score,

            "trust_level":
                trust_level
        }


        print(
            "\nProduct:",
            product.get("name")
        )

        print(
            "Marketplace:",
            marketplace
        )

        print(
            "Rating score:",
            round(
                rating_score,
                2
            )
        )

        print(
            "Review score:",
            round(
                review_score,
                2
            )
        )

        print(
            "Seller score:",
            round(
                seller_score,
                2
            )
        )

        print(
            "Price score:",
            round(
                price_score,
                2
            )
        )

        print(
            "Trust score:",
            trust_score
        )

        print(
            "Trust level:",
            trust_level
        )


        return result


    # ========================================================
    # RATING SCORE
    # ========================================================

    def _rating_score(self, rating):

        if rating is None:
            return 0

        if rating <= 0:
            return 0

        if rating >= 5:
            return 100

        return (
            rating / 5
        ) * 100


    # ========================================================
    # REVIEW SCORE
    # ========================================================

    def _review_score(self, review_count):

        if review_count is None:
            return 0

        if review_count <= 0:
            return 0

        # Log-like scale without external libraries.

        if review_count >= 10000:
            return 100

        if review_count >= 5000:
            return 95

        if review_count >= 2000:
            return 90

        if review_count >= 1000:
            return 85

        if review_count >= 500:
            return 80

        if review_count >= 200:
            return 70

        if review_count >= 100:
            return 60

        if review_count >= 50:
            return 50

        if review_count >= 20:
            return 40

        if review_count >= 10:
            return 30

        return 20


    # ========================================================
    # SELLER SCORE
    # ========================================================

    def _seller_score(self, marketplace):

        marketplace = (
            str(marketplace)
            .lower()
            .strip()
        )


        trusted_marketplaces = {

            "amazon": 90,

            "flipkart": 90,

            "snapdeal": 85
        }


        return trusted_marketplaces.get(
            marketplace,
            60
        )


    # ========================================================
    # PRICE SCORE
    # ========================================================

    def _price_score(self, price):

        if price is None:
            return 50

        if price <= 0:
            return 0

        # Price itself should not dominate trust.
        # A normal valid price gets a neutral score.

        return 70


    # ========================================================
    # TRUST LEVEL
    # ========================================================

    def _trust_level(self, score):

        if score >= 85:
            return "Excellent"

        if score >= 70:
            return "Good"

        if score >= 50:
            return "Moderate"

        if score >= 30:
            return "Low"

        return "Risky"


    # ========================================================
    # SAFE NUMBER CONVERSION
    # ========================================================

    def _safe_float(self, value):

        if value is None:
            return None

        try:
            return float(value)

        except (
            ValueError,
            TypeError
        ):

            return None
