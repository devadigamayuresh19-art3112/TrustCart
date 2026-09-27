from backend.pipeline.comparison_pipeline import ComparisonPipeline
from backend.app import app


def test_compare_rejects_unsupported_url():
    client = app.test_client()

    response = client.post(
        "/api/products/compare",
        json={"url": "https://example.com/product/123"},
    )

    assert response.status_code == 400
    assert b"Unsupported" in response.data


def main():

    product = {
        "name": "Portronics Muffs M2 Bluetooth Headphones",
        "brand": "Portronics",
        "model": "Muffs M2",
        "category": "headphone",
        "price": 1386,
        "rating": 4.0,
        "review_count": 426,
        "source_url": "https://www.amazon.in/Portronics-Bluetooth-Headphone-Transparency-Adjustable/dp/B0FMFMXYYM/ref=sr_1_11"
    }

    pipeline = ComparisonPipeline()

    result = pipeline.run(product)

    print("\n")
    print("========================================")
    print("FINAL PIPELINE RESULT")
    print("========================================")

    print("\nCanonical Product:")
    print(result["canonical"])

    print("\nDiscovered Candidates:")
    print(
        result["discovery"].get("candidate_count")
        or len(result["discovery"].get("candidates", []))
    )

    print("\nMatched Products:")
    matching = result["matching"]

    for product in matching.get("matches", []):

        print("----------------------------------------")
        print("Marketplace:", product.get("marketplace"))
        print("Name:", product.get("name"))
        print("Brand:", product.get("brand"))
        print("Model:", product.get("model"))
        print("Price:", product.get("price"))
        print("Rating:", product.get("rating"))
        print("Review Count:", product.get("review_count"))
        print("Match Score:", product.get("match_score"))

    print("\nPrice Comparison:")
    price_result = result["price_comparison"]

    print("Lowest Price:", price_result.get("lowest_price"))
    print("Highest Price:", price_result.get("highest_price"))
    print("Savings:", price_result.get("savings"))
    print("Savings Percentage:", price_result.get("savings_percentage"))

    print("\nTrust Analysis:")

    trust_result = result["trust_analysis"]

    for product in trust_result.get("products", []):

        print("----------------------------------------")
        print("Marketplace:", product.get("marketplace"))
        print("Trust Score:", product.get("trust_score"))
        print("Trust Level:", product.get("trust_level"))

    print("\nRecommendation:")

    recommendation = result["recommendation"]

    print("Best Deal:")
    print(recommendation.get("best_deal"))

    print("\nMost Trusted:")
    print(recommendation.get("most_trusted"))

    print("\nRecommended:")
    print(recommendation.get("recommended"))

    print("\nRisky Products:")
    print(recommendation.get("risky_products"))

    print("\n========================================")
    print("TEST COMPLETE")
    print("========================================")


if __name__ == "__main__":
    main()

