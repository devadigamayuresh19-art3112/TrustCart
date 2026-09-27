import requests
import sys

BASE_URL = "http://localhost:5000"
TIMEOUT = 30


def test_post_products_compare_no_matches():
    url = f"{BASE_URL}/api/products/compare"
    # Use a Flipkart product URL that is expected to have no comparable matches
    product_url = "https://www.flipkart.com/sample-brand-sample-model/p/itm1234567890abcd"

    payload = {"url": product_url}
    headers = {"Content-Type": "application/json"}

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    assert resp is not None, "No response received from the API"
    assert resp.status_code == 200, f"Expected HTTP 200 but got {resp.status_code}: {resp.text}"

    try:
        data = resp.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    # Some APIs wrap payload under 'data'
    if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
        data = data["data"]

    # Identify matches list in common keys
    matches = None
    for key in ("matches", "comparisons", "results", "candidates"):
        if key in data:
            matches = data[key]
            break

    # If API uses a nested structure like {'comparison': {...}}
    if matches is None:
        # Try common nested spots
        if "comparison" in data and isinstance(data["comparison"], dict):
            for key in ("matches", "results", "candidates"):
                if key in data["comparison"]:
                    matches = data["comparison"][key]
                    break

    # It's acceptable that matches is an empty list for "no comparable matches"
    assert matches is not None, f"Response JSON does not contain expected matches/comparisons keys. Full response: {data}"

    # Validate matches is a list
    assert isinstance(matches, list), f"Expected matches to be a list, got {type(matches)}"

    # For the "no comparable matches" case, matches should be empty or contain very few items — require empty here
    assert len(matches) == 0, f"Expected no comparable matches, but found {len(matches)} matches"

    # Ensure there is an informative message indicating no matches / limited matches
    message = None
    for key in ("message", "info", "note", "warning"):
        if key in data and isinstance(data[key], str):
            message = data[key]
            break

    assert message is not None, "Expected an informative message about no comparable matches but none was found"

    assert any(token in message.lower() for token in ("no match", "no matches", "no comparable", "limited", "none found")), (
        f"Informative message does not indicate 'no comparable matches': '{message}'"
    )

    # Validate source extraction and price handling (Flipkart price selection should prefer selling price)
    source = data.get("source") or data.get("product") or data.get("source_product") or {}
    assert isinstance(source, dict) and source, "Expected 'source' product details in response"

    site = source.get("site") or source.get("source") or source.get("origin")
    # Normalize site to lowercase string if present
    site_str = (site or "").lower()

    # Extract price candidates
    price = source.get("price")
    selling_price = source.get("selling_price") or source.get("offer_price") or source.get("current_price")
    mrp = source.get("mrp") or source.get("list_price")

    def to_float(v):
        if v is None:
            return None
        try:
            return float(v)
        except Exception:
            # Try to strip non-numeric characters
            import re
            nums = re.sub(r"[^\d.]+", "", str(v))
            try:
                return float(nums) if nums else None
            except Exception:
                return None

    price_f = to_float(price)
    selling_f = to_float(selling_price)
    mrp_f = to_float(mrp)

    # Price should be present and positive
    assert price_f is not None and price_f > 0, f"Extracted source price is missing or not positive: price={price}"

    # If the source is Flipkart, prefer selling_price over stale MRP/metadata
    if "flipkart" in site_str:
        if selling_f is not None:
            # price should match selling_price when selling_price is present
            assert abs(price_f - selling_f) < 0.001, (
                f"For Flipkart, expected 'price' to prefer 'selling_price'. price={price_f}, selling_price={selling_f}"
            )
        else:
            # If no selling_price provided, at least price should not equal a stale MRP if both present
            if mrp_f is not None:
                assert abs(price_f - mrp_f) > 0.001 or selling_f is None, (
                    f"Flipkart price appears to be stale MRP: price={price_f}, mrp={mrp_f}"
                )

    # If the source is Amazon, behavior is unchanged — just ensure a positive price exists
    if "amazon" in site_str:
        assert price_f > 0, "Amazon source price must be a positive number"

    print("Test TC002 passed: POST /api/products/compare with no comparable matches returned expected 200 and informative response.")


if __name__ == "__main__":
    try:
        test_post_products_compare_no_matches()
    except AssertionError as e:
        print(f"Test TC002 failed: {e}")
        sys.exit(1)
    except Exception as ex:
        print(f"Test TC002 encountered an unexpected error: {ex}")
        sys.exit(2)
    sys.exit(0)