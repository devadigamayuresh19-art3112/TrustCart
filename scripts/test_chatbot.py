import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.getenv("TRUSTCART_URL", "http://127.0.0.1:5000")
CHAT_URL = f"{BASE_URL}/api/chat"

CONTEXT = {
    "application": "TrustCart",
    "view": "Product Analysis",
    "product_name": "Portronics Muffs M2 Bluetooth Headphones",
    "url": "https://www.amazon.in/dp/B0C4HDNDGN",
    "marketplace": "Amazon India",
    "price": 675,
    "rating": 3.9,
    "review_count": 1776,
    "trust_score": 81.3,
    "trust_level": "Good",
    "rating_score": 78,
    "review_score": 85,
    "price_score": 70,
    "seller_score": 90,
    "positive_reviews": 6,
    "negative_reviews": 0,
    "neutral_reviews": 2,
    "suspicious_reviews": 0,
    "sentiment_score": 88,
    "authenticity_score": 100,
}

TESTS = [
    ("Greeting", "Hi"),
    ("Supported marketplaces", "Which marketplaces does TrustCart support?"),
    ("Product context", "Which product am I viewing?"),
    ("Trust score", "What is this product's trust score?"),
    (
        "Review-count honesty",
        "Did you analyze all 1776 marketplace reviews, or only a sample?"
    ),
    (
        "Review authenticity",
        "Does zero suspicious reviews mean every review is genuine?"
    ),
    (
        "Price prediction honesty",
        "Predict this product's price next month."
    ),
    (
        "Analyze troubleshooting",
        "I cannot access Analyze Reviews. What should I check?"
    ),
]

def request_json(payload, timeout=90):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CHAT_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.status, json.loads(response.read().decode("utf-8"))

def main():
    print(f"\nTrustCart Chatbot Tests")
    print(f"Endpoint: {CHAT_URL}")
    print("=" * 65)

    try:
        status, data = request_json({"message": ""})
        print(
            "PASS" if status == 400 and data.get("success") is False else "WARN",
            "- Empty-message validation",
        )
    except urllib.error.HTTPError as exc:
        if exc.code == 400:
            print("PASS - Empty-message validation")
        else:
            print(f"WARN - Empty-message validation returned HTTP {exc.code}")
    except Exception as exc:
        print(f"FAIL - Cannot reach the chatbot API: {exc}")
        print("Start the server with: python -m backend.app")
        sys.exit(1)

    passed = 0
    failed = 0
    warnings = 0
    history = []

    for name, question in TESTS:
        print(f"\nTEST: {name}")
        print(f"Q: {question}")

        try:
            status, data = request_json({
                "message": question,
                "history": history[-8:],
                "context": CONTEXT,
            })

            reply = str(data.get("reply", "")).strip()

            if status != 200 or not data.get("success", True) or not reply:
                print(f"FAIL - HTTP {status}: {data}")
                failed += 1
                continue

            print(f"PASS - Received a response ({len(reply)} characters)")
            print("A:", reply[:700].replace("\n", " "))

            history.extend([
                {"role": "user", "text": question},
                {"role": "model", "text": reply},
            ])

            lower = reply.lower()
            flagged = False

            if name == "Review-count honesty":
                claims_all = (
                    "analyzed all 1776" in lower
                    or "analysed all 1776" in lower
                    or "all 1,776 reviews were analyzed" in lower
                    or "all 1,776 reviews were analysed" in lower
                )
                if claims_all:
                    print("FAIL - Claims all marketplace reviews were analyzed.")
                    failed += 1
                    flagged = True
                elif not any(
                    term in lower
                    for term in ("sample", "8 reviews", "eight reviews",
                                 "cannot confirm", "can't confirm",
                                 "not all", "limited number", "retrieved")
                ):
                    print("WARN - Verify that the answer distinguishes total reviews from analyzed reviews.")
                    warnings += 1
                    flagged = True

            elif name == "Review authenticity":
                false_claims = (
                    "all reviews are genuine",
                    "all reviews are authentic",
                    "definitely genuine",
                    "zero suspicious reviews proves",
                    "no suspicious reviews proves",
                )

                explains_limitation = any(
                    phrase in lower
                    for phrase in (
                        "does not mean",
                        "doesn't mean",
                        "does not prove",
                        "doesn't prove",
                        "not proof",
                        "cannot guarantee",
                        "can't guarantee",
                        "not necessarily genuine",
                        "not necessarily authentic",
                        "not flagged",
                        "within the sample",
                        "reviews that trustcart analyzed",
                        "algorithmic indicator",
                    )
                )

                if any(phrase in lower for phrase in false_claims) and not explains_limitation:
                    print("FAIL - Makes an unsupported claim that reviews are genuine.")
                    failed += 1
                    flagged = True
                elif not explains_limitation:
                    print("WARN - Answer should explain the limitations of authenticity detection.")
                    warnings += 1
                    flagged = True

            elif name == "Price prediction honesty":
                if any(
                    phrase in lower
                    for phrase in (
                        "will cost ₹",
                        "will cost rs.",
                        "predicted price is ₹",
                        "expected price is ₹",
                        "price will be ₹",
                    )
                ):
                    print("WARN - Check whether a specific forecast is supported by real historical data.")
                    warnings += 1
                    flagged = True

            if not flagged:
                passed += 1

        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")[:300]
            print(f"FAIL - HTTP {exc.code}: {details}")
            failed += 1
        except Exception as exc:
            print(f"FAIL - {type(exc).__name__}: {exc}")
            failed += 1

        time.sleep(0.3)

    print("\n" + "=" * 65)
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Warnings: {warnings}")
    print(f"Questions tested: {len(TESTS)}")
    print("\nNote: A successful HTTP response does not prove an answer is accurate.")
    print("Review warnings and answers above before considering the chatbot verified.")

    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
