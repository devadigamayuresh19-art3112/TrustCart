from flask import Flask, request, jsonify, send_from_directory, session, redirect, render_template
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from psycopg2 import errors
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
PAGES_DIR = os.path.join(FRONTEND_DIR, "Pages")

app = Flask(__name__, template_folder=PAGES_DIR)
app.secret_key = os.getenv("SECRET_KEY", "trustcart-dev-secret")


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "TrustCart"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", "5432")
    )


# =========================
# FRONTEND
# =========================

@app.route("/")
def index():
    return send_from_directory(PAGES_DIR, "index.html")


@app.route("/Pages/login.html")
def login_page():
    return send_from_directory(PAGES_DIR, "login.html")


@app.route("/Pages/signup.html")
def signup_page():
    return send_from_directory(PAGES_DIR, "signup.html")


# =========================
# DASHBOARD
# =========================

@app.route("/dashboard")
@app.route("/Pages/dashboard.html")
def dashboard():
    if "user_id" not in session:
        return redirect("/Pages/login.html")

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, name, email
            FROM users
            WHERE id = %s
            """,
            (session["user_id"],)
        )

        user = cursor.fetchone()

        if not user:
            session.clear()
            return redirect("/Pages/login.html")

        user_id, name, email = user
        initial = name.strip()[0].upper() if name.strip() else "U"

        return render_template(
            "dashboard.html",
            user_id=user_id,
            name=name,
            email=email,
            initial=initial
        )

    except Exception as e:
        print("Dashboard error:", e)
        return "Unable to load dashboard.", 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# =========================
# SIGNUP
# =========================

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    password_hash = generate_password_hash(password)

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (name, email, password_hash)
        )

        user_id = cursor.fetchone()[0]
        conn.commit()

        session.clear()
        session["user_id"] = user_id

        return jsonify({
            "success": True,
            "message": "Account created successfully!",
            "redirect": "/dashboard"
        })

    except errors.UniqueViolation:
        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": "An account with this email already exists."
        }), 409

    except Exception as e:
        if conn:
            conn.rollback()

        print("Signup error:", e)

        return jsonify({
            "success": False,
            "message": "Something went wrong. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# =========================
# LOGIN
# =========================

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, name, password_hash
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

    except Exception as e:
        print("Login database error:", e)

        return jsonify({
            "success": False,
            "message": "Unable to connect to the database."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    if not user or not check_password_hash(user[2], password):
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    session.clear()
    session["user_id"] = user[0]

    return jsonify({
        "success": True,
        "message": "Login successful!",
        "redirect": "/dashboard"
    })


# =========================
# LOGOUT
# =========================

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/Pages/login.html")


# =========================
# FRONTEND FILES
# =========================

@app.route("/<path:path>")
def frontend(path):
    return send_from_directory(FRONTEND_DIR, path)


# =========================
# RUN
# =========================

if __name__ == "__main__":
    app.run(debug=True)