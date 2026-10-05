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
import secrets

from urllib.parse import urlparse, urlencode
from dotenv import load_dotenv

try:
    from .fetchers.generic import GenericProductFetcher
    from .processors.canonical import CanonicalProductGenerator
    from .pipeline.comparison_pipeline import ComparisonPipeline
    from .comparison.price_comparator import PriceComparator
    from .trust.trust_analyzer import TrustAnalyzer
except ImportError:  # supports `python backend/app.py`
    from fetchers.generic import GenericProductFetcher
    from processors.canonical import CanonicalProductGenerator
    from pipeline.comparison_pipeline import ComparisonPipeline
    from comparison.price_comparator import PriceComparator
    from trust.trust_analyzer import TrustAnalyzer


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
        or "snapdeal.com" in host
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
# PROFILE
# ============================================================

@app.route(
    "/api/profile",
    methods=["GET"]
)
def get_profile():

    user_id = get_authenticated_user_id()

    if user_id is None:
        return jsonify({
            "success": False,
            "message":
                "Not authenticated."
        }), 401

    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, name, email
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        cursor.close()

        if not user:
            return jsonify({
                "success": False,
                "message":
                    "User account not found."
            }), 404

        return jsonify({
            "success": True,
            "user": {
                "id": user[0],
                "name": user[1] or "",
                "email": user[2] or ""
            }
        })

    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Profile fetch error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to load profile."
        }), 500

    finally:

        if connection:
            connection.close()


