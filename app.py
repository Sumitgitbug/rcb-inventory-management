from __future__ import annotations

import json
import os
import secrets
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
from contextlib import contextmanager
from datetime import datetime
from functools import wraps
from pathlib import Path

import mysql.connector
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

STATE_FILE = Path.home() / ".inventory_management" / "inventory_state.json"
AUTH_FILE = Path.home() / ".inventory_management" / "auth_users.json"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_secret(name: str) -> str:
    file_path = os.getenv(f"{name}_FILE", "").strip()
    if file_path:
        try:
            return Path(file_path).read_text(encoding="utf-8").strip()
        except OSError:
            return ""
    return os.getenv(name, "")


def _mysql_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
        "port": _env_int("MYSQL_PORT", 3306),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": _env_secret("MYSQL_PASSWORD"),
        "database": os.getenv("MYSQL_DATABASE", "inventory_management"),
        "autocommit": False,
    }


MYSQL_CONFIG = _mysql_config()

I_NOTE_API_BASE_URL = "https://ercb.rcb.ac.in/new/api/i-note-records.php"
I_NOTE_DETAIL_API_URL = "https://ercb.rcb.ac.in/new/api/i-note.php"
I_NOTE_API_KEY = os.getenv("INOTE_API_KEY", "").strip()
AUTH_TOKEN_MAX_AGE_SECONDS = _env_int("AUTH_TOKEN_MAX_AGE_SECONDS", 12 * 60 * 60)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    app.config["JSON_SORT_KEYS"] = False
    app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
    return app


app = create_app()


def _default_state() -> dict:
    return {
        "assets": [],
        "employees": [],
        "issues": [],
        "notes": [],
        "catalog": {
            "types": [
                {"label": "IT", "value": "IT", "code": "IT"},
                {"label": "Store", "value": "Store", "code": "STO"},
                {"label": "Engineering", "value": "Engineering", "code": "ENG"},
                {"label": "Scientific", "value": "Scientific", "code": "SCI"},
            ],
            "categoriesByType": {
                "IT": [
                    {"label": "Computers/Peripherals", "code": "PC"},
                    {"label": "Office Equipment", "code": "OE"},
                    {"label": "Audio Visual Equipment", "code": "AV"},
                    {"label": "Software", "code": "SW"},
                    {"label": "Intangible Assets", "code": "IA"},
                ],
                "Store": [
                    {"label": "Equipments", "code": "EQ"},
                    {"label": "Furniture, Fixtures and Fittings", "code": "FF"},
                    {"label": "Sports Equipment", "code": "SP"},
                    {"label": "Library Books and Scientific Journals", "code": "LB"},
                    {"label": "Misc", "code": "MSC"},
                ],
                "Engineering": [
                    {"label": "Maintenance Services", "code": "MS"},
                    {"label": "Land", "code": "LD"},
                    {"label": "Site Development", "code": "SD"},
                    {"label": "Buildings", "code": "BL"},
                    {"label": "Plant and Machinery", "code": "PM"},
                    {"label": "Electrical Installation", "code": "EI"},
                    {"label": "Tube Wells and Water Supply System", "code": "TW"},
                    {"label": "Capital Work-in-Progress", "code": "CWP"},
                ],
                "Scientific": [
                    {"label": "Laboratory and Scientific Equipment", "code": "LS"},
                    {"label": "Equipments", "code": "EQ"},
                    {"label": "Audio Visual Equipment", "code": "AV"},
                    {"label": "Vehicles", "code": "VH"},
                    {"label": "Misc", "code": "MSC"},
                ],
            },
        },
        "counters": {},
    }


def _load_file_state() -> dict:
    if not STATE_FILE.exists():
        return _default_state()
    try:
        with STATE_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, dict):
                state = {**_default_state(), **data}
                issued_counts: dict[str, int] = {}
                for issue in state.get("issues", []):
                    if _normalize_status(issue.get("status")) != "returned":
                        aid = issue.get("assetId", "")
                        if aid:
                            issued_counts[aid] = issued_counts.get(aid, 0) + 1
                for asset in state.get("assets", []):
                    qty = int(asset.get("quantity", 1))
                    issued = issued_counts.get(asset.get("assetId", ""), 0)
                    asset["availableQuantity"] = max(0, qty - issued)
                for issue in state.get("issues", []):
                    issue["status"] = _normalize_status(issue.get("status")) or "issued"
                return state
    except (OSError, json.JSONDecodeError):
        pass
    return _default_state()


