from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory,
    session,
    redirect,
    render_template
)

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

import psycopg2
from psycopg2 import errors
import os
import requests

from urllib.parse import urlparse
from dotenv import load_dotenv

try:
    from .fetchers.generic import GenericProductFetcher
    from .processors.canonical import CanonicalProductGenerator
    from .pipeline.comparison_pipeline import ComparisonPipeline
except ImportError:  # supports `python backend/app.py`
    from fetchers.generic import GenericProductFetcher
    from processors.canonical import CanonicalProductGenerator
    from pipeline.comparison_pipeline import ComparisonPipeline


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

FRONTEND_DIR = os.path.join(
    BASE_DIR,
    "frontend"
)

PAGES_DIR = os.path.join(
    FRONTEND_DIR,
    "Pages"
)


# ============================================================
# FLASK APP
# ============================================================

app = Flask(
    __name__,
    template_folder=PAGES_DIR
)

app.secret_key = os.getenv("SECRET_KEY")
if not app.secret_key:
    app.secret_key = "trustcart-dev-secret-key"

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("FLASK_ENV", "development").lower() == "production"


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():

    return psycopg2.connect(
        host=os.getenv(
            "DB_HOST",
            "localhost"
        ),
        database=os.getenv(
            "DB_NAME",
            "TrustCart"
        ),
        user=os.getenv(
            "DB_USER",
            "postgres"
        ),
        password=os.getenv(
            "DB_PASSWORD",
            ""
        ),
        port=os.getenv(
            "DB_PORT",
            "5432"
        )
    )


# ============================================================
# URL VALIDATION
# ============================================================

def is_valid_url(url):

    try:

        parsed = urlparse(url)

        return (
            parsed.scheme in (
                "http",
                "https"
            )
            and bool(parsed.netloc)
        )

    except Exception:

        return False


def is_supported_marketplace_url(url):
    if not is_valid_url(url):
        return False

    host = urlparse(url).netloc.lower()

    return (
        "amazon." in host
        or host.endswith("amazon")
        or "flipkart.com" in host
        or "fkrt.it" in host
    )


def normalize_marketplace_url(url):
    if not is_valid_url(url):
        return str(url or "").strip()

    parsed = urlparse(url)
    clean_segments = []
    for segment in parsed.path.split("/"):
        if not segment:
            continue
        if segment.lower().startswith((
            "ref=",
            "keywords=",
            "tag=",
            "marketplace=",
            "utm_",
            "m=",
            "pd_rd_",
            "qid=",
        )):
            continue
        clean_segments.append(segment)

    cleaned = parsed._replace(
        path="/" + "/".join(clean_segments) if clean_segments else "/",
        query="",
        fragment=""
    )
    return cleaned.geturl()


# ============================================================
# CATEGORY HELPERS
# ============================================================

def get_category_id(
    connection,
    category_name
):

    if not category_name:
        return None

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM categories
        WHERE LOWER(name) = LOWER(%s)
        """,
        (
            category_name,
        )
    )

    row = cursor.fetchone()

    cursor.close()

    if row:
        return row[0]

    return None


def create_category_if_not_exists(
    connection,
    category_name
):

    if not category_name:
        return None

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM categories
        WHERE LOWER(name) = LOWER(%s)
        """,
        (
            category_name,
        )
    )

    row = cursor.fetchone()

    if row:

        cursor.close()

        return row[0]

    cursor.execute(
        """
        INSERT INTO categories(name)
        VALUES(%s)
        RETURNING id
        """,
        (
            category_name,
        )
    )

    category_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()

    return category_id


# ============================================================
# PRODUCT DATABASE HELPERS
# ============================================================