@app.route(
    "/api/profile",
    methods=["PUT"]
)
def update_profile():

    user_id = get_authenticated_user_id()

    if user_id is None:
        return jsonify({
            "success": False,
            "message":
                "Not authenticated."
        }), 401

    data = request.get_json(
        silent=True
    ) or {}

    name = data.get("name")

    if not isinstance(name, str):
        return jsonify({
            "success": False,
            "message":
                "Name must be text."
        }), 400

    name = name.strip()

    if not name:
        return jsonify({
            "success": False,
            "message":
                "Name cannot be empty."
        }), 400

    if len(name) > 100:
        return jsonify({
            "success": False,
            "message":
                "Name must be 100 characters or fewer."
        }), 400

    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE users
            SET name = %s
            WHERE id = %s
            RETURNING id, name, email
            """,
            (
                name,
                user_id
            )
        )

        user = cursor.fetchone()

        if not user:
            connection.rollback()
            cursor.close()

            return jsonify({
                "success": False,
                "message":
                    "User account not found."
            }), 404

        connection.commit()
        cursor.close()

        session["name"] = user[1] or "User"
        session["email"] = user[2] or ""

        return jsonify({
            "success": True,
            "message":
                "Profile updated successfully.",
            "user": {
                "id": user[0],
                "name": user[1] or "",
                "email": user[2] or ""
            }
        })

    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Profile update error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to update profile."
        }), 500

    finally:

        if connection:
            connection.close()


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


# ============================================================
# DASHBOARD PERSISTENCE APIs
# ============================================================

def get_authenticated_user_id():

    value = session.get("user_id")

    if value is None:
        return None

    try:
        return int(value)

    except (
        TypeError,
        ValueError
    ):
        return None


@app.route(
    "/api/dashboard/state",
    methods=["GET"]
)
def dashboard_state():

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        # ----------------------------------------------------
        # SEARCH HISTORY
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url,
                savings,
                searched_at
            FROM search_history
            WHERE user_id = %s
            ORDER BY searched_at DESC, id DESC
            LIMIT 10
            """,
            (user_id,)
        )

        history_rows = cursor.fetchall()

        history = []

        for row in history_rows:

            history.append({
                "history_id": row[0],
                "id": row[1],
                "product_id": row[1],
                "name": row[2],
                "brand": row[3] or "",
                "category": row[4] or "Product",
                "source_url": row[5] or "",
                "image_url": row[6] or "",
                "savings": float(row[7] or 0),
                "timestamp":
                    row[8].isoformat()
                    if row[8]
                    else None
            })


        # ----------------------------------------------------
        # SAVED PRODUCTS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url,
                saved_at
            FROM saved_products
            WHERE user_id = %s
            ORDER BY saved_at DESC, id DESC
            """,
            (user_id,)
        )

        saved_rows = cursor.fetchall()

        saved = []

        for row in saved_rows:

            saved.append({
                "saved_id": row[0],
                "id": row[1],
                "product_id": row[1],
                "name": row[2],
                "brand": row[3] or "",
                "category": row[4] or "Product",
                "source_url": row[5] or "",
                "image_url": row[6] or "",
                "saved_at":
                    row[7].isoformat()
                    if row[7]
                    else None
            })


        # ----------------------------------------------------
        # NOTIFICATION SETTINGS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT enabled
            FROM user_notification_settings
            WHERE user_id = %s
            """,
            (user_id,)
        )

        setting_row = cursor.fetchone()

        notifications_enabled = (
            bool(setting_row[0])
            if setting_row is not None
            else True
        )


        # ----------------------------------------------------
        # NOTIFICATIONS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                title,
                message,
                type,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 20
            """,
            (user_id,)
        )

        notification_rows = cursor.fetchall()

        notifications = []

        for row in notification_rows:

            notifications.append({
                "id": row[0],
                "title": row[1],
                "message": row[2],
                "type": row[3] or "general",
                "is_read": bool(row[4]),
                "created_at":
                    row[5].isoformat()
                    if row[5]
                    else None
            })


        cursor.close()

        return jsonify({
            "success": True,
            "history": history,
            "saved": saved,
            "notifications": notifications,
            "notifications_enabled":
                notifications_enabled
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Dashboard state error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to load dashboard data."
        }), 500


    finally:

        if connection:
            connection.close()


@app.route(
    "/api/search-history",
    methods=["POST"]
)
def save_search_history():

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    data = request.get_json(
        silent=True
    ) or {}

    product_id = data.get(
        "product_id",
        data.get("id")
    )

    name = str(
        data.get("name") or
        "Compared Product"
    ).strip()

    brand = str(
        data.get("brand") or ""
    ).strip()

    category = str(
        data.get("category") or
        "Product"
    ).strip()

    source_url = str(
        data.get("source_url") or
        data.get("product_url") or
        data.get("url") or
        ""
    ).strip()

    image_url = str(
        data.get("image_url") or
        ""
    ).strip()

    savings = data.get(
        "savings",
        0
    )

    if not source_url:

        return jsonify({
            "success": False,
            "message": "Source URL is required."
        }), 400

    try:

        savings = float(savings or 0)

    except (
        TypeError,
        ValueError
    ):

        savings = 0


    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()


        if product_id is not None:

            try:
                product_id = int(product_id)

            except (
                TypeError,
                ValueError
            ):
                product_id = None


        # Remove previous occurrence so the newest
        # comparison appears at the top.

        if product_id is not None:

            cursor.execute(
                """
                DELETE FROM search_history
                WHERE user_id = %s
                  AND product_id = %s
                """,
                (
                    user_id,
                    product_id
                )
            )

        else:

            cursor.execute(
                """
                DELETE FROM search_history
                WHERE user_id = %s
                  AND source_url = %s
                """,
                (
                    user_id,
                    source_url
                )
            )


        cursor.execute(
            """
            INSERT INTO search_history(
                user_id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url,
                savings
            )
            VALUES(
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                user_id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url,
                savings
            )
        )

        history_id = cursor.fetchone()[0]


        # Keep only the latest 10 searches.

        cursor.execute(
            """
            DELETE FROM search_history
            WHERE id IN (
                SELECT id
                FROM search_history
                WHERE user_id = %s
                ORDER BY searched_at DESC, id DESC
                OFFSET 10
            )
            """,
            (user_id,)
        )


        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "history_id": history_id
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Save search history error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to save search history."
        }), 500


    finally:

        if connection:
            connection.close()


