import requests
import sys
import re

BASE_URL = "http://localhost:5000"
TIMEOUT = 30  # seconds

def parse_price(value):
    """
    Convert a price value (number or string like '₹1,234.00', '1234', 1234) to float.
    Returns None if value is None or cannot be parsed.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove currency symbols and non-numeric characters except dot and minus
        s = value.strip()
        # Replace unicode non-breaking spaces
        s = s.replace('\u00A0', '')
        # Keep digits, dots, and minus
        s = re.sub(r'[^0-9\.\-]', '', s)
        if s == '':
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None

def test_get_products_discover_with_valid_keyword():
    url = f"{BASE_URL}/api/products/discover"
    params = {"keyword": "wireless headphones"}
    try:
        resp = requests.get(url, params=params, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Basic response checks
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}, body: {resp.text}"

    # Ensure JSON response
    try:
        body = resp.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    # Normalize candidates list: body can be a list or a dict containing 'candidates' or 'data'
    if isinstance(body, list):
        candidates = body
    elif isinstance(body, dict):
        if "candidates" in body and isinstance(body["candidates"], list):
            candidates = body["candidates"]
        elif "data" in body and isinstance(body["data"], list):
            candidates = body["data"]
        else:
            # Attempt to find the first list value in the dict
            candidates = None
            for v in body.values():
                if isinstance(v, list):
                    candidates = v
                    break
            if candidates is None:
                raise AssertionError("Response JSON does not contain a candidates list")
    else:
        raise AssertionError("Response JSON is not a list or object containing a candidates list")

    assert len(candidates) > 0, "Expected at least one candidate product in discovery response"

    # Collect sources
    amazon_candidates = []
    flipkart_candidates = []
    for c in candidates:
        # Each candidate should be a dict
        if not isinstance(c, dict):
            continue
        source = None
        # source might be under 'source', 'marketplace', or 'site'
        for k in ("source", "marketplace", "site"):
            if k in c:
                source = str(c[k]).lower()
                break
        # Fallback: detect from URL if present
        if not source:
            url_field = c.get("url") or c.get("product_url") or c.get("link")
            if isinstance(url_field, str):
                if "flipkart.com" in url_field.lower():
                    source = "flipkart"
                elif "amazon." in url_field.lower():
                    source = "amazon"
        if source and "flipkart" in source:
            flipkart_candidates.append(c)
        elif source and "amazon" in source:
            amazon_candidates.append(c)

    assert len(amazon_candidates) > 0, "Expected at least one Amazon candidate"
    assert len(flipkart_candidates) > 0, "Expected at least one Flipkart candidate"

    # Validate Flipkart price selection prefers selling_price over stale mrp/metadata
    flipkart_with_selling = 0
    for c in flipkart_candidates:
        # Candidate canonical price field is expected to be 'price'
        assert "price" in c, f"Flipkart candidate missing 'price' field: {c}"
        price_val = parse_price(c.get("price"))

        # Look for selling_price in various possible keys
        selling_price_raw = None
        for key in ("selling_price", "sellingPrice", "current_price", "best_price"):
            if key in c:
                selling_price_raw = c.get(key)
                break
        # Also check nested pricing metadata
        if selling_price_raw is None and isinstance(c.get("pricing"), dict):
            for key in ("selling_price", "sellingPrice", "current_price", "best_price"):
                if key in c["pricing"]:
                    selling_price_raw = c["pricing"].get(key)
                    break

        mrp_raw = None
        for key in ("mrp", "list_price", "original_price"):
            if key in c:
                mrp_raw = c.get(key)
                break
        if mrp_raw is None and isinstance(c.get("pricing"), dict):
            for key in ("mrp", "list_price", "original_price"):
                if key in c["pricing"]:
                    mrp_raw = c["pricing"].get(key)
                    break

        selling_price = parse_price(selling_price_raw)
        mrp_price = parse_price(mrp_raw)

        if selling_price is not None:
            flipkart_with_selling += 1
            # price must equal selling_price (preference enforced)
            assert price_val is not None, f"Flipkart candidate price could not be parsed: {c}"
            assert abs(price_val - selling_price) < 0.01, (
                f"Flipkart candidate price ({price_val}) must equal selling_price ({selling_price}) for candidate: {c}"
            )
            # If mrp present, selling_price should not exceed mrp (stale MRP shouldn't be preferred)
            if mrp_price is not None:
                assert selling_price <= mrp_price + 0.01, (
                    f"Flipkart selling_price ({selling_price}) is greater than mrp ({mrp_price}), unexpected: {c}"
                )

    assert flipkart_with_selling > 0, "No Flipkart candidate included a selling_price to validate preference over MRP/metadata"

    # Validate Amazon behavior remains unchanged: ensure amazon candidates have a price field and it's parsable
    for c in amazon_candidates:
        assert "price" in c, f"Amazon candidate missing 'price' field: {c}"
        price_val = parse_price(c.get("price"))
        assert price_val is not None, f"Amazon candidate price is not parsable: {c}"
        # Do not enforce any selling_price vs mrp constraints for Amazon (behavior unchanged)

if __name__ == "__main__":
    try:
        test_get_products_discover_with_valid_keyword()
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TEST ERROR: Unexpected exception: {e}")
        sys.exit(2)
    print("TEST PASSED")