def find_product(
    connection,
    name,
    brand
):

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM products
        WHERE LOWER(name) = LOWER(%s)
        AND (
            LOWER(brand) = LOWER(%s)
            OR (
                brand IS NULL
                AND %s IS NULL
            )
        )
        LIMIT 1
        """,
        (
            name,
            brand,
            brand
        )
    )

    row = cursor.fetchone()

    cursor.close()

    if row:
        return row[0]

    return None


def save_product_to_database(
    canonical
):

    connection = None

    try:

        connection = get_db_connection()

        name = canonical.get(
            "product_name"
        )

        brand = canonical.get(
            "brand"
        )

        category = canonical.get(
            "category"
        )

        image_url = canonical.get(
            "image_url"
        )

        # ----------------------------------------------------
        # IMPORTANT:
        # Get the original product URL.
        #
        # Different pipeline stages may use different keys,
        # so check all common possibilities.
        # ----------------------------------------------------

        source_url = (
            canonical.get("source_url")
            or canonical.get("product_url")
            or canonical.get("url")
        )

        if not name:
            return None

        category_id = (
            create_category_if_not_exists(
                connection,
                category
            )
        )

        product_id = find_product(
            connection,
            name,
            brand
        )

        cursor = connection.cursor()

        if product_id:

            # ------------------------------------------------
            # Existing product
            # ------------------------------------------------

            cursor.execute(
                """
                UPDATE products
                SET
                    brand = %s,
                    category_id = %s,
                    image_url = %s,
                    source_url = COALESCE(
                        %s,
                        source_url
                    )
                WHERE id = %s
                """,
                (
                    brand,
                    category_id,
                    image_url,
                    source_url,
                    product_id
                )
            )

        else:

            # ------------------------------------------------
            # New product
            # ------------------------------------------------

            cursor.execute(
                """
                INSERT INTO products(
                    name,
                    brand,
                    category_id,
                    image_url,
                    source_url
                )
                VALUES(
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                RETURNING id
                """,
                (
                    name,
                    brand,
                    category_id,
                    image_url,
                    source_url
                )
            )

            product_id = (
                cursor.fetchone()[0]
            )

        connection.commit()

        cursor.close()

        return product_id

    except Exception as e:

        if connection:
            connection.rollback()

        print(
            "Database save error:",
            e
        )

        return None

    finally:

        if connection:
            connection.close()


# ============================================================
# SELLER HELPERS
# ============================================================

def get_seller_id(
    connection,
    seller_name
):

    if not seller_name:
        return None

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM sellers
        WHERE LOWER(name) = LOWER(%s)
        LIMIT 1
        """,
        (
            seller_name,
        )
    )

    row = cursor.fetchone()

    cursor.close()

    if row:
        return row[0]

    return None


def save_product_price(
    connection,
    product_id,
    marketplace_product
):

    if not product_id:
        return

    seller_name = (
        marketplace_product.get(
            "marketplace"
        )
        or marketplace_product.get(
            "seller"
        )
    )

    price = marketplace_product.get(
        "price"
    )

    product_url = (
        marketplace_product.get(
            "product_url"
        )
        or marketplace_product.get(
            "source_url"
        )
        or marketplace_product.get(
            "url"
        )
    )

    if not seller_name:
        return

    if price is None:
        return

    try:

        price = float(price)

    except (
        ValueError,
        TypeError
    ):

        return

    if price <= 0:
        return

    seller_id = get_seller_id(
        connection,
        seller_name
    )

    if not seller_id:
        return

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO product_prices(
            product_id,
            seller_id,
            price,
            product_url,
            updated_at
        )
        VALUES(
            %s,
            %s,
            %s,
            %s,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT(
            product_id,
            seller_id
        )
        DO UPDATE SET
            price = EXCLUDED.price,
            product_url = EXCLUDED.product_url,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            product_id,
            seller_id,
            price,
            product_url
        )
    )

    connection.commit()

    cursor.close()


def save_comparison_prices(
    product_id,
    matched_products
):

    if not product_id:
        return

    connection = None

    try:

        connection = get_db_connection()

        for product in matched_products:

            save_product_price(
                connection,
                product_id,
                product
            )

    except Exception as e:

        if connection:
            connection.rollback()

        print(
            "Comparison price save error:",
            e
        )

    finally:

        if connection:
            connection.close()


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return send_from_directory(
        os.path.join(FRONTEND_DIR, "Pages"),
        "index.html"
    )


# ============================================================
# INTRO / SPLASH PAGE
# ============================================================

@app.route(
    "/intro"
)
@app.route(
    "/welcome"
)
def intro_page():

    return render_template(
        "intro.html"
    )


@app.route(
    "/Pages/intro.html"
)
def intro_page_html():

    return render_template(
        "intro.html"
    )


# ============================================================
# LOGIN PAGE
# ============================================================

@app.route(
    "/Pages/login.html"
)
def login_page():

    return render_template(
        "login.html"
    )