@app.route(
    "/api/saved-products",
    methods=["POST"]
)
def save_product():

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    data = request.get_json(
        silent=True
    ) or {}

    product_id = data.get(
        "product_id",
        data.get("id")
    )

    try:
        product_id = int(product_id)

    except (
        TypeError,
        ValueError
    ):

        return jsonify({
            "success": False,
            "message": "Valid product ID is required."
        }), 400


    name = str(
        data.get("name") or
        "Product"
    ).strip()

    brand = str(
        data.get("brand") or
        ""
    ).strip()

    category = str(
        data.get("category") or
        "Product"
    ).strip()

    source_url = str(
        data.get("source_url") or
        data.get("product_url") or
        data.get("url") or
        ""
    ).strip()

    image_url = str(
        data.get("image_url") or
        ""
    ).strip()


    if not source_url:

        return jsonify({
            "success": False,
            "message": "Source URL is required."
        }), 400


    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO saved_products(
                user_id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url
            )
            VALUES(
                %s, %s, %s, %s,
                %s, %s, %s
            )
            ON CONFLICT (
                user_id,
                product_id
            )
            DO UPDATE SET
                name = EXCLUDED.name,
                brand = EXCLUDED.brand,
                category = EXCLUDED.category,
                source_url = EXCLUDED.source_url,
                image_url = EXCLUDED.image_url
            RETURNING id
            """,
            (
                user_id,
                product_id,
                name,
                brand,
                category,
                source_url,
                image_url
            )
        )

        saved_id = cursor.fetchone()[0]

        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "saved_id": saved_id
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Save product error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to save product."
        }), 500


    finally:

        if connection:
            connection.close()


@app.route(
    "/api/saved-products/<int:product_id>",
    methods=["DELETE"]
)
def delete_saved_product(product_id):

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM saved_products
            WHERE user_id = %s
              AND product_id = %s
            """,
            (
                user_id,
                product_id
            )
        )

        deleted = cursor.rowcount

        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "deleted": deleted > 0
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Delete saved product error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to remove saved product."
        }), 500


    finally:

        if connection:
            connection.close()


@app.route(
    "/api/notification-settings",
    methods=["PUT"]
)
def update_notification_settings():

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    data = request.get_json(
        silent=True
    ) or {}

    enabled = data.get(
        "enabled"
    )

    if not isinstance(
        enabled,
        bool
    ):

        return jsonify({
            "success": False,
            "message": "enabled must be boolean."
        }), 400


    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO user_notification_settings(
                user_id,
                enabled,
                updated_at
            )
            VALUES(
                %s, %s, CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                enabled = EXCLUDED.enabled,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                enabled
            )
        )

        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "enabled": enabled
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Notification settings error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to update notification settings."
        }), 500


    finally:

        if connection:
            connection.close()


