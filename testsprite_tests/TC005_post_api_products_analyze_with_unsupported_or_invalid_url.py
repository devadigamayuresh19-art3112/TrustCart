import requests
import json
import sys

BASE_URL = "http://localhost:5000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def _extract_message_from_json(data):
    # Try common keys
    for key in ("error", "message", "detail", "description", "errors"):
        if key in data:
            val = data[key]
            if isinstance(val, (dict, list)):
                try:
                    return json.dumps(val)
                except Exception:
                    return str(val)
            return str(val)
    # Fallback to whole JSON
    try:
        return json.dumps(data)
    except Exception:
        return str(data)


def test_post_products_analyze_unsupported_or_invalid_url():
    """
    Test POST /api/products/analyze with:
      - an unsupported website URL
      - a malformed URL string
    Expect a 400 response and an error message indicating unsupported or malformed URL.
    """
    unsupported_url = "https://unsupported-website.example.com/product/12345"
    malformed_url = "not-a-url"

    expected_keywords = [
        "unsupported",
        "malformed",
        "invalid",
        "not supported",
        "could not be processed",
        "cannot be processed",
        "cannot process",
        "unsupported website",
        "invalid url",
        "invalid URL",
        "unsupported URL",
    ]

    # Helper to perform request and validate response
    def _assert_400_and_message(payload_url):
        try:
            resp = requests.post(
                f"{BASE_URL}/api/products/analyze",
                headers=HEADERS,
                json={"url": payload_url},
                timeout=TIMEOUT,
            )
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"Request to /api/products/analyze failed: {e}")

        if resp.status_code != 400:
            raise AssertionError(
                f"Expected status 400 for url '{payload_url}', got {resp.status_code}. Response body: {resp.text}"
            )

        try:
            data = resp.json()
        except ValueError:
            raise AssertionError(f"Expected JSON error body for url '{payload_url}', got: {resp.text}")

        message = _extract_message_from_json(data)
        message_lower = message.lower()

        if not any(keyword in message_lower for keyword in expected_keywords):
            raise AssertionError(
                f"Error message for url '{payload_url}' does not indicate unsupported or malformed URL. Message: {message}"
            )

    # Test unsupported website URL
    _assert_400_and_message(unsupported_url)

    # Test malformed URL
    _assert_400_and_message(malformed_url)

    print("TC005 passed: unsupported and malformed URL tests returned 400 with appropriate error messages.")


if __name__ == "__main__":
    try:
        test_post_products_analyze_unsupported_or_invalid_url()
    except AssertionError as e:
        print(f"TC005 failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as ex:
        print(f"TC005 encountered an unexpected exception: {ex}", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)