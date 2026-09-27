class RecommendationEngine:

    def recommend(
        self,
        price_result,
        trust_result
    ):

        print(
            "\n========================================"
        )

        print(
            "RECOMMENDATION ENGINE"
        )

        print(
            "========================================"
        )


        price_products = (
            price_result.get(
                "products",
                []
            )
        )

        trust_products = (
            trust_result.get(
                "products",
                []
            )
        )


        if not price_products:

            return {
                "success": False,
                "message": "No products available for recommendation.",
                "recommended": None,
                "best_deal": None,
                "most_trusted": None,
                "risky_products": [],
                "products": []
            }


        # ----------------------------------------------------
        # Create trust lookup using product URL
        # ----------------------------------------------------

        trust_lookup = {}

        for product in trust_products:

            url = product.get(
                "product_url"
            )

            if url:

                trust_lookup[url] = product


        recommendation_products = []


        # ----------------------------------------------------
        # Calculate recommendation scores
        # ----------------------------------------------------

        for product in price_products:

            url = product.get(
                "product_url"
            )

            trust_product = (
                trust_lookup.get(url)
            )


            trust_score = 0


            if trust_product:

                trust_score = (
                    trust_product.get(
                        "trust_score",
                        0
                    )
                )


            price_rank = product.get(
                "price_rank"
            )


            if price_rank is None:

                price_rank = 1


            # ------------------------------------------------
            # PRICE SCORE
            # ------------------------------------------------

            product_count = len(
                price_products
            )


            if product_count <= 1:

                price_score = 100

            else:

                price_score = (
                    (
                        product_count -
                        price_rank +
                        1
                    )
                    /
                    product_count
                ) * 100


            # ------------------------------------------------
            # FINAL RECOMMENDATION SCORE
            # ------------------------------------------------

            recommendation_score = (

                price_score * 0.45

                +

                trust_score * 0.55
            )


            recommendation_score = round(
                recommendation_score,
                2
            )


            recommendation_products.append({

                **product,

                "trust_score":
                    trust_score,

                "price_score":
                    round(
                        price_score,
                        2
                    ),

                "recommendation_score":
                    recommendation_score

            })


        # ----------------------------------------------------
        # Sort by recommendation score
        # ----------------------------------------------------

        recommendation_products.sort(
            key=lambda product:
            product[
                "recommendation_score"
            ],
            reverse=True
        )


        # ----------------------------------------------------
        # BEST DEAL
        # ----------------------------------------------------

        best_deal = min(
            recommendation_products,
            key=lambda product:
            product["price"]
        )


        # ----------------------------------------------------
        # MOST TRUSTED
        # ----------------------------------------------------

        most_trusted = max(
            recommendation_products,
            key=lambda product:
            product["trust_score"]
        )


        # ----------------------------------------------------
        # RECOMMENDED
        # ----------------------------------------------------

        recommended = (
            recommendation_products[0]
        )


        # ----------------------------------------------------
        # RISKY PRODUCTS
        # ----------------------------------------------------

        risky_products = [

            product

            for product
            in recommendation_products

            if product["trust_score"] < 50

        ]


        # ----------------------------------------------------
        # Add labels
        # ----------------------------------------------------

        for product in recommendation_products:

            product["recommendation"] = (
                "Recommended"
                if product
                is recommended
                else "Alternative"
            )


        # ----------------------------------------------------
        # Console output
        # ----------------------------------------------------

        print(
            "\nProducts evaluated:",
            len(
                recommendation_products
            )
        )


        print(
            "\nBEST DEAL:"
        )

        print(
            best_deal["marketplace"],
            "| ₹",
            best_deal["price"]
        )


        print(
            "\nMOST TRUSTED:"
        )

        print(
            most_trusted["marketplace"],
            "|",
            most_trusted["trust_score"]
        )


        print(
            "\nRECOMMENDED:"
        )

        print(
            recommended["marketplace"],
            "|",
            recommended[
                "recommendation_score"
            ]
        )


        print(
            "\nRISKY PRODUCTS:",
            len(risky_products)
        )


        return {

            "success": True,

            "product_count":
                len(
                    recommendation_products
                ),

            "products":
                recommendation_products,

            "best_deal":
                best_deal,

            "most_trusted":
                most_trusted,

            "recommended":
                recommended,

            "risky_products":
                risky_products
        }
