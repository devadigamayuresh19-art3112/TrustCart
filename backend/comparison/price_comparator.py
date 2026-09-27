class PriceComparator:

    # ========================================================
    # MAIN COMPARISON METHOD
    # ========================================================

    def compare(self, matched_products):

        print(
            "\n========================================"
        )

        print(
            "PRICE COMPARISON"
        )

        print(
            "========================================"
        )

        # ----------------------------------------------------
        # Remove products without a valid price
        # ----------------------------------------------------

        valid_products = []

        for product in matched_products:

            price = product.get("price")

            if price is None:
                continue

            try:
                price = float(price)
            except (
                ValueError,
                TypeError
            ):
                continue

            if price <= 0:
                continue

            product["price"] = price

            valid_products.append(product)


        # ----------------------------------------------------
        # No valid prices
        # ----------------------------------------------------

        if not valid_products:

            return {
                "success": False,
                "message": "No valid product prices found.",
                "product_count": 0,
                "products": [],
                "best_deal": None,
                "lowest_price": None,
                "highest_price": None,
                "savings": 0,
                "savings_percentage": 0
            }


        # ----------------------------------------------------
        # Sort products by price
        # ----------------------------------------------------

        sorted_products = sorted(
            valid_products,
            key=lambda product: product["price"]
        )


        # ----------------------------------------------------
        # Lowest and highest price
        # ----------------------------------------------------

        lowest_price = (
            sorted_products[0]["price"]
        )

        highest_price = (
            sorted_products[-1]["price"]
        )


        # ----------------------------------------------------
        # Best deal
        # ----------------------------------------------------

        best_deal = sorted_products[0]


        # ----------------------------------------------------
        # Savings
        # ----------------------------------------------------

        savings = (
            highest_price -
            lowest_price
        )


        if highest_price > 0:

            savings_percentage = (
                savings /
                highest_price
            ) * 100

        else:

            savings_percentage = 0


        savings = round(
            savings,
            2
        )

        savings_percentage = round(
            savings_percentage,
            2
        )


        # ----------------------------------------------------
        # Add price rank
        # ----------------------------------------------------

        for index, product in enumerate(
            sorted_products,
            1
        ):

            product["price_rank"] = index


        # ----------------------------------------------------
        # Debug output
        # ----------------------------------------------------

        print(
            "Valid products:",
            len(sorted_products)
        )

        print(
            "Lowest price:",
            lowest_price
        )

        print(
            "Highest price:",
            highest_price
        )

        print(
            "Savings:",
            savings
        )

        print(
            "Savings percentage:",
            savings_percentage
        )

        print(
            "Best deal:",
            best_deal.get("marketplace")
        )


        # ----------------------------------------------------
        # Final result
        # ----------------------------------------------------

        return {

            "success": True,

            "product_count":
                len(sorted_products),

            "products":
                sorted_products,

            "best_deal":
                best_deal,

            "lowest_price":
                lowest_price,

            "highest_price":
                highest_price,

            "savings":
                savings,

            "savings_percentage":
                savings_percentage
        }
