import unittest
from unittest.mock import patch

from bs4 import BeautifulSoup

from backend.fetchers.generic import GenericProductFetcher


class TestPriceExtraction(unittest.TestCase):
    def test_flipkart_prefers_main_selling_price_over_other_rupee_values(self):
        html = """
        <html><body>
          <div class="Nx9bqj">₹ 361</div>
          <div class="_30jeq3">₹ 1,299</div>
        </body></html>
        """

        fetcher = GenericProductFetcher()
        price = fetcher._extract_flipkart_price(BeautifulSoup(html, "html.parser"))

        self.assertEqual(price, 1299.0)

    def test_amazon_prefers_visible_offer_price_over_stale_jsonld(self):
        html = """
        <html><head>
          <script type="application/ld+json">
            {"@type":"Product","offers":{"price":"1499.00","priceCurrency":"INR"}}
          </script>
        </head><body>
          <div id="priceblock_ourprice">₹ 1,299</div>
        </body></html>
        """

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.amazon.in/example")

        self.assertEqual(product["price"], 1299.0)

    def test_amazon_extracts_price_to_pay_whole_and_ignores_recommendations_and_mrp(self):
        html = """
        <html><head>
          <script type="application/ld+json">
            {"@type":"Product","offers":{"price":"1499.00","priceCurrency":"INR"}}
          </script>
        </head><body>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price priceToPay">
              <span class="a-offscreen"> </span>
              <span aria-hidden="true"><span class="a-price-symbol">₹</span><span class="a-price-whole">2,249</span></span>
            </span>
            <span class="a-price a-text-price basisPrice">
              <span class="a-offscreen">₹3,999</span>
            </span>
          </div>
          <div class="sims-simsContainer">
            <span class="a-price"><span class="a-offscreen">₹1,499.00</span></span>
          </div>
        </body></html>
        """

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.amazon.in/example")

        self.assertEqual(product["price"], 2249.0)
        self.assertEqual(product.get("mrp"), 3999.0)

    def test_detects_amazon_bot_challenge_page(self):
        html = """
        <html><body>
          <h4>Click the button below to continue shopping</h4>
        </body></html>
        """

        fetcher = GenericProductFetcher()

        self.assertTrue(
            fetcher._is_bot_challenge(
                html,
                "https://www.amazon.in/example"
            )
        )

    def test_rejects_discount_rupee_text_like_rupee_one(self):
        fetcher = GenericProductFetcher()

        self.assertIsNone(
            fetcher._extract_price_from_text("Save ₹1")
        )

    def test_flipkart_uses_embedded_selling_price_when_dom_price_is_missing(self):
        html = r'''
        <html><body>
          <script>
            window.__INITIAL_STATE__ = {"sellingPrice":"\\u20b91,299.50",
              "mrp":"\\u20b92,499.00"};
          </script>
        </body></html>
        '''

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.flipkart.com/item/p/itm123")

        self.assertEqual(product["price"], 1299.50)

    def test_recognizes_flipkart_short_and_deep_link_hosts(self):
        fetcher = GenericProductFetcher()

        self.assertTrue(fetcher._is_flipkart_url("https://fkrt.it/abc123"))
        self.assertTrue(fetcher._is_flipkart_url("https://dl.flipkart.com/s/abc123"))

    def test_flipkart_current_price_class_beats_struck_mrp(self):
        html = '''
        <html><body>
          <div class="CxhGGd">₹ 899.00</div>
          <div class="_3I9_wc">₹ 1,499.00</div>
        </body></html>
        '''

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.flipkart.com/item/p/itm123")

        self.assertEqual(product["price"], 899.00)
        self.assertEqual(product["mrp"], 1499.00)

    def test_flipkart_prefers_visible_discounted_selling_price_over_stale_metadata(self):
        html = '''
        <html><body>
          <div class="CxhGGd">
            <div>58% OFF</div>
            <div>₹ 2,499</div>
            <div>₹ 1,049</div>
          </div>
          <script type="application/ld+json">
            {"@type":"Product","offers":{"price":"1416","priceCurrency":"INR"}}
          </script>
          <script>
            window.__INITIAL_STATE__ = {"ppd":{"fsp":1416,"finalPrice":1416,"mrp":2499,"nepPrice":1345,"specialPrice":true}};
          </script>
        </body></html>
        '''

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.flipkart.com/item/p/itm123")

        self.assertEqual(product["price"], 1049.0)

    def test_fetch_uses_redirected_flipkart_url_for_extraction(self):
        class RedirectedResponse:
            text = '<h1>Example</h1><div class="CxhGGd">₹ 999.99</div>'
            url = "https://www.flipkart.com/example/p/itm123"

            def raise_for_status(self):
                return None

        with patch(
            "backend.fetchers.generic.requests.get",
            return_value=RedirectedResponse(),
        ):
            product = GenericProductFetcher().fetch("https://fkrt.it/example")

        self.assertEqual(product["price"], 999.99)

    def test_flipkart_prefers_title_identity_over_bogus_brand_metadata(self):
        html = '''
        <html>
          <head>
            <title>PTROX N80 Vibration Alert 48 Hours Playtime Pure Bass Waterproof Neckband C36 Bluetooth Price in India - Buy PTROX N80 Vibration Alert 48 Hours Playtime Pure Bass Waterproof Neckband C36 Bluetooth Online - PTROX : Flipkart.com</title>
            <script type="application/ld+json">
            [{"@type":"Product","name":"MR.NOBODY N80 Vibration Alert 48 Hours Playtime Cancellation Waterproof Neckband B36 Bluetooth","brand":{"name":"MR.NOBODY"},"model":"MR NOBODY N80","category":"headphone","offers":{"price":"469","priceCurrency":"INR","availability":"https://schema.org/InStock"}}]
            </script>
          </head>
          <body>
            <div class="_30jeq3">₹ 469</div>
          </body>
        </html>
        '''

        fetcher = GenericProductFetcher()
        product = fetcher._parse_html(html, "https://www.flipkart.com/ptrox-n80-vibration-alert-48-hours-playtime-pure-bass-waterproof-neckband-c36-bluetooth/p/itm123")

        self.assertEqual(product["name"], "PTROX N80 Vibration Alert 48 Hours Playtime Pure Bass Waterproof Neckband C36 Bluetooth Price in India - Buy PTROX N80 Vibration Alert 48 Hours Playtime Pure Bass Waterproof Neckband C36 Bluetooth Online - PTROX : Flipkart.com")
        self.assertEqual(product["brand"], "PTROX")
        self.assertIn("N80", product["model"])
        self.assertNotIn("MR.NOBODY", str(product["brand"]))

    def test_normalizes_tracking_parameters_for_flipkart_and_amazon_urls(self):
        fetcher = GenericProductFetcher()

        self.assertEqual(
            fetcher._canonicalize_url(
                "https://www.flipkart.com/item/p/itm123?pid=ABC123&utm_source=google&marketplace=FLIPKART"
            ),
            "https://www.flipkart.com/item/p/itm123"
        )
        self.assertEqual(
            fetcher._canonicalize_url(
                "https://www.amazon.in/dp/B0ABC12345/ref=sr_1_1_sspa?keywords=headphones&utm_source=google"
            ),
            "https://www.amazon.in/dp/B0ABC12345"
        )


if __name__ == "__main__":
    unittest.main()
