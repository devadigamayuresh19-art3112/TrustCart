import requests
import re
import sys

BASE_URL = "http://localhost:5000"
ANALYZE_PATH = "/api/products/analyze"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def _parse_price(value):
    """
    Try to convert various price representations to a float.
    Returns None if it cannot be parsed.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    # Remove common currency symbols and whitespace
    s = value.strip()
    s = re.sub(r"[^\d.,]", "", s)  # keep digits, dot, comma
    # If there are both comma and dot, assume dot is decimal separator and remove commas
    if "," in s and "." in s:
        s = s.replace(",", "")
    # If only commas present, treat commas as thousand separators
    if "," in s and "." not in s:
        s = s.replace(",", "")
    # Normalize empty string
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _assert_common_fields(data, input_url):
    # Basic structure checks
    assert isinstance(data, dict), "Response JSON is not an object"
    required_fields = ["name", "brand", "model", "price", "category", "source", "url"]
    for f in required_fields:
        assert f in data, f"Missing required field '{f}' in response"
    # Validate types/contents
    assert data["name"], "name must be non-empty"
    assert data["brand"], "brand must be non-empty"
    assert data["category"], "category must be non-empty"
    assert data["url"], "url must be non-empty"
    # Source should indicate marketplace
    assert isinstance(data["source"], str) and data["source"].strip(), "source must be a non-empty string"
    # URL should match or contain input URL
    assert input_url in data["url"] or data["url"] in input_url or data["url"].startswith("http"), "returned url seems invalid"


def test_post_products_analyze_valid_url():
    """
    Performs POST /api/products/analyze for a Flipkart and an Amazon product URL.
    Validates 200 response and presence of required metadata fields.
    Additionally validates Flipkart price selection prefers actual selling price over stale MRP/metadata if such fields are present.
    """
    # Example product URLs (marketplace pages). These are representative; adjust if necessary for your environment.
    flipkart_url = "https://www.flipkart.com/apple-iphone-13/p/itmfa3f8b6e3b5a4"
    amazon_url = "https://www.amazon.in/dp/B08N5WRWNW"

    session = requests.Session()

    # Helper to call endpoint and validate core fields
    def call_and_validate(input_url):
        payload = {"url": input_url}
        try:
            resp = session.post(
                BASE_URL + ANALYZE_PATH, json=payload, headers=HEADERS, timeout=TIMEOUT
            )
        except requests.RequestException as e:
            raise AssertionError(f"Request to analyze endpoint failed for {input_url}: {e}")
        assert resp.status_code == 200, f"Expected 200 OK for {input_url}, got {resp.status_code}: {resp.text}"
        try:
            data = resp.json()
        except ValueError:
            raise AssertionError(f"Response for {input_url} is not valid JSON: {resp.text}")
        _assert_common_fields(data, input_url)
        return data

    # 1) Test Flipkart analysis and price extraction behavior
    fk_data = call_and_validate(flipkart_url)

    # Ensure source identifies flipkart
    assert "flipkart" in fk_data["source"].lower() or "flipkart" in fk_data["url"].lower(), (
        f"Flipkart test: source does not indicate Flipkart: {fk_data.get('source')}"
    )

    # Validate price exists and is parsable
    fk_price = _parse_price(fk_data.get("price"))
    assert fk_price is not None, f"Flipkart price could not be parsed: {fk_data.get('price')}"

    # If MRP-like or metadata price fields exist in response, ensure the reported price is not the stale MRP
    # Accept common keys that might be present: 'mrp', 'list_price', 'metadata_price', 'original_price'
    mrp_keys = ["mrp", "list_price", "metadata_price", "original_price"]
    for k in mrp_keys:
        if k in fk_data and fk_data[k] not in (None, ""):
            mrp_val = _parse_price(fk_data[k])
            if mrp_val is not None:
                # Flipkart selling price should prefer actual selling price over stale MRP.
                # We assert that price != mrp. If mrp equals price, that suggests stale price chosen.
                assert abs(fk_price - mrp_val) > 0.001, (
                    f"Flipkart price equals reported '{k}' ({fk_data[k]}). Expected selling price to differ from stale MRP/metadata."
                )

    # 2) Test Amazon analysis (behavior unchanged)
    amz_data = call_and_validate(amazon_url)

    # Ensure source identifies amazon
    assert "amazon" in amz_data["source"].lower() or "amazon" in amz_data["url"].lower(), (
        f"Amazon test: source does not indicate Amazon: {amz_data.get('source')}"
    )

    # Validate price exists and is parsable
    amz_price = _parse_price(amz_data.get("price"))
    assert amz_price is not None, f"Amazon price could not be parsed: {amz_data.get('price')}"

    # For Amazon, do not enforce Flipkart-specific price rules. Ensure fields are present and reasonable.
    # If Amazon provides an 'mrp' field, we do not assert any relation between amz_price and mrp (leave behavior unchanged).

    # Final smoke checks: names/brands/models should be strings and not extremely short
    assert isinstance(fk_data["name"], str) and len(fk_data["name"].strip()) >= 3
    assert isinstance(fk_data["brand"], str) and len(fk_data["brand"].strip()) >= 2
    assert isinstance(amz_data["name"], str) and len(amz_data["name"].strip()) >= 3
    assert isinstance(amz_data["brand"], str) and len(amz_data["brand"].strip()) >= 2

    print("TC004 passed: /api/products/analyze returns required metadata for Flipkart and Amazon and Flipkart price selection validated.")


if __name__ == "__main__":
    try:
        test_post_products_analyze_valid_url()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as ex:
        print("UNEXPECTED ERROR:", ex)
        sys.exit(2)
    sys.exit(0)