def _save_file_state(state: dict) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with STATE_FILE.open("w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
    except OSError:
        pass


def _load_auth_file() -> list[dict]:
    if not AUTH_FILE.exists():
        return []
    try:
        with AUTH_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _save_auth_file(users: list[dict]) -> None:
    try:
        AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
        with AUTH_FILE.open("w", encoding="utf-8") as handle:
            json.dump(users, handle, ensure_ascii=False, indent=2)
    except OSError:
        pass


@contextmanager
def _server_connection():
    connection = mysql.connector.connect(
        host=MYSQL_CONFIG["host"],
        port=MYSQL_CONFIG["port"],
        user=MYSQL_CONFIG["user"],
        password=MYSQL_CONFIG["password"],
    )
    try:
        yield connection
    finally:
        connection.close()


def _ensure_database() -> None:
    with _server_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{MYSQL_CONFIG['database']}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        connection.commit()
        cursor.close()


def _database_connection():
    return mysql.connector.connect(**MYSQL_CONFIG)


def _ensure_schema() -> None:
    try:
        _ensure_database()
        connection = _database_connection()
    except mysql.connector.Error:
        return
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS asset_counters (
                counter_key VARCHAR(120) PRIMARY KEY,
                counter_value INT NOT NULL DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS assets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                asset_id VARCHAR(80) NOT NULL UNIQUE,
                type_name VARCHAR(40) NOT NULL,
                category_name VARCHAR(120) NOT NULL,
                sub_category VARCHAR(120) DEFAULT '',
                make_name VARCHAR(120) DEFAULT '',
                model_name VARCHAR(120) DEFAULT '',
                quantity INT NOT NULL DEFAULT 1,
                serial_numbers JSON NOT NULL,
                invoice_no VARCHAR(120) DEFAULT '',
                invoice_file LONGTEXT,
                invoice_file_name VARCHAR(255) DEFAULT '',
                invoice_file_type VARCHAR(100) DEFAULT '',
                purchase_date DATE NULL,
                order_date DATE NULL,
                supply_date DATE NULL,
                source_i_note_no VARCHAR(120) DEFAULT '',
                source_i_note_item_desc VARCHAR(255) DEFAULT '',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        for statement in (
            "ALTER TABLE assets ADD COLUMN source_i_note_no VARCHAR(120) DEFAULT ''",
            "ALTER TABLE assets ADD COLUMN source_i_note_item_desc VARCHAR(255) DEFAULT ''",
        ):
            try:
                cursor.execute(statement)
            except mysql.connector.Error as exc:
                if exc.errno != 1060:
                    raise
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_code VARCHAR(80) NOT NULL UNIQUE,
                employee_name VARCHAR(150) NOT NULL,
                email VARCHAR(190) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS issues (
                id INT AUTO_INCREMENT PRIMARY KEY,
                issue_uid VARCHAR(80) NOT NULL UNIQUE,
                asset_id VARCHAR(80) NOT NULL,
                employee_id VARCHAR(80) NOT NULL,
                employee_code VARCHAR(80) NOT NULL,
                employee_name VARCHAR(150) NOT NULL,
                employee_email VARCHAR(190) NOT NULL,
                location_name VARCHAR(190) NOT NULL,
                issue_date DATE NOT NULL,
                serial_number VARCHAR(190) DEFAULT '',
                status_name VARCHAR(30) NOT NULL DEFAULT 'issued',
                return_date DATE NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_uid VARCHAR(80) NOT NULL UNIQUE,
                note_title VARCHAR(180) NOT NULL,
                note_type VARCHAR(60) NOT NULL,
                related_ref VARCHAR(120) DEFAULT '',
                priority_name VARCHAR(20) NOT NULL DEFAULT 'medium',
                status_name VARCHAR(20) NOT NULL DEFAULT 'open',
                note_body TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(80) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role_name VARCHAR(30) NOT NULL DEFAULT 'user',
                allowed_types JSON NOT NULL,
                full_name VARCHAR(150) DEFAULT '',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN allowed_types JSON NULL")
        except mysql.connector.Error as exc:
            if exc.errno != 1060:
                raise
        connection.commit()
        cursor.close()
    finally:
        connection.close()


def _auth_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="inventory-auth-token")


def _normalize_allowed_types(value) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = [part.strip() for part in value.split(",")]
    if not isinstance(value, list):
        return []
    seen = set()
    normalized = []
    for item in value:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def _normalize_role(value) -> str:
    role = str(value or "user").strip().lower()
    if role == "viewer":
        return "user"
    if role not in {"admin", "user"}:
        return "user"
    return role


def _public_user(row: dict | None) -> dict | None:
    if not row:
        return None
    role = _normalize_role(row["role_name"])
    return {
        "username": row["username"],
        "role": role,
        "fullName": row.get("full_name") or "",
        "allowedTypes": [] if role == "admin" else _normalize_allowed_types(row.get("allowed_types")),
    }


def _make_auth_token(user: dict) -> str:
    return _auth_serializer().dumps({
        "username": user["username"],
        "role": _normalize_role(user["role_name"]),
        "allowedTypes": _normalize_allowed_types(user.get("allowed_types")),
    })


def _user_count() -> int:
    try:
        connection = _database_connection()
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            count = int(cursor.fetchone()[0])
            cursor.close()
            return count or len(_load_auth_file())
        finally:
            connection.close()
    except mysql.connector.Error:
        return len(_load_auth_file())


def _load_user(username: str) -> dict | None:
    try:
        connection = _database_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT username, password_hash, role_name, allowed_types, full_name, is_active
                FROM users
                WHERE username = %s
                LIMIT 1
                """,
                (username,),
            )
            row = cursor.fetchone()
            cursor.close()
            if row:
                return row
        finally:
            connection.close()
    except mysql.connector.Error:
        pass
    normalized = username.strip().lower()
    for user in _load_auth_file():
        if str(user.get("username", "")).strip().lower() == normalized:
            return user
    return None


def _create_user(username: str, password: str, role: str = "user", full_name: str = "", allowed_types=None) -> dict:
    now = datetime.utcnow()
    role = _normalize_role(role)
    normalized_allowed_types = _normalize_allowed_types(allowed_types)
    try:
        connection = _database_connection()
        try:
            cursor = connection.cursor()
            cursor.execute(
                """
                INSERT INTO users (
                    username, password_hash, role_name, allowed_types, full_name, is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, 1, %s, %s)
                """,
                (
                    username,
                    generate_password_hash(password),
                    role,
                    json.dumps(normalized_allowed_types),
                    full_name,
                    now,
                    now,
                ),
            )
            connection.commit()
            cursor.close()
        finally:
            connection.close()
    except mysql.connector.Error:
        users = _load_auth_file()
        normalized = username.strip().lower()
        if any(str(user.get("username", "")).strip().lower() == normalized for user in users):
            raise ValueError("username already exists")
        users.append({
            "username": username,
            "password_hash": generate_password_hash(password),
            "role_name": role,
            "allowed_types": normalized_allowed_types,
            "full_name": full_name,
            "is_active": 1,
            "created_at": _serialize_datetime(now),
            "updated_at": _serialize_datetime(now),
        })
        _save_auth_file(users)
    return {
        "username": username,
        "role_name": role,
        "full_name": full_name,
        "allowed_types": normalized_allowed_types,
        "is_active": 1,
    }


def _list_users() -> list[dict]:
    try:
        connection = _database_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT username, role_name, allowed_types, full_name, is_active, created_at, updated_at
                FROM users
                ORDER BY created_at DESC
                """
            )
            rows = cursor.fetchall()
            cursor.close()
            if rows:
                return rows
        finally:
            connection.close()
    except mysql.connector.Error:
        pass
    return _load_auth_file()


def _update_user(username: str, *, role: str | None = None, full_name: str | None = None, allowed_types=None, is_active: int | None = None, password: str | None = None) -> dict | None:
    now = datetime.utcnow()
    normalized_allowed_types = _normalize_allowed_types(allowed_types) if allowed_types is not None else None
    try:
        connection = _database_connection()
        try:
            assignments = []
            values = []
            if role is not None:
                assignments.append("role_name = %s")
                values.append(role)
            if normalized_allowed_types is not None:
                assignments.append("allowed_types = %s")
                values.append(json.dumps(normalized_allowed_types))
            if full_name is not None:
                assignments.append("full_name = %s")
                values.append(full_name)
            if is_active is not None:
                assignments.append("is_active = %s")
                values.append(int(is_active))
            if password is not None:
                assignments.append("password_hash = %s")
                values.append(generate_password_hash(password))
            assignments.append("updated_at = %s")
            values.append(now)
            values.append(username)
            cursor = connection.cursor()
            cursor.execute(
                f"UPDATE users SET {', '.join(assignments)} WHERE username = %s",
                tuple(values),
            )
            connection.commit()
            changed = cursor.rowcount
            cursor.close()
            if changed:
                return _load_user(username)
        finally:
            connection.close()
    except mysql.connector.Error:
        pass

    users = _load_auth_file()
    normalized = username.strip().lower()
    updated = None
    for user in users:
        if str(user.get("username", "")).strip().lower() != normalized:
            continue
        if role is not None:
            user["role_name"] = role
        if normalized_allowed_types is not None:
            user["allowed_types"] = normalized_allowed_types
        if full_name is not None:
            user["full_name"] = full_name
        if is_active is not None:
            user["is_active"] = int(is_active)
        if password is not None:
            user["password_hash"] = generate_password_hash(password)
        user["updated_at"] = _serialize_datetime(now)
        updated = user
        break
    if updated:
        _save_auth_file(users)
    return updated


def _delete_user(username: str) -> bool:
    try:
        connection = _database_connection()
        try:
            cursor = connection.cursor()
            cursor.execute("DELETE FROM users WHERE username = %s", (username,))
            connection.commit()
            deleted = cursor.rowcount > 0
            cursor.close()
            if deleted:
                return True
        finally:
            connection.close()
    except mysql.connector.Error:
        pass

    users = _load_auth_file()
    normalized = username.strip().lower()
    next_users = [user for user in users if str(user.get("username", "")).strip().lower() != normalized]
    if len(next_users) == len(users):
        return False
    _save_auth_file(next_users)
    return True


def _token_user() -> dict | None:
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    try:
        payload = _auth_serializer().loads(token.strip(), max_age=AUTH_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    user = _load_user(str(payload.get("username", "")))
    if not user or not int(user.get("is_active") or 0):
        return None
    return user


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = _token_user()
        if not user:
            return jsonify({"error": "authentication required"}), 401
        request.environ["inventory_user"] = user
        return view(*args, **kwargs)
    return wrapped


def require_role(*roles):
    allowed = set(roles)

    def decorator(view):
        @require_auth
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = request.environ.get("inventory_user")
            if _normalize_role(user.get("role_name")) not in allowed:
                return jsonify({"error": "permission denied"}), 403
            return view(*args, **kwargs)
        return wrapped
    return decorator


def _parse_date(value):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_datetime(value):
    if not value:
        return datetime.utcnow()
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def _serialize_date(value):
    return value.isoformat() if value else ""


def _serialize_datetime(value):
    return value.isoformat(timespec="seconds") if value else ""


def _normalize_status(value) -> str:
    return str(value or "").strip().lower()


def _load_state():
    state = _default_state()
    try:
        connection = _database_connection()
    except mysql.connector.Error:
        return _load_file_state()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT asset_id, COUNT(*) as issued_count
            FROM issues
            WHERE status_name != 'returned'
            GROUP BY asset_id
            """
        )
        issued_counts = {row["asset_id"]: int(row["issued_count"]) for row in cursor.fetchall()}

        cursor.execute(
            """
            SELECT asset_id, type_name, category_name, sub_category, make_name, model_name,
                   quantity, serial_numbers, invoice_no, invoice_file, invoice_file_name,
                   invoice_file_type, purchase_date, order_date, supply_date,
                   source_i_note_no, source_i_note_item_desc, created_at, updated_at
            FROM assets
            ORDER BY created_at DESC
            """
        )
        state["assets"] = []
        for row in cursor.fetchall():
            serial_numbers = row["serial_numbers"]
            if isinstance(serial_numbers, str):
                serial_numbers = json.loads(serial_numbers)
            qty = int(row["quantity"] or 1)
            issued = issued_counts.get(row["asset_id"], 0)
            available_qty = max(0, qty - issued)
            state["assets"].append(
                {
                    "id": f"asset-{row['asset_id']}",
                    "assetId": row["asset_id"],
                    "type": row["type_name"],
                    "category": row["category_name"],
                    "subCategory": row["sub_category"] or "",
                    "make": row["make_name"] or "",
                    "model": row["model_name"] or "",
                    "quantity": qty,
                    "availableQuantity": available_qty,
                    "serialNumbers": serial_numbers or [],
                    "invoiceNo": row["invoice_no"] or "",
                    "invoiceFile": row["invoice_file"],
                    "invoiceFileName": row["invoice_file_name"] or "",
                    "invoiceFileType": row["invoice_file_type"] or "",
                    "purchaseDate": _serialize_date(row["purchase_date"]),
                    "orderDate": _serialize_date(row["order_date"]),
                    "supplyDate": _serialize_date(row["supply_date"]),
                    "sourceINoteNo": row["source_i_note_no"] or "",
                    "sourceINoteItemDescription": row["source_i_note_item_desc"] or "",
                    "createdAt": _serialize_datetime(row["created_at"]),
                    "updatedAt": _serialize_datetime(row["updated_at"]),
                }
            )

        cursor.execute(
            """
            SELECT employee_code, employee_name, email, created_at, updated_at
            FROM employees
            ORDER BY created_at DESC
            """
        )
        state["employees"] = [
            {
                "id": f"employee-{row['employee_code']}",
                "code": row["employee_code"],
                "name": row["employee_name"],
                "email": row["email"],
                "createdAt": _serialize_datetime(row["created_at"]),
                "updatedAt": _serialize_datetime(row["updated_at"]),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT issue_uid, asset_id, employee_id, employee_code, employee_name, employee_email,
                   location_name, issue_date, serial_number, status_name, return_date,
                   created_at, updated_at
            FROM issues
            ORDER BY created_at DESC
            """
        )
        state["issues"] = [
            {
                "id": row["issue_uid"],
                "assetId": row["asset_id"],
                "assetLabel": row["asset_id"],
                "employeeId": row["employee_id"],
                "employeeCode": row["employee_code"],
                "employeeName": row["employee_name"],
                "employeeEmail": row["employee_email"],
                "location": row["location_name"],
                "issueDate": _serialize_date(row["issue_date"]),
                "serialNumber": row["serial_number"] or "",
                "status": _normalize_status(row["status_name"]),
                "returnDate": _serialize_date(row["return_date"]),
                "createdAt": _serialize_datetime(row["created_at"]),
                "updatedAt": _serialize_datetime(row["updated_at"]),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT note_uid, note_title, note_type, related_ref, priority_name, status_name,
                   note_body, created_at, updated_at
            FROM notes
            ORDER BY created_at DESC
            """
        )
        state["notes"] = [
            {
                "id": row["note_uid"],
                "title": row["note_title"],
                "type": row["note_type"],
                "relatedRef": row["related_ref"] or "",
                "priority": row["priority_name"],
                "status": row["status_name"],
                "body": row["note_body"],
                "createdAt": _serialize_datetime(row["created_at"]),
                "updatedAt": _serialize_datetime(row["updated_at"]),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute("SELECT setting_value FROM app_settings WHERE setting_key = 'catalog' LIMIT 1")
        catalog_row = cursor.fetchone()
        if catalog_row and catalog_row["setting_value"]:
            try:
                state["catalog"] = json.loads(catalog_row["setting_value"])
            except json.JSONDecodeError:
                state["catalog"] = _default_state()["catalog"]
        else:
            state["catalog"] = _default_state()["catalog"]

        cursor.execute("SELECT counter_key, counter_value FROM asset_counters")
        state["counters"] = {row["counter_key"]: int(row["counter_value"]) for row in cursor.fetchall()}
        cursor.close()
        return state
    except mysql.connector.Error:
        return _load_file_state()
    finally:
        connection.close()


def _save_state(state):
    try:
        connection = _database_connection()
    except mysql.connector.Error:
        _save_file_state(state)
        return
    try:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM issues")
        cursor.execute("DELETE FROM employees")
        cursor.execute("DELETE FROM assets")
        cursor.execute("DELETE FROM notes")
        cursor.execute("DELETE FROM asset_counters")
        cursor.execute("DELETE FROM app_settings WHERE setting_key = 'catalog'")

        for asset in state.get("assets", []):
            cursor.execute(
                """
                INSERT INTO assets (
                    asset_id, type_name, category_name, sub_category, make_name, model_name,
                    quantity, serial_numbers, invoice_no, invoice_file, invoice_file_name,
                    invoice_file_type, purchase_date, order_date, supply_date,
                    source_i_note_no, source_i_note_item_desc, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    asset["assetId"],
                    asset["type"],
                    asset["category"],
                    asset.get("subCategory", ""),
                    asset.get("make", ""),
                    asset.get("model", ""),
                    int(asset.get("quantity", 1)),
                    json.dumps(asset.get("serialNumbers", [])),
                    asset.get("invoiceNo", ""),
                    asset.get("invoiceFile"),
                    asset.get("invoiceFileName", ""),
                    asset.get("invoiceFileType", ""),
                    _parse_date(asset.get("purchaseDate")),
                    _parse_date(asset.get("orderDate")),
                    _parse_date(asset.get("supplyDate")),
                    asset.get("sourceINoteNo", ""),
                    asset.get("sourceINoteItemDescription", ""),
                    _parse_datetime(asset.get("createdAt")),
                    _parse_datetime(asset.get("updatedAt")),
                ),
            )

        for employee in state.get("employees", []):
            cursor.execute(
                """
                INSERT INTO employees (
                    employee_code, employee_name, email, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    employee["code"],
                    employee["name"],
                    employee["email"],
                    _parse_datetime(employee.get("createdAt")),
                    _parse_datetime(employee.get("updatedAt")),
                ),
            )

        for issue in state.get("issues", []):
            cursor.execute(
                """
                INSERT INTO issues (
                    issue_uid, asset_id, employee_id, employee_code, employee_name, employee_email,
                    location_name, issue_date, serial_number, status_name, return_date, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    issue["id"],
                    issue["assetId"],
                    issue.get("employeeId") or issue.get("employeeCode") or "",
                    issue["employeeCode"],
                    issue["employeeName"],
                    issue["employeeEmail"],
                    issue["location"],
                    _parse_date(issue.get("issueDate")),
                    issue.get("serialNumber", ""),
                    _normalize_status(issue.get("status", "issued")) or "issued",
                    _parse_date(issue.get("returnDate")),
                    _parse_datetime(issue.get("createdAt")),
                    _parse_datetime(issue.get("updatedAt")),
                ),
            )

        for note in state.get("notes", []):
            cursor.execute(
                """
                INSERT INTO notes (
                    note_uid, note_title, note_type, related_ref, priority_name, status_name,
                    note_body, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    note["id"],
                    note["title"],
                    note["type"],
                    note.get("relatedRef", ""),
                    note.get("priority", "medium"),
                    note.get("status", "open"),
                    note["body"],
                    _parse_datetime(note.get("createdAt")),
                    _parse_datetime(note.get("updatedAt")),
                ),
            )

        for counter_key, counter_value in state.get("counters", {}).items():
            cursor.execute(
                """
                INSERT INTO asset_counters (counter_key, counter_value) VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE counter_value = VALUES(counter_value)
                """,
                (counter_key, int(counter_value)),
            )

        cursor.execute(
            """
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES ('catalog', %s, %s)
            """,
            (
                json.dumps(state.get("catalog", _default_state()["catalog"])),
                datetime.utcnow(),
            ),
        )

        connection.commit()
        cursor.close()
        _save_file_state(state)
    finally:
        connection.close()


def _allowed_counter_prefixes(allowed: set[str], catalog: dict) -> set[str]:
    prefixes = set(allowed)
    for item in catalog.get("types", []) or []:
        if item.get("value") in allowed or item.get("label") in allowed:
            prefixes.update(part for part in (item.get("value"), item.get("label"), item.get("code")) if part)
    return prefixes


def _filter_state_for_user(state: dict, user: dict | None) -> dict:
    if not user or _normalize_role(user.get("role_name")) == "admin":
        return state
    allowed = set(_normalize_allowed_types(user.get("allowed_types")))
    if not allowed:
        return {**state, "assets": [], "issues": []}

    assets = [asset for asset in state.get("assets", []) if asset.get("type") in allowed]
    asset_ids = {asset.get("assetId") for asset in assets}
    issues = [issue for issue in state.get("issues", []) if issue.get("assetId") in asset_ids]

    catalog = state.get("catalog") or {}
    filtered_catalog = {
        **catalog,
        "types": [item for item in catalog.get("types", []) if item.get("value") in allowed or item.get("label") in allowed],
        "categoriesByType": {
            key: value for key, value in (catalog.get("categoriesByType") or {}).items() if key in allowed
        },
        "subCategoriesByTypeAndCategory": {
            key: value for key, value in (catalog.get("subCategoriesByTypeAndCategory") or {}).items() if key in allowed
        },
    }
    allowed_counter_prefixes = _allowed_counter_prefixes(allowed, catalog)
    filtered_counters = {
        key: value
        for key, value in (state.get("counters") or {}).items()
        if key.split(":", 1)[0] in allowed_counter_prefixes
    }

    return {
        **state,
        "assets": assets,
        "issues": issues,
        "catalog": filtered_catalog,
        "counters": filtered_counters,
    }


def _merge_state_for_user(current_state: dict, submitted_state: dict, user: dict) -> dict:
    if _normalize_role(user.get("role_name")) == "admin":
        return submitted_state

    allowed = set(_normalize_allowed_types(user.get("allowed_types")))
    if not allowed:
        return current_state

    submitted_assets = [
        asset for asset in submitted_state.get("assets", [])
        if asset.get("type") in allowed
    ]
    submitted_allowed_asset_ids = {asset.get("assetId") for asset in submitted_assets}

    preserved_assets = [
        asset for asset in current_state.get("assets", [])
        if asset.get("type") not in allowed
    ]
    current_allowed_asset_ids = {
        asset.get("assetId")
        for asset in current_state.get("assets", [])
        if asset.get("type") in allowed
    }

    submitted_issues = [
        issue for issue in submitted_state.get("issues", [])
        if issue.get("assetId") in submitted_allowed_asset_ids
    ]
    preserved_issues = [
        issue for issue in current_state.get("issues", [])
        if issue.get("assetId") not in current_allowed_asset_ids
    ]

    current_catalog = current_state.get("catalog") or {}
    submitted_catalog = submitted_state.get("catalog") or {}
    merged_categories = dict(current_catalog.get("categoriesByType") or {})
    for type_name in allowed:
        if type_name in (submitted_catalog.get("categoriesByType") or {}):
            merged_categories[type_name] = submitted_catalog["categoriesByType"][type_name]
    merged_subcategories = dict(current_catalog.get("subCategoriesByTypeAndCategory") or {})
    for type_name in allowed:
        if type_name in (submitted_catalog.get("subCategoriesByTypeAndCategory") or {}):
            merged_subcategories[type_name] = submitted_catalog["subCategoriesByTypeAndCategory"][type_name]

    merged_catalog = {
        **current_catalog,
        "types": current_catalog.get("types") or submitted_catalog.get("types") or [],
        "categoriesByType": merged_categories,
        "subCategoriesByTypeAndCategory": merged_subcategories,
    }
    allowed_counter_prefixes = (
        _allowed_counter_prefixes(allowed, current_catalog)
        | _allowed_counter_prefixes(allowed, submitted_catalog)
    )
    submitted_counters = submitted_state.get("counters") or {}
    scoped_counters = {
        key: value
        for key, value in submitted_counters.items()
        if key.split(":", 1)[0] in allowed_counter_prefixes
    }

    return {
        **current_state,
        "assets": submitted_assets + preserved_assets,
        "employees": submitted_state.get("employees", current_state.get("employees", [])),
        "issues": submitted_issues + preserved_issues,
        "notes": submitted_state.get("notes", current_state.get("notes", [])),
        "catalog": merged_catalog,
        "counters": {**(current_state.get("counters") or {}), **scoped_counters},
    }


@app.before_request
def _bootstrap_schema():
    if request.path.startswith("/api/"):
        try:
            _ensure_schema()
        except mysql.connector.Error:
            pass


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<title>Inventory Backend</title></head><body style='font-family:Arial,sans-serif;padding:24px'>"
        "<h1>Inventory Backend is running</h1>"
        "<p>Use <code>/api/health</code> to check health and <code>/api/inventory</code> to load data.</p>"
        "</body></html>",
        200,
    )


@app.get("/api/auth/status")
def auth_status():
    try:
        return jsonify({"setupRequired": _user_count() == 0})
    except mysql.connector.Error as exc:
        return jsonify({"setupRequired": True, "databaseUnavailable": True, "error": str(exc)}), 503


@app.post("/api/auth/setup")
def auth_setup():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    full_name = str(payload.get("fullName") or "").strip()

    if not username or len(password) < 8:
        return jsonify({"error": "username and an 8+ character password are required"}), 400

    try:
        if _user_count() > 0:
            return jsonify({"error": "setup already completed"}), 409
        user = _create_user(username=username, password=password, role="admin", full_name=full_name)
    except (mysql.connector.Error, ValueError) as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({
        "token": _make_auth_token(user),
        "user": _public_user(user),
    }), 201


@app.post("/api/auth/login")
def auth_login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    try:
        user = _load_user(username)
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500

    if not user or not int(user.get("is_active") or 0) or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "invalid username or password"}), 401

    return jsonify({
        "token": _make_auth_token(user),
        "user": _public_user(user),
    })


@app.get("/api/auth/me")
@require_auth
def auth_me():
    return jsonify({"user": _public_user(request.environ.get("inventory_user"))})


@app.get("/api/users")
@require_role("admin")
def list_users():
    return jsonify({
        "users": [_public_user(user) | {"active": bool(int(user.get("is_active", 1) or 0))} for user in _list_users()]
    })


@app.post("/api/users")
@require_role("admin")
def create_user():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    full_name = str(payload.get("fullName") or "").strip()
    role = _normalize_role(payload.get("role") or "user")
    allowed_types = _normalize_allowed_types(payload.get("allowedTypes"))
    if role not in {"admin", "user"}:
        return jsonify({"error": "role must be admin or user"}), 400
    if role == "user" and not allowed_types:
        return jsonify({"error": "select at least one allowed asset type for user accounts"}), 400
    if not username or len(password) < 8:
        return jsonify({"error": "username and an 8+ character password are required"}), 400
    try:
        if _load_user(username):
            return jsonify({"error": "username already exists"}), 409
        user = _create_user(username=username, password=password, role=role, full_name=full_name, allowed_types=[] if role == "admin" else allowed_types)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"user": _public_user(user) | {"active": True}}), 201


@app.patch("/api/users/<path:username>")
@require_role("admin")
def update_user(username):
    payload = request.get_json(silent=True) or {}
    current_user = request.environ.get("inventory_user", {})
    role = payload.get("role")
    active = payload.get("active")
    full_name = payload.get("fullName")
    allowed_types = payload.get("allowedTypes")
    next_role = _normalize_role(role) if role is not None else None
    if next_role is not None and next_role not in {"admin", "user"}:
        return jsonify({"error": "role must be admin or user"}), 400
    normalized_allowed_types = _normalize_allowed_types(allowed_types) if allowed_types is not None else None
    if next_role == "user" and normalized_allowed_types is not None and not normalized_allowed_types:
        return jsonify({"error": "select at least one allowed asset type for user accounts"}), 400
    if active is False and username == current_user.get("username"):
        return jsonify({"error": "you cannot disable your own account"}), 400
    user = _update_user(
        username,
        role=next_role,
        full_name=str(full_name).strip() if full_name is not None else None,
        allowed_types=[] if next_role == "admin" else normalized_allowed_types,
        is_active=1 if active is True else 0 if active is False else None,
    )
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"user": _public_user(user) | {"active": bool(int(user.get("is_active", 1) or 0))}})


@app.post("/api/users/<path:username>/reset-password")
@require_role("admin")
def reset_user_password(username):
    payload = request.get_json(silent=True) or {}
    password = str(payload.get("password") or "")
    if len(password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400
    user = _update_user(username, password=password)
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"status": "password reset"})


@app.delete("/api/users/<path:username>")
@require_role("admin")
def delete_user(username):
    current_user = request.environ.get("inventory_user", {})
    if username == current_user.get("username"):
        return jsonify({"error": "you cannot delete your own account"}), 400
    if not _delete_user(username):
        return jsonify({"error": "user not found"}), 404
    return jsonify({"status": "deleted"})


@app.get("/api/inventory")
@require_auth
def get_inventory():
    try:
        return jsonify(_filter_state_for_user(_load_state(), request.environ.get("inventory_user")))
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500


@app.put("/api/inventory")
@require_role("admin", "user")
def put_inventory():
    payload = request.get_json(silent=True) or _default_state()
    try:
        user = request.environ.get("inventory_user")
        _save_state(_merge_state_for_user(_load_state(), payload, user))
        return jsonify({"status": "saved"})
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500


def _fetch_all_inote_records() -> list:
    """Fetch all pages and return a single list."""
    all_records = []
    page = 1
    batch = 100

    while True:
        query = urlparse.urlencode({"page": page, "limit": batch})
        url = f"{I_NOTE_API_BASE_URL}?{query}"
        req = urlrequest.Request(
            url,
            headers={"Accept": "application/json", "Api-Key": I_NOTE_API_KEY},
            method="GET",
        )
        with urlrequest.urlopen(req, timeout=30) as resp:
            body = resp.read()
            payload = json.loads(body.decode("utf-8"))

        records = []
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            for key in ("data", "records", "items", "result"):
                if isinstance(payload.get(key), list):
                    records = payload[key]
                    break

        if not records:
            break

        all_records.extend(records)

        total_pages = int(payload.get("total_pages") or payload.get("totalPages") or 1) if isinstance(payload, dict) else 1
        if page >= total_pages:
            break
        page += 1

    return all_records


def _positive_query_int(name: str, default: int) -> int:
    try:
        return max(1, int(request.args.get(name, str(default))))
    except (TypeError, ValueError):
        return default


def _inote_group(note: dict) -> str:
    fields = [
        str(note.get("order_no") or ""),
        str(note.get("purchaseDemandNo") or ""),
        str(note.get("purchase_demand_no") or ""),
        str(note.get("inote_no") or ""),
        str(note.get("note_uid") or ""),
    ]
    text = " ".join(fields).upper()
    if "/EQ/" in text:
        return "equipment"
    if "/CONS/" in text:
        return "consumables"
    return "other"


@app.get("/api/i-note-records")
@require_auth
def proxy_i_note_records():
    if not I_NOTE_API_KEY:
        return jsonify({"error": "missing i-note api key"}), 500

    page_int = _positive_query_int("page", 1)
    limit_int = _positive_query_int("limit", 10)
    q = request.args.get("q", "").strip().lower()
    group = request.args.get("group", "").strip().lower()

    # No search/group filter: forward the request directly to the upstream API.
    if not q and group not in {"equipment", "consumables"}:
        query = urlparse.urlencode({"page": page_int, "limit": limit_int})
        url = f"{I_NOTE_API_BASE_URL}?{query}"
        req = urlrequest.Request(
            url,
            headers={"Accept": "application/json", "Api-Key": I_NOTE_API_KEY},
            method="GET",
        )
        try:
            with urlrequest.urlopen(req, timeout=30) as resp:
                body = resp.read()
                content_type = resp.headers.get_content_type()
                status = resp.status
                if content_type == "application/json":
                    return jsonify(json.loads(body.decode("utf-8"))), status
                return body, status, {"Content-Type": content_type}
        except urlerror.HTTPError as exc:
            body = exc.read()
            return body, exc.code, {"Content-Type": exc.headers.get_content_type() if exc.headers else "text/plain"}
        except urlerror.URLError as exc:
            return jsonify({"error": f"upstream fetch failed: {exc.reason}"}), 502

    # Search/group filter is active: fetch all records and filter locally.
    try:
        all_records = _fetch_all_inote_records()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    def matches(note):
        fields = [
            str(note.get("inote_no") or ""),
            str(note.get("indent_no") or ""),
            str(note.get("order_no") or ""),
            str(note.get("invoice_no") or ""),
            str(note.get("agency") or ""),
            str(note.get("inote_dt") or ""),
            str(note.get("order_dt") or ""),
        ]
        return any(q in f.lower() for f in fields)

    filtered = [
        record for record in all_records
        if (not q or matches(record)) and (group not in {"equipment", "consumables"} or _inote_group(record) == group)
    ]
    total = len(filtered)
    total_pages = max(1, (total + limit_int - 1) // limit_int)
    start = (page_int - 1) * limit_int
    paginated = filtered[start: start + limit_int]

    return jsonify({
        "data": paginated,
        "page": page_int,
        "limit": limit_int,
        "total_records": total,
        "total_pages": total_pages,
        "status": True,
    }), 200


@app.get("/api/get-i-note")
@require_auth
def proxy_get_i_note():
    if not I_NOTE_API_KEY:
        return jsonify({"error": "missing i-note api key"}), 500

    i_note = request.args.get("i_note", "").strip()
    if not i_note:
        return jsonify({"error": "i_note parameter required"}), 400

    query = urlparse.urlencode({"i_note": i_note})
    url = f"{I_NOTE_DETAIL_API_URL}?{query}"

    req = urlrequest.Request(
        url,
        headers={
            "Accept": "application/json",
            "Api-Key": I_NOTE_API_KEY,
        },
        method="GET",
    )

    try:
        with urlrequest.urlopen(req, timeout=30) as resp:
            body = resp.read()
            content_type = resp.headers.get_content_type()
            if content_type == "application/json":
                return jsonify(json.loads(body.decode("utf-8"))), resp.status
            return body, resp.status, {"Content-Type": content_type}

    except urlerror.HTTPError as exc:
        body = exc.read()
        content_type = exc.headers.get_content_type() if exc.headers else "text/plain"
        if content_type == "application/json":
            try:
                return jsonify(json.loads(body.decode("utf-8"))), exc.code
            except json.JSONDecodeError:
                pass
        return body, exc.code, {"Content-Type": content_type}

    except urlerror.URLError as exc:
        return jsonify({"error": f"upstream fetch failed: {exc.reason}"}), 502


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    port = _env_int("PORT", 5000)
    app.run(host="0.0.0.0", port=port, debug=True)
