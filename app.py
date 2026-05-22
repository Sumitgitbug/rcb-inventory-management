from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

import mysql.connector
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv


load_dotenv()

# Keep backend fallback state outside the Vite project root so file writes
# do not trigger hot-reload loops in the frontend dev server.
STATE_FILE = Path.home() / ".inventory_management" / "inventory_state.json"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
    "port": _env_int("MYSQL_PORT", 3306),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "Sumit@123"),
    "database": os.getenv("MYSQL_DATABASE", "inventory_management"),
    "autocommit": False,
}


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    app.config["JSON_SORT_KEYS"] = False
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
                # Calculate availableQuantity from issues for file fallback too
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
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
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
        connection.commit()
        cursor.close()
    finally:
        connection.close()


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
        # First load all active issues so we can calculate availableQuantity per asset
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
                   created_at, updated_at
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
            # Each asset now has quantity=1 (one per serial number)
            # availableQuantity = quantity minus currently issued (not returned) issues
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
                    invoice_file_type, purchase_date, order_date, supply_date, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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


@app.get("/api/inventory")
def get_inventory():
    try:
        return jsonify(_load_state())
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500


@app.put("/api/inventory")
def put_inventory():
    payload = request.get_json(silent=True) or _default_state()
    try:
        _save_state(payload)
        return jsonify({"status": "saved"})
    except mysql.connector.Error as exc:
        return jsonify({"error": str(exc)}), 500


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    port = _env_int("PORT", 5000)
    app.run(host="0.0.0.0", port=port, debug=True)