# ============================================================
# SIGNUP PAGE
# ============================================================

@app.route(
    "/Pages/signup.html"
)
def signup_page():

    return render_template(
        "signup.html"
    )


# ============================================================
# REGISTER PAGE
# ============================================================

@app.route(
    "/Pages/register.html"
)
def register_page():

    return render_template(
        "register.html"
    )


# ============================================================
# DASHBOARD
# ============================================================

@app.route(
    "/dashboard"
)
def dashboard():

    if "user_id" not in session:

        return redirect(
            "/Pages/login.html"
        )

    user_name = session.get(
        "name",
        "User"
    )

    user_email = session.get(
        "email",
        ""
    )

    initial = (
        user_name.strip()[0].upper()
        if user_name.strip()
        else "U"
    )

    return render_template(
        "dashboard.html",
        name=user_name,
        email=user_email,
        initial=initial
    )


@app.route(
    "/Pages/dashboard.html"
)
def dashboard_html():

    if "user_id" not in session:

        return redirect(
            "/Pages/login.html"
        )

    user_name = session.get(
        "name",
        "User"
    )

    user_email = session.get(
        "email",
        ""
    )

    initial = (
        user_name.strip()[0].upper()
        if user_name.strip()
        else "U"
    )

    return render_template(
        "dashboard.html",
        name=user_name,
        email=user_email,
        initial=initial
    )


# ============================================================
# CURRENT LOGGED-IN USER
# ============================================================

@app.route(
    "/api/me",
    methods=["GET"]
)
def current_user():

    if "user_id" not in session:

        return jsonify({
            "success": False,
            "message":
                "Not authenticated."
        }), 401

    return jsonify({
        "success": True,
        "user": {
            "id":
                session.get(
                    "user_id"
                ),

            "name":
                session.get(
                    "name",
                    ""
                ),

            "email":
                session.get(
                    "email",
                    ""
                )
        }
    })


# ============================================================
# RESULT PAGE
# ============================================================

@app.route(
    "/result"
)
def result_page():

    return render_template(
        "result.html"
    )


@app.route(
    "/result/<int:product_id>"
)
def result_product_page(
    product_id
):

    return render_template(
        "result.html"
    )


# ============================================================
# GET CATEGORIES
# ============================================================

@app.route(
    "/api/categories",
    methods=["GET"]
)
def get_categories():

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, name
            FROM categories
            ORDER BY id
            """
        )

        rows = cursor.fetchall()

        cursor.close()

        categories = []

        for row in rows:

            categories.append({
                "id": row[0],
                "name": row[1]
            })

        return jsonify({
            "success": True,
            "categories": categories
        })

    except Exception as e:

        print(
            "Category error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to load categories.",
            "error": str(e)
        }), 500

    finally:

        if connection:
            connection.close()


# ============================================================
# GET PRODUCTS
# ============================================================

@app.route(
    "/api/products",
    methods=["GET"]
)
def get_products():

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                p.id,
                p.name,
                p.brand,
                c.name AS category,
                p.description,
                p.image_url,
                p.source_url,
                p.created_at
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
            ORDER BY p.id DESC
            """
        )

        rows = cursor.fetchall()

        cursor.close()

        products = []

        for row in rows:

            products.append({
                "id": row[0],
                "name": row[1],
                "brand": row[2],
                "category": row[3],
                "description": row[4],
                "image_url": row[5],

                # IMPORTANT:
                # Send source URL to frontend.
                "source_url": row[6],

                "created_at":
                    row[7].isoformat()
                    if row[7]
                    else None
            })

        return jsonify({
            "success": True,
            "products": products
        })

    except Exception as e:

        print(
            "Products error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to load products.",
            "error":
                str(e)
        }), 500

    finally:

        if connection:
            connection.close()


# ============================================================
# GET PRODUCT PRICES
# ============================================================