@app.route(
    "/api/notifications/read",
    methods=["POST"]
)
def mark_notifications_read():

    user_id = get_authenticated_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Not authenticated."
        }), 401

    connection = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = %s
              AND is_read = FALSE
            """,
            (user_id,)
        )

        updated = cursor.rowcount

        connection.commit()

        cursor.close()

        return jsonify({
            "success": True,
            "updated": updated
        })


    except Exception as error:

        if connection:
            connection.rollback()

        print(
            "Mark notifications read error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to update notifications."
        }), 500


    finally:

        if connection:
            connection.close()



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

        # ----------------------------------------------------
        # TRUSTCART PRODUCT ANALYSIS
        # Reuse the same price + trust analysis used by
        # the main comparison pipeline.
        # ----------------------------------------------------

        # Ensure the analysis knows which marketplace
        # the source product came from.
        if not product.get("marketplace"):
            hostname = urlparse(url).netloc.lower()

            if "amazon." in hostname:
                product["marketplace"] = "Amazon"
            elif "flipkart." in hostname:
                product["marketplace"] = "Flipkart"
            elif "snapdeal." in hostname:
                product["marketplace"] = "Snapdeal"

        price_comparator = PriceComparator()

        price_result = price_comparator.compare(
            [product]
        )

        trust_analyzer = TrustAnalyzer()

        trust_result = trust_analyzer.analyze(
            price_result.get(
                "products",
                []
            )
        )

        analysis = None

        if trust_result.get("products"):
            analysis = trust_result["products"][0]

        return jsonify({
            "success": True,
            "message":
                "Product analyzed successfully.",
            "product_id":
                product_id,
            "product":
                product,
            "canonical":
                canonical,
            "price_comparison":
                price_result,
            "trust_analysis":
                trust_result,
            "analysis":
                analysis
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

        import traceback

        print(
            "\nFULL COMPARISON ERROR:"
        )

        print(e)

        traceback.print_exc()

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
# OAUTH HELPERS
# ============================================================

def establish_user_session(user_id, name, email):
    session["user_id"] = user_id
    session["name"] = name or "User"
    session["email"] = email
    session.permanent = False


def oauth_error(message):
    print("OAuth error:", message)
    return redirect(
        "/Pages/login.html?oauth_error="
        + urlencode({"message": message})
    )


def get_or_create_oauth_user(
    provider,
    provider_id,
    name,
    email
):
    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        provider_column = (
            "google_id"
            if provider == "google"
            else "facebook_id"
        )

        # ----------------------------------------------------
        # 1. Existing account linked to this provider
        # ----------------------------------------------------
        cursor.execute(
            f"""
            SELECT id, name, email
            FROM users
            WHERE {provider_column} = %s
            LIMIT 1
            """,
            (provider_id,)
        )

        user = cursor.fetchone()

        if user:
            cursor.close()
            return user

        # ----------------------------------------------------
        # 2. Existing TrustCart account with same email
        #    Link the OAuth provider to that account.
        # ----------------------------------------------------
        cursor.execute(
            """
            SELECT id, name, email
            FROM users
            WHERE LOWER(email) = LOWER(%s)
            LIMIT 1
            """,
            (email,)
        )

        user = cursor.fetchone()

        if user:
            cursor.execute(
                f"""
                UPDATE users
                SET {provider_column} = %s
                WHERE id = %s
                """,
                (
                    provider_id,
                    user[0]
                )
            )

            connection.commit()
            cursor.close()

            return user

        # ----------------------------------------------------
        # 3. Completely new OAuth account
        # ----------------------------------------------------
        safe_name = (
            name.strip()
            if isinstance(name, str) and name.strip()
            else email.split("@")[0]
        )

        cursor.execute(
            f"""
            INSERT INTO users(
                name,
                email,
                password_hash,
                {provider_column}
            )
            VALUES(
                %s,
                %s,
                NULL,
                %s
            )
            RETURNING id, name, email
            """,
            (
                safe_name,
                email,
                provider_id
            )
        )

        user = cursor.fetchone()

        connection.commit()
        cursor.close()

        return user

    except errors.UniqueViolation:
        if connection:
            connection.rollback()

        # A race condition may have created the account.
        # Try the provider ID once more.
        try:
            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT id, name, email
                FROM users
                WHERE {provider_column} = %s
                LIMIT 1
                """,
                (provider_id,)
            )

            user = cursor.fetchone()
            cursor.close()

            return user

        except Exception:
            return None

    except Exception as e:
        if connection:
            connection.rollback()

        print(
            f"{provider.title()} OAuth database error:",
            e
        )

        return None

    finally:
        if connection:
            connection.close()


# ============================================================
# GOOGLE OAUTH
# ============================================================

@app.route("/auth/google")
def google_login():

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not client_id or not redirect_uri:
        return oauth_error(
            "Google OAuth is not configured."
        )

    state = secrets.token_urlsafe(32)

    session["google_oauth_state"] = state

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account"
    }

    authorization_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    )

    return redirect(authorization_url)


@app.route("/auth/google/callback")
def google_callback():

    error = request.args.get("error")

    if error:
        session.pop("google_oauth_state", None)
        return oauth_error(
            "Google login was cancelled."
        )

    state = request.args.get("state")
    saved_state = session.pop(
        "google_oauth_state",
        None
    )

    if (
        not state
        or not saved_state
        or not secrets.compare_digest(
            state,
            saved_state
        )
    ):
        return oauth_error(
            "Invalid Google OAuth state."
        )

    code = request.args.get("code")

    if not code:
        return oauth_error(
            "Google authorization code was missing."
        )

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not client_id or not client_secret or not redirect_uri:
        return oauth_error(
            "Google OAuth is not configured."
        )

    try:

        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            },
            timeout=15
        )

        if not token_response.ok:
            print(
                "Google token error:",
                token_response.text
            )

            return oauth_error(
                "Google token exchange failed."
            )

        token_data = token_response.json()

        access_token = token_data.get(
            "access_token"
        )

        if not access_token:
            return oauth_error(
                "Google access token was missing."
            )

        userinfo_response = requests.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={
                "Authorization":
                    f"Bearer {access_token}"
            },
            timeout=15
        )

        if not userinfo_response.ok:
            print(
                "Google userinfo error:",
                userinfo_response.text
            )

            return oauth_error(
                "Unable to retrieve Google account information."
            )

        userinfo = userinfo_response.json()

        google_id = userinfo.get("sub")
        email = (
            userinfo.get("email")
            or ""
        ).strip().lower()

        name = (
            userinfo.get("name")
            or ""
        ).strip()

        if not google_id or not email:
            return oauth_error(
                "Google did not provide a valid account."
            )

        user = get_or_create_oauth_user(
            "google",
            google_id,
            name,
            email
        )

        if not user:
            return oauth_error(
                "Unable to create or find your TrustCart account."
            )

        establish_user_session(
            user[0],
            user[1],
            user[2]
        )

        return redirect("/dashboard")

    except requests.RequestException as e:

        print(
            "Google OAuth request error:",
            e
        )

        return oauth_error(
            "Unable to connect to Google."
        )

    except Exception as e:

        print(
            "Google OAuth error:",
            e
        )

        return oauth_error(
            "Google login failed."
        )


