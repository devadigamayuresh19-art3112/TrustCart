from backend.discovery.product_discovery import ProductDiscovery


product = {
    "brand": "Portronics",
    "model": "Muffs M2",
    "product_name": (
        "Portronics Muffs M2 Bluetooth Headphones"
    ),
    "category": "headphone",
    "search_query": (
        "Portronics Muffs M2 Bluetooth Headphones"
    )
}


discovery = ProductDiscovery()

result = discovery.discover(
    product
)


print("\n")
print("========================================")
print("DISCOVERY TEST RESULT")
print("========================================")

print(
    "Total candidates:",
    result["candidate_count"]
)


for index, candidate in enumerate(
    result["candidates"],
    1
):

    print(
        f"\n{index}. "
        f"{candidate.get('marketplace')}"
    )

    print(
        "Name:",
        candidate.get("name")
    )

    print(
        "Brand:",
        candidate.get("brand")
    )

    print(
        "Model:",
        candidate.get("model")
    )

    print(
        "Price:",
        candidate.get("price")
    )

    print(
        "Rating:",
        candidate.get("rating")
    )

    print(
        "URL:",
        candidate.get("product_url")
    )
