import requests
import sys

BASE_ENDPOINT = "http://localhost:5000"
TIMEOUT = 30

def test_post_products_compare_malformed_url():
    url = f"{BASE_ENDPOINT}/api/products/compare"
    # Use an unsupported domain to trigger validation for unsupported/malformed URL
    payload = {"url": "https://unsupported-site.example.com/product/abc123"}
    headers = {"Content-Type": "application/json"}

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Expect a 400 validation error for malformed/unsupported URL
    if resp.status_code != 400:
        # Include response body in failure for debugging
        raise AssertionError(f"Expected status 400, got {resp.status_code}. Response body: {resp.text}")

    # Ensure response is JSON and contains a meaningful error message
    try:
        data = resp.json()
    except ValueError:
        raise AssertionError(f"Expected JSON response for 400 error, got: {resp.text}")

    # Find a likely message field
    message_fields = ['message', 'error', 'errors', 'detail', 'error_message']
    found_msg = None
    for key in message_fields:
        if key in data:
            found_msg = data[key]
            break

    # Some APIs nest errors under a top-level 'errors' list or dict
    if found_msg is None and isinstance(data.get('errors'), list) and data['errors']:
        found_msg = data['errors'][0]
    if found_msg is None and isinstance(data.get('errors'), dict):
        # join values if dict of lists/strings
        val = data['errors']
        if isinstance(val, dict):
            # take first value
            first = next(iter(val.values()), None)
            if isinstance(first, list):
                found_msg = first[0] if first else None
            else:
                found_msg = first

    if not found_msg:
        raise AssertionError(f"No error message found in response JSON: {data}")

    # Normalize and assert the message is meaningful about unsupported/malformed URL
    if isinstance(found_msg, (list, dict)):
        # convert to string for checking
        msg_text = str(found_msg)
    else:
        msg_text = str(found_msg)
    msg_lower = msg_text.lower()

    expected_keywords = [
        "unsupported",
        "malformed",
        "could not",
        "couldn't",
        "invalid",
        "could not be processed",
        "unsupported url",
        "unsupported site",
        "not supported",
        "unrecognized",
    ]

    if not any(keyword in msg_lower for keyword in expected_keywords):
        raise AssertionError(f"Error message does not indicate unsupported/malformed URL. Message: {msg_text}")

    print("TC003 passed: malformed/unsupported URL correctly returned 400 with meaningful error message.")

if __name__ == "__main__":
    try:
        test_post_products_compare_malformed_url()
    except AssertionError as e:
        print(f"TC003 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC003 encountered an unexpected exception: {e}")
        sys.exit(2)
    sys.exit(0)