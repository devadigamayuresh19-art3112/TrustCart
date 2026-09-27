import requests

BASE_URL = "http://localhost:5000"
DISCOVER_PATH = "/api/products/discover"
TIMEOUT = 30
HEADERS = {"Accept": "application/json"}


def test_get_products_discover_invalid_or_missing_keyword():
    """
    Test GET /api/products/discover with missing, empty, and invalid keyword values.
    - Expect an error response (HTTP status >= 400) with a meaningful message for invalid/missing input.
    - If the server unexpectedly returns 200 with candidate results, validate response shape and
      enforce Flipkart price selection: prefer 'selling_price' over stale 'mrp' / metadata.
      Amazon behavior is not asserted/changed.
    """
    url = BASE_URL.rstrip("/") + DISCOVER_PATH
    test_variants = [
        ("missing_keyword", None),
        ("empty_keyword", ""),
        ("invalid_keyword", "@@@###invalid$$$"),
    ]

    for name, keyword in test_variants:
        params = None if keyword is None else {"keyword": keyword}
        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        except requests.exceptions.RequestException as exc:
            assert False, f"HTTP request failed for case '{name}': {exc}"

        # If server returns an error status, validate error payload contains a meaningful message
        if resp.status_code >= 400:
            try:
                body = resp.json()
            except ValueError:
                # Non-JSON error body is unacceptable for this API
                assert False, f"Expected JSON error body for case '{name}', got: {resp.text!r}"

            # Try to extract an explanatory message
            message = None
            for key in ("error", "message", "detail", "errors"):
                if isinstance(body, dict) and key in body:
                    message = body[key]
                    break
            # If body itself is a non-empty string
            if message is None and isinstance(body, str) and body.strip():
                message = body

            assert message, f"Error response for case '{name}' must include a meaningful message; got: {body!r}"
            # Message should indicate invalid input or discovery failure
            msg_text = str(message).lower()
            assert any(k in msg_text for k in ("keyword", "invalid", "missing", "discov")), (
                f"Error message for case '{name}' should indicate invalid input or discovery failure, got: {message!r}"
            )

        else:
            # Server returned 200 OK unexpectedly. Validate response structure and Flipkart price handling.
            try:
                body = resp.json()
            except ValueError:
                assert False, f"Expected JSON body for successful response in case '{name}', got: {resp.text!r}"

            # Determine candidate list location
            candidates = None
            if isinstance(body, list):
                candidates = body
            elif isinstance(body, dict):
                for key in ("candidates", "results", "items", "products", "data"):
                    if key in body and isinstance(body[key], list):
                        candidates = body[key]
                        break

            assert isinstance(candidates, list), f"Successful response for case '{name}' must include a candidate list"

            # Validate candidate entries and Flipkart price selection
            for cand in candidates:
                assert isinstance(cand, dict), f"Each candidate must be an object, got {type(cand)}"
                # required fields
                for required in ("name", "source", "price", "url"):
                    assert required in cand, f"Candidate missing required field '{required}' in case '{name}': {cand!r}"
                src = str(cand.get("source", "")).lower()
                if src == "flipkart":
                    # If a Flipkart listing exposes a 'selling_price', ensure the returned 'price' equals it.
                    if "selling_price" in cand:
                        assert cand["price"] == cand["selling_price"], (
                            f"Flipkart candidate price must prefer 'selling_price' over stale MRP/metadata. Candidate: {cand.get('url')}"
                        )
            # If we reach here, the unexpected success response still conforms to pricing rules.
        # End of single variant loop

    print("test_get_products_discover_invalid_or_missing_keyword: PASSED")


if __name__ == "__main__":
    test_get_products_discover_invalid_or_missing_keyword()