# ============================================================
# FACEBOOK OAUTH
# ============================================================

@app.route("/auth/facebook")
def facebook_login():

    app_id = os.getenv("FACEBOOK_APP_ID")
    redirect_uri = os.getenv(
        "FACEBOOK_REDIRECT_URI"
    )

    if not app_id or not redirect_uri:
        return oauth_error(
            "Facebook OAuth is not configured."
        )

    state = secrets.token_urlsafe(32)

    session["facebook_oauth_state"] = state

    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "email,public_profile",
        "state": state
    }

    authorization_url = (
        "https://www.facebook.com/dialog/oauth?"
        + urlencode(params)
    )

    return redirect(authorization_url)


@app.route("/auth/facebook/callback")
def facebook_callback():

    error = request.args.get("error")

    if error:
        session.pop(
            "facebook_oauth_state",
            None
        )

        return oauth_error(
            "Facebook login was cancelled."
        )

    state = request.args.get("state")
    saved_state = session.pop(
        "facebook_oauth_state",
        None
    )

    if (
        not state
        or not saved_state
        or not secrets.compare_digest(
            state,
            saved_state
        )
    ):
        return oauth_error(
            "Invalid Facebook OAuth state."
        )

    code = request.args.get("code")

    if not code:
        return oauth_error(
            "Facebook authorization code was missing."
        )

    app_id = os.getenv("FACEBOOK_APP_ID")
    app_secret = os.getenv(
        "FACEBOOK_APP_SECRET"
    )
    redirect_uri = os.getenv(
        "FACEBOOK_REDIRECT_URI"
    )

    if not app_id or not app_secret or not redirect_uri:
        return oauth_error(
            "Facebook OAuth is not configured."
        )

    try:

        token_response = requests.get(
            "https://graph.facebook.com/oauth/access_token",
            params={
                "client_id": app_id,
                "client_secret": app_secret,
                "redirect_uri": redirect_uri,
                "code": code
            },
            timeout=15
        )

        if not token_response.ok:
            print(
                "Facebook token error:",
                token_response.text
            )

            return oauth_error(
                "Facebook token exchange failed."
            )

        token_data = token_response.json()

        access_token = token_data.get(
            "access_token"
        )

        if not access_token:
            return oauth_error(
                "Facebook access token was missing."
            )

        user_response = requests.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,name,email",
                "access_token": access_token
            },
            timeout=15
        )

        if not user_response.ok:
            print(
                "Facebook userinfo error:",
                user_response.text
            )

            return oauth_error(
                "Unable to retrieve Facebook account information."
            )

        userinfo = user_response.json()

        facebook_id = userinfo.get("id")

        email = (
            userinfo.get("email")
            or ""
        ).strip().lower()

        name = (
            userinfo.get("name")
            or ""
        ).strip()

        if not facebook_id:
            return oauth_error(
                "Facebook did not provide a valid account."
            )

        if not email:
            return oauth_error(
                "Facebook did not provide an email address. "
                "Please use another login method."
            )

        user = get_or_create_oauth_user(
            "facebook",
            facebook_id,
            name,
            email
        )

        if not user:
            return oauth_error(
                "Unable to create or find your TrustCart account."
            )

        establish_user_session(
            user[0],
            user[1],
            user[2]
        )

        return redirect("/dashboard")

    except requests.RequestException as e:

        print(
            "Facebook OAuth request error:",
            e
        )

        return oauth_error(
            "Unable to connect to Facebook."
        )

    except Exception as e:

        print(
            "Facebook OAuth error:",
            e
        )

        return oauth_error(
            "Facebook login failed."
        )


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