@app.route(
    "/api/products/<int:product_id>/prices",
    methods=["GET"]
)
def get_product_prices(
    product_id
):

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pp.price,
                s.name AS seller,
                s.website,
                pp.product_url
            FROM product_prices pp
            LEFT JOIN sellers s
                ON pp.seller_id = s.id
            WHERE pp.product_id = %s
            ORDER BY pp.price ASC
            """,
            (
                product_id,
            )
        )

        rows = cursor.fetchall()

        cursor.close()

        prices = []

        for row in rows:

            prices.append({
                "price":
                    float(row[0])
                    if row[0] is not None
                    else None,

                "currency":
                    "INR",

                "seller":
                    row[1],

                "website":
                    row[2],

                "url":
                    row[3]
            })

        return jsonify({
            "success": True,
            "product_id":
                product_id,
            "prices":
                prices
        })

    except Exception as e:

        print(
            "Price fetch error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to load product prices.",
            "error":
                str(e)
        }), 500

    finally:

        if connection:
            connection.close()


# ============================================================
# FETCH PRODUCT FROM URL
# ============================================================

@app.route(
    "/api/products/fetch",
    methods=["POST"]
)
def fetch_product():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    url = data.get(
        "url"
    )

    if not url:

        return jsonify({
            "success": False,
            "message":
                "Please provide a product URL."
        }), 400

    url = url.strip()

    if not is_valid_url(url):

        return jsonify({
            "success": False,
            "message":
                "Please provide a valid product URL."
        }), 400

    try:

        fetcher = (
            GenericProductFetcher()
        )

        product = fetcher.fetch(
            url
        )

        if not product:

            return jsonify({
                "success": False,
                "message":
                    "Unable to fetch product."
            }), 422

        return jsonify({
            "success": True,
            "product":
                product
        })

    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message":
                "The product website took too long to respond."
        }), 504

    except requests.exceptions.RequestException as e:

        return jsonify({
            "success": False,
            "message":
                "Unable to access the product website.",
            "error":
                str(e)
        }), 502

    except Exception as e:

        print(
            "Fetch product error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to fetch product.",
            "error":
                str(e)
        }), 500


# ============================================================
# CANONICAL PRODUCT
# ============================================================

@app.route(
    "/api/products/canonical",
    methods=["POST"]
)
def canonical_product():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    product = data.get(
        "product"
    )

    if not product:

        return jsonify({
            "success": False,
            "message":
                "Product data is required."
        }), 400

    try:

        generator = (
            CanonicalProductGenerator()
        )

        canonical = generator.generate(
            product
        )

        return jsonify({
            "success": True,
            "canonical":
                canonical
        })

    except Exception as e:

        print(
            "Canonicalization error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to canonicalize product.",
            "error":
                str(e)
        }), 500


# ============================================================
# ANALYZE PRODUCT
# ============================================================

@app.route(
    "/api/products/analyze",
    methods=["POST"]
)
def analyze_product():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    url = data.get(
        "url"
    )

    if not url:

        return jsonify({
            "success": False,
            "message":
                "Please provide a product URL."
        }), 400

    url = url.strip()

    if not is_valid_url(url):

        return jsonify({
            "success": False,
            "message":
                "Please provide a valid product URL."
        }), 400

    if not is_supported_marketplace_url(url):

        return jsonify({
            "success": False,
            "message":
                "Unsupported marketplace URL. Only Amazon and Flipkart product pages are supported."
        }), 400

    url = normalize_marketplace_url(url)

    try:

        fetcher = (
            GenericProductFetcher()
        )

        product = fetcher.fetch(
            url
        )

        if not product:

            return jsonify({
                "success": False,
                "message":
                    "Unable to extract product details."
            }), 422

        generator = (
            CanonicalProductGenerator()
        )

        canonical = generator.generate(
            product
        )

        # ----------------------------------------------------
        # Make sure source URL is available before saving.
        # ----------------------------------------------------

        if not canonical.get("source_url"):

            canonical["source_url"] = url

        product_id = (
            save_product_to_database(
                canonical
            )
        )

        return jsonify({
            "success": True,
            "message":
                "Product analyzed successfully.",
            "product_id":
                product_id,
            "product":
                product,
            "canonical":
                canonical
        })

    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message":
                "The product website took too long to respond."
        }), 504

    except requests.exceptions.RequestException as e:

        print(
            "Analyze error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to access the product website."
        }), 502

    except Exception as e:

        print(
            "Analyze error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to analyze product."
        }), 500


# ============================================================
# FULL PRODUCT COMPARISON
# ============================================================

@app.route(
    "/api/products/compare",
    methods=["POST"]
)
def compare_product():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    url = data.get(
        "url"
    )

    if not url:

        return jsonify({
            "success": False,
            "message":
                "Please provide a product URL."
        }), 400

    url = url.strip()

    if not is_valid_url(url):

        return jsonify({
            "success": False,
            "message":
                "Please provide a valid product URL."
        }), 400

    if not is_supported_marketplace_url(url):

        return jsonify({
            "success": False,
            "message":
                "Unsupported marketplace URL. Only Amazon and Flipkart product pages are supported."
        }), 400

    url = normalize_marketplace_url(url)

    try:

        print(
            "\n########################################"
        )

        print(
            "TRUSTCART API COMPARISON"
        )

        print(
            "########################################"
        )

        # ----------------------------------------------------
        # STEP 1: FETCH
        # ----------------------------------------------------

        print(
            "\n[API STEP 1] Fetching product:"
        )

        print(url)

        fetcher = (
            GenericProductFetcher()
        )

        product = fetcher.fetch(
            url
        )

        if not product:

            return jsonify({
                "success": False,
                "message":
                    "Unable to extract product details."
            }), 422

        print(
            "\nFetched product:"
        )

        print(product)

        # ----------------------------------------------------
        # STEP 2: FULL PIPELINE
        # ----------------------------------------------------

        print(
            "\n[API] Running full comparison pipeline..."
        )

        pipeline = (
            ComparisonPipeline()
        )

        pipeline_result = pipeline.run(
            product
        )

        if not pipeline_result:

            return jsonify({
                "success": False,
                "message":
                    "Comparison pipeline returned no result."
            }), 500

        canonical = (
            pipeline_result.get(
                "canonical"
            )
        )

        # ----------------------------------------------------
        # IMPORTANT:
        # Ensure canonical product contains the original URL.
        # ----------------------------------------------------

        if canonical:

            if not canonical.get("source_url"):

                canonical["source_url"] = url

        discovery = (
            pipeline_result.get(
                "discovery",
                {}
            )
        )

        matching = (
            pipeline_result.get(
                "matching",
                {}
            )
        )

        price_comparison = (
            pipeline_result.get(
                "price_comparison",
                {}
            )
        )

        trust_analysis = (
            pipeline_result.get(
                "trust_analysis",
                {}
            )
        )

        recommendation = (
            pipeline_result.get(
                "recommendation",
                {}
            )
        )

        # ----------------------------------------------------
        # STEP 3: SAVE PRODUCT
        # ----------------------------------------------------

        product_id = None

        if canonical:

            print(
                "\n[API] Saving canonical product..."
            )

            product_id = (
                save_product_to_database(
                    canonical
                )
            )

            print(
                "Database Product ID:",
                product_id
            )

        # ----------------------------------------------------
        # STEP 4: SAVE PRICES
        # ----------------------------------------------------

        if product_id:

            matched_products = (
                price_comparison.get(
                    "products",
                    []
                )
            )

            print(
                "\n[API] Saving marketplace prices..."
            )

            save_comparison_prices(
                product_id,
                matched_products
            )

        # ----------------------------------------------------
        # COMPLETE RESPONSE
        # ----------------------------------------------------

        response = {

            "success":
                pipeline_result.get("comparison_complete", False),

            "comparison_complete":
                pipeline_result.get("comparison_complete", False),

            "message":
                (
                    "Product comparison completed successfully."
                    if pipeline_result.get("comparison_complete", False)
                    else "Equivalent product was not found on the other marketplace."
                ),

            "product_id":
                product_id,

            "source_url":
                url,

            "product":
                product,

            "canonical":
                canonical,

            "discovery": {

                "candidate_count":
                    len(
                        discovery.get(
                            "candidates",
                            []
                        )
                    ),

                "candidates":
                    discovery.get(
                        "candidates",
                        []
                    )
            },

            "matching": {

                "match_count":
                    matching.get(
                        "match_count",
                        0
                    ),

                "matches":
                    matching.get(
                        "matches",
                        []
                    )
            },

            "price_comparison":
                price_comparison,

            "trust_analysis":
                trust_analysis,

            "recommendation":
                recommendation,

            "timings":
                pipeline_result.get("timings", {})
        }

        print(
            "\n########################################"
        )

        print(
            "API COMPARISON COMPLETE"
        )

        print(
            "########################################"
        )

        return jsonify(
            response
        )

    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message":
                "The product website took too long to respond."
        }), 504

    except requests.exceptions.RequestException as e:

        print(
            "Comparison request error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to access the product website."
        }), 502

    except Exception as e:

        print(
            "\nFULL COMPARISON ERROR:"
        )

        print(e)

        return jsonify({
            "success": False,
            "message":
                "Unable to complete product comparison."
        }), 500


# ============================================================
# SIGNUP
# ============================================================

@app.route(
    "/signup",
    methods=["POST"]
)
def signup():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    name = data.get(
        "name",
        ""
    ).strip()

    email = data.get(
        "email",
        ""
    ).strip().lower()

    password = data.get(
        "password",
        ""
    )

    if not name or not email or not password:

        return jsonify({
            "success": False,
            "message":
                "Name, email and password are required."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        password_hash = (
            generate_password_hash(
                password
            )
        )

        cursor.execute(
            """
            INSERT INTO users(
                name,
                email,
                password_hash
            )
            VALUES(
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            (
                name,
                email,
                password_hash
            )
        )

        user_id = cursor.fetchone()[0]

        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "message":
                "Account created successfully.",
            "user_id":
                user_id
        })

    except errors.UniqueViolation:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message":
                "An account with this email already exists."
        }), 409

    except Exception as e:

        if connection:
            connection.rollback()

        print(
            "Signup error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to create account.",
            "error":
                str(e)
        }), 500

    finally:

        if connection:
            connection.close()


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/login",
    methods=["POST"]
)
def login():

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "success": False,
            "message":
                "Request body is required."
        }), 400

    email = data.get(
        "email",
        ""
    ).strip().lower()

    password = data.get(
        "password",
        ""
    )

    if not email or not password:

        return jsonify({
            "success": False,
            "message":
                "Email and password are required."
        }), 400

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                password_hash
            FROM users
            WHERE LOWER(email) = LOWER(%s)
            LIMIT 1
            """,
            (
                email,
            )
        )

        user = cursor.fetchone()

        cursor.close()

        if not user:

            return jsonify({
                "success": False,
                "message":
                    "Invalid email or password."
            }), 401

        user_id = user[0]
        name = user[1]
        user_email = user[2]
        password_hash = user[3]

        if not password_hash:

            return jsonify({
                "success": False,
                "message":
                    "This account has no valid password configured."
            }), 401

        if not check_password_hash(
            password_hash,
            password
        ):

            return jsonify({
                "success": False,
                "message":
                    "Invalid email or password."
            }), 401

        session["user_id"] = user_id
        session["name"] = name
        session["email"] = user_email

        session.permanent = False

        return jsonify({
            "success": True,
            "message":
                "Login successful.",
            "user": {
                "id":
                    user_id,
                "name":
                    name,
                "email":
                    user_email
            }
        })

    except Exception as e:

        print(
            "Login error:",
            e
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to login.",
            "error":
                str(e)
        }), 500

    finally:

        if connection:
            connection.close()


# ============================================================
# LOGOUT
# ============================================================

@app.route(
    "/logout"
)
def logout():

    session.clear()

    return redirect(
        "/Pages/login.html"
    )


# ============================================================
# FRONTEND STATIC FILES
# ============================================================

@app.route(
    "/<path:path>"
)
def serve_frontend(
    path
):

    file_path = os.path.join(
        FRONTEND_DIR,
        path
    )

    if os.path.isfile(
        file_path
    ):

        directory = os.path.dirname(
            file_path
        )

        filename = os.path.basename(
            file_path
        )

        return send_from_directory(
            directory,
            filename
        )

    return jsonify({
        "success": False,
        "message":
            "File not found."
    }), 404


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    print(
        "\n========================================"
    )

    print(
        "        TRUSTCART BACKEND"
    )

    print(
        "========================================"
    )

    print(
        "Server: http://127.0.0.1:5000"
    )

    print(
        "Comparison API:"
    )

    print(
        "POST /api/products/compare"
    )

    print(
        "Current User API:"
    )

    print(
        "GET /api/me"
    )

    print(
        "========================================\n"
    )

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=os.getenv("FLASK_DEBUG", "0").lower() in {"1", "true", "yes"},
        use_reloader=False
    )
