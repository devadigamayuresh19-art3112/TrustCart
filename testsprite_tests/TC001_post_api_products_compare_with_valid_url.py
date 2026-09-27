import requests
import sys

BASE_URL = "http://localhost:5000"
COMPARE_PATH = "/api/products/compare"
TIMEOUT = 30

# Replace this with a real Flipkart product URL suitable for your environment.
FLIPKART_PRODUCT_URL = "https://www.flipkart.com/sample-product/p/itmexample"

def test_post_products_compare_with_valid_flipkart_url():
    url = BASE_URL.rstrip("/") + COMPARE_PATH
    headers = {"Content-Type": "application/json"}
    payload = {"url": FLIPKART_PRODUCT_URL}

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request to {url} failed: {exc}")

    # Basic status code check
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}, body={resp.text}"

    # Validate JSON response
    try:
        data = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {resp.text}")

    # Ensure top-level contains extracted product details and matched listings
    # Accept multiple possible field names for extracted product
    product = None
    for key in ("product", "analysis", "extracted", "product_analysis"):
        if key in data:
            product = data[key]
            break
    assert product is not None, f"Response JSON missing extracted product object (tried keys product/analysis/extracted). Full response: {data}"

    # Validate product fields presence per PRD
    for field in ("name", "brand", "model", "price", "category", "source", "url"):
        assert field in product, f"Extracted product missing required field '{field}'. product={product}"

    # Validate the source is Flipkart (since we provided a Flipkart URL)
    source = product.get("source", "").lower()
    assert "flipkart" in source, f"Expected extracted product source to be Flipkart, got '{product.get('source')}'"

    # Ensure there is a list of matched marketplace listings
    matches = None
    for key in ("matches", "listings", "candidates", "comparisons"):
        if key in data:
            matches = data[key]
            break
    assert isinstance(matches, list), f"Response missing matches/listings array. Found keys: {list(data.keys())}"

    # At least one match is expected (could be zero in some cases; assert presence to meet test intent)
    assert len(matches) > 0, f"Expected at least one matched listing, got 0. matches={matches}"

    # Price selection validation for Flipkart listings:
    # Ensure that Flipkart listings prefer actual selling price over stale MRP/metadata.
    # We'll check each listing that claims to be from Flipkart.
    flipkart_found = False
    for listing in matches:
        # tolerant access
        listing_source = (listing.get("source") or listing.get("marketplace") or "").lower()
        if "flipkart" in listing_source:
            flipkart_found = True
            # If a distinct selling price field is present, price should equal it
            selling_price = listing.get("selling_price") or listing.get("current_price") or listing.get("offer_price")
            reported_price = listing.get("price") or listing.get("amount")
            mrp = listing.get("mrp") or listing.get("list_price") or listing.get("metadata_price")

            if selling_price is not None:
                # normalize numeric strings to number when possible
                try:
                    sp_val = float(str(selling_price).replace(",", "").replace("₹", "").strip())
                    rp_val = float(str(reported_price).replace(",", "").replace("₹", "").strip())
                    assert rp_val == sp_val, f"Flipkart listing price should prefer selling_price. price={reported_price}, selling_price={selling_price}, listing={listing}"
                except Exception:
                    # If cannot parse numbers, fall back to equality check
                    assert str(reported_price) == str(selling_price), f"Flipkart listing price should equal selling_price. price={reported_price}, selling_price={selling_price}, listing={listing}"
            if mrp is not None and reported_price is not None:
                # reported price should not be equal to stale mrp if selling price differs
                try:
                    mrp_val = float(str(mrp).replace(",", "").replace("₹", "").strip())
                    rp_val = float(str(reported_price).replace(",", "").replace("₹", "").strip())
                    assert rp_val <= mrp_val, f"Reported price ({reported_price}) should be <= mrp ({mrp}) for Flipkart listing."
                    # Prefer actual selling price over stale mrp: fail if reported price equals mrp exactly and we also have evidence of selling_price differing
                    if selling_price is not None:
                        sp_val = float(str(selling_price).replace(",", "").replace("₹", "").strip())
                        assert not (rp_val == mrp_val and sp_val != mrp_val), f"Flipkart price selection appears to prefer stale MRP over actual selling price. price={reported_price}, mrp={mrp}, selling_price={selling_price}"
                except ValueError:
                    # Non-numeric values; perform a best-effort string check
                    if selling_price is not None:
                        assert not (str(reported_price) == str(mrp) and str(selling_price) != str(mrp)), (
                            f"Flipkart price selection appears to prefer stale MRP over actual selling price. price={reported_price}, mrp={mrp}, selling_price={selling_price}"
                        )

    assert flipkart_found, f"No Flipkart listings found in matches; expected at least one flipkart match. matches={matches}"

    # Additionally, verify Amazon listings remain unchanged in behavior: if amazon listings exist, ensure no forced preference logic was applied to their price fields.
    for listing in matches:
        listing_source = (listing.get("source") or listing.get("marketplace") or "").lower()
        if "amazon" in listing_source:
            # For Amazon, we do not enforce that price equals selling_price; just ensure a price exists and is numeric-ish
            reported_price = listing.get("price") or listing.get("amount")
            assert reported_price is not None, f"Amazon listing missing price field: {listing}"
            # Try parsing price to ensure it's a current-looking price
            try:
                _ = float(str(reported_price).replace(",", "").replace("₹", "").strip())
            except Exception:
                # if parsing fails, still accept but warn via assertion (we'll make it non-fatal by allowing string)
                pass

    print("TC001 passed: POST /api/products/compare returned 200 and validated Flipkart price selection behavior.")

if __name__ == "__main__":
    try:
        test_post_products_compare_with_valid_flipkart_url()
    except AssertionError as e:
        print(f"Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during test execution: {e}")
        sys.exit(2)
    sys.exit(0)