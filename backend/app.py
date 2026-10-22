#!/usr/bin/env python3
"""
ORBIT GPS — Backend REST API
Lightweight Flask API with SQLite storage, Haversine geospatial calculations,
hardware telemetry ingestion, geofence boundary monitoring, and event dispatch.
"""

import os
import math
import time
import json
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

try:
    from flask import Flask, request, jsonify, g
    from flask_cors import CORS
except ImportError:
    # Allows module to be imported in non-Flask test environments
    Flask = None
    CORS = None

DB_PATH = os.environ.get("ORBIT_DB_PATH", os.path.join(os.path.dirname(__file__), "orbit_gps.db"))
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
DEFAULT_TOKEN = os.environ.get("DEVICE_AUTH_TOKEN", "orbit_secret_token_2026")
EARTH_RADIUS_METERS = 6371000.0

def get_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = DB_PATH, schema_path: str = SCHEMA_PATH) -> None:
    with get_db(db_path) as conn:
        with open(schema_path, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        # Seed default device if none exists
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM device_state")
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                """
                INSERT INTO device_state (device_id, display_name, last_seen, is_tracking, current_session_id, last_fix)
                VALUES ('ESP32-ORBIT-01', 'ORBIT Sentinel 01', ?, 0, 'session-init', 0)
                """,
                (int(time.time() * 1000),)
            )
        # Seed default campus geofence if none exists
        cursor.execute("SELECT COUNT(*) FROM geofences")
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                """
                INSERT INTO geofences (id, name, center_lat, center_lng, radius_meters, enabled, notify_on_entry, notify_on_exit, last_state)
                VALUES ('zone-campus-main', 'Campus Main Perimeter', 37.7749, -122.4194, 250.0, 1, 1, 1, 'UNKNOWN')
                """
            )
        conn.commit()

# Geospatial calculations
def calculate_haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculates great circle distance in meters between two coordinates."""
    if not (is_valid_coordinate(lat1, lng1) and is_valid_coordinate(lat2, lng2)):
        return 0.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(EARTH_RADIUS_METERS * c, 2)

def is_valid_coordinate(lat: Any, lng: Any) -> bool:
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (ValueError, TypeError):
        return False
    if not (math.isfinite(lat_f) and math.isfinite(lng_f)):
        return False
    if lat_f < -90.0 or lat_f > 90.0 or lng_f < -180.0 or lng_f > 180.0:
        return False
    if abs(lat_f) < 0.0001 and abs(lng_f) < 0.0001:
        return False  # Null Island rejection
    return True

def process_geofence_transitions(conn: sqlite3.Connection, lat: float, lng: float, timestamp: int) -> List[Dict[str, Any]]:
    """Evaluates position against active geofences and logs transitions."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, center_lat, center_lng, radius_meters, notify_on_entry, notify_on_exit, last_state FROM geofences WHERE enabled = 1")
    zones = cursor.fetchall()

    new_events = []
    for zone in zones:
        dist = calculate_haversine(lat, lng, zone["center_lat"], zone["center_lng"])
        # Hysteresis buffer of 5m
        prev_state = zone["last_state"] or "UNKNOWN"
        radius = zone["radius_meters"]

        if prev_state == "INSIDE":
            curr_state = "OUTSIDE" if dist > (radius + 5.0) else "INSIDE"
        elif prev_state == "OUTSIDE":
            curr_state = "INSIDE" if dist < (radius - 5.0) else "OUTSIDE"
        else:
            curr_state = "INSIDE" if dist <= radius else "OUTSIDE"

        if curr_state != prev_state and prev_state != "UNKNOWN":
            event_type = None
            title = None
            message = None
            severity = "info"

            if prev_state == "OUTSIDE" and curr_state == "INSIDE" and zone["notify_on_entry"]:
                event_type = "GEOFENCE_ENTER"
                severity = "info"
                title = f"Entered {zone['name']}"
                message = f"Device arrived inside zone boundary ({int(dist)}m from center)."
            elif prev_state == "INSIDE" and curr_state == "OUTSIDE" and zone["notify_on_exit"]:
                event_type = "GEOFENCE_EXIT"
                severity = "warning"
                title = f"Exited {zone['name']}"
                message = f"Device moved outside zone perimeter ({int(dist)}m from center)."

            if event_type:
                details = json.dumps({"zone_id": zone["id"], "zone_name": zone["name"], "distance_meters": dist})
                cursor.execute(
                    """
                    INSERT INTO events (event_type, severity, title, message, timestamp, acknowledged, details_json)
                    VALUES (?, ?, ?, ?, ?, 0, ?)
                    """,
                    (event_type, severity, title, message, timestamp, details)
                )
                new_events.append({"type": event_type, "title": title, "message": message})

        # Update last state
        cursor.execute("UPDATE geofences SET last_state = ? WHERE id = ?", (curr_state, zone["id"]))

    return new_events

def create_app(db_path: str = DB_PATH) -> Any:
    if Flask is None:
        raise RuntimeError("Flask is not installed in the current environment")

    app = Flask(__name__)
    if CORS is not None:
        CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_db(db_path)

    def verify_auth_token() -> bool:
        auth_header = request.headers.get("Authorization", "")
        token = request.headers.get("X-Device-Token") or request.args.get("token")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
        
        # Also check payload token if POST JSON
        if not token and request.is_json:
            body = request.get_json(silent=True) or {}
            token = body.get("token")
        
        # When testing locally or if no token configured, accept DEFAULT_TOKEN
        expected_token = os.environ.get("DEVICE_AUTH_TOKEN", DEFAULT_TOKEN)
        return token == expected_token or not expected_token

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "online",
            "service": "ORBIT GPS Telemetry Engine",
            "version": "1.0.0",
            "timestamp": int(time.time() * 1000)
        })

    @app.route("/api/device/status", methods=["GET"])
    def device_status():
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM device_state LIMIT 1")
        row = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) FROM telemetry")
        point_count = cursor.fetchone()[0]
        conn.close()

        if not row:
            return jsonify({"status": "unknown", "points_recorded": 0})

        last_seen = row["last_seen"] or 0
        now_ms = int(time.time() * 1000)
        # Device is considered offline if no telemetry in last 60 seconds
        is_online = (now_ms - last_seen) < 60000 and last_seen > 0

        return jsonify({
            "device_id": row["device_id"],
            "display_name": row["display_name"],
            "online": is_online,
            "last_seen": last_seen,
            "is_tracking": bool(row["is_tracking"]),
            "current_session_id": row["current_session_id"],
            "last_lat": row["last_lat"],
            "last_lng": row["last_lng"],
            "last_speed": row["last_speed"],
            "last_altitude": row["last_altitude"],
            "last_satellites": row["last_satellites"],
            "last_fix": bool(row["last_fix"]),
            "points_recorded": point_count
        })

    @app.route("/api/telemetry", methods=["POST"])
    def ingest_telemetry():
        if not verify_auth_token():
            return jsonify({"error": "Unauthorized: Invalid or missing device token"}), 401

        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Bad Request: JSON payload required"}), 400

        device_id = str(data.get("device_id", "ESP32-ORBIT-01"))
        lat = data.get("lat")
        lng = data.get("lng")
        speed = float(data.get("speed", 0.0))
        altitude = float(data.get("altitude", 0.0))
        satellites = int(data.get("satellites", 0))
        fix = bool(data.get("fix", True))
        heading = float(data.get("heading", 0.0))
        accuracy = float(data.get("accuracy", 3.5))
        timestamp = int(data.get("timestamp") or time.time() * 1000)

        # Coordinate sanity check
        if not is_valid_coordinate(lat, lng):
            return jsonify({"error": "Invalid GPS coordinates: latitude [-90..90] and longitude [-180..180], non-zero required"}), 422

        conn = get_db(db_path)
        cursor = conn.cursor()

        # Check device tracking state
        cursor.execute("SELECT is_tracking, current_session_id FROM device_state WHERE device_id = ?", (device_id,))
        dev_row = cursor.fetchone()
        session_id = dev_row["current_session_id"] if dev_row else "session-live"

        # Check for GPS jump rejection vs previous point
        cursor.execute("SELECT latitude, longitude, timestamp FROM telemetry WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1", (device_id,))
        last_pt = cursor.fetchone()
        if last_pt:
            dt = max(0.2, (timestamp - last_pt["timestamp"]) / 1000.0)
            dist = calculate_haversine(last_pt["latitude"], last_pt["longitude"], lat, lng)
            speed_calc = (dist / dt) * 3.6
            if speed_calc > 220.0:  # Unrealistic jump (>220 km/h)
                conn.close()
                return jsonify({"warning": "Telemetry dropped: coordinate jump anomaly detected", "calculated_speed_kmh": round(speed_calc, 1)}), 422

        # Insert telemetry
        cursor.execute(
            """
            INSERT INTO telemetry (device_id, latitude, longitude, speed, altitude, satellites, fix, accuracy, heading, timestamp, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (device_id, lat, lng, speed, altitude, satellites, int(fix), accuracy, heading, timestamp, session_id)
        )

        # Update device status
        cursor.execute(
            """
            INSERT INTO device_state (device_id, display_name, last_seen, last_lat, last_lng, last_speed, last_altitude, last_satellites, last_fix)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
                last_seen = excluded.last_seen,
                last_lat = excluded.last_lat,
                last_lng = excluded.last_lng,
                last_speed = excluded.last_speed,
                last_altitude = excluded.last_altitude,
                last_satellites = excluded.last_satellites,
                last_fix = excluded.last_fix
            """,
            (device_id, "ORBIT Sentinel 01", timestamp, lat, lng, speed, altitude, satellites, int(fix))
        )

        # Evaluate geofences
        events_triggered = process_geofence_transitions(conn, lat, lng, timestamp)
        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "device_id": device_id,
            "received_lat": lat,
            "received_lng": lng,
            "events_triggered": events_triggered
        }), 201

    @app.route("/api/telemetry/latest", methods=["GET"])
    def get_latest_telemetry():
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, device_id, latitude, longitude, speed, altitude, satellites, fix, accuracy, heading, timestamp, session_id
            FROM telemetry ORDER BY timestamp DESC LIMIT 1
            """
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"available": False, "message": "No telemetry recorded yet"})

        return jsonify({
            "available": True,
            "point": {
                "id": row["id"],
                "device_id": row["device_id"],
                "lat": row["latitude"],
                "lng": row["longitude"],
                "speed": row["speed"],
                "altitude": row["altitude"],
                "satellites": row["satellites"],
                "fix": bool(row["fix"]),
                "accuracy": row["accuracy"],
                "heading": row["heading"],
                "timestamp": row["timestamp"],
                "session_id": row["session_id"]
            }
        })

    @app.route("/api/history", methods=["GET"])
    def get_history():
        limit = min(2000, int(request.args.get("limit", 500)))
        session_id = request.args.get("session_id")
        since = request.args.get("since")

        conn = get_db(db_path)
        cursor = conn.cursor()

        query = "SELECT latitude, longitude, speed, altitude, satellites, fix, timestamp, session_id FROM telemetry"
        params: List[Any] = []
        conditions = []

        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        if since:
            conditions.append("timestamp >= ?")
            params.append(int(since))

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        points = [
            {
                "lat": r["latitude"],
                "lng": r["longitude"],
                "speed": r["speed"],
                "altitude": r["altitude"],
                "satellites": r["satellites"],
                "fix": bool(r["fix"]),
                "timestamp": r["timestamp"],
                "session_id": r["session_id"]
            }
            for r in rows
        ]

        return jsonify({
            "count": len(points),
            "points": points
        })

    @app.route("/api/analytics", methods=["GET"])
    def get_analytics():
        days = int(request.args.get("days", 7))
        cutoff_ms = int((time.time() - (days * 86400)) * 1000)

        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT latitude, longitude, speed, altitude, timestamp, session_id
            FROM telemetry WHERE timestamp >= ? ORDER BY timestamp ASC
            """,
            (cutoff_ms,)
        )
        rows = cursor.fetchall()
        conn.close()

        if len(rows) < 2:
            return jsonify({
                "period_days": days,
                "total_distance_km": 0.0,
                "max_speed_kmh": 0.0,
                "avg_speed_kmh": 0.0,
                "total_points": len(rows),
                "sessions_count": 0,
                "speed_profile": []
            })

        total_dist_m = 0.0
        max_speed = 0.0
        speed_sum = 0.0
        speed_points = 0
        sessions = set()
        speed_profile = []

        for i in range(len(rows)):
            r = rows[i]
            sp = r["speed"] or 0.0
            if sp > max_speed:
                max_speed = sp
            if sp > 0:
                speed_sum += sp
                speed_points += 1
            if r["session_id"]:
                sessions.add(r["session_id"])

            if i > 0:
                prev = rows[i - 1]
                total_dist_m += calculate_haversine(prev["latitude"], prev["longitude"], r["latitude"], r["longitude"])

            # Sample down for chart if many points
            if len(rows) <= 60 or i % max(1, len(rows) // 60) == 0:
                speed_profile.append({
                    "time": datetime.fromtimestamp(r["timestamp"] / 1000, tz=timezone.utc).strftime("%H:%M:%S"),
                    "speed": round(sp, 1),
                    "altitude": round(r["altitude"] or 0.0, 1),
                    "timestamp": r["timestamp"]
                })

        avg_speed = speed_sum / max(1, speed_points)

        return jsonify({
            "period_days": days,
            "total_distance_km": round(total_dist_m / 1000.0, 2),
            "max_speed_kmh": round(max_speed, 1),
            "avg_speed_kmh": round(avg_speed, 1),
            "total_points": len(rows),
            "sessions_count": len(sessions),
            "speed_profile": speed_profile
        })

    # Geofences CRUD
    @app.route("/api/geofences", methods=["GET"])
    def list_geofences():
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, center_lat, center_lng, radius_meters, enabled, notify_on_entry, notify_on_exit, last_state FROM geofences ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([
            {
                "id": r["id"],
                "name": r["name"],
                "center": {"lat": r["center_lat"], "lng": r["center_lng"]},
                "radiusMeters": r["radius_meters"],
                "enabled": bool(r["enabled"]),
                "notifyOnEntry": bool(r["notify_on_entry"]),
                "notifyOnExit": bool(r["notify_on_exit"]),
                "lastState": r["last_state"]
            }
            for r in rows
        ])

    @app.route("/api/geofences", methods=["POST"])
    def create_geofence():
        data = request.get_json(silent=True) or {}
        name = data.get("name", "New Zone").strip()
        center = data.get("center", {})
        lat = center.get("lat")
        lng = center.get("lng")
        radius = float(data.get("radiusMeters", 200))

        if not is_valid_coordinate(lat, lng):
            return jsonify({"error": "Invalid center coordinates"}), 400

        zone_id = f"zone-{int(time.time())}"
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO geofences (id, name, center_lat, center_lng, radius_meters, enabled, notify_on_entry, notify_on_exit, last_state)
            VALUES (?, ?, ?, ?, ?, 1, 1, 1, 'UNKNOWN')
            """,
            (zone_id, name, lat, lng, radius)
        )
        conn.commit()
        conn.close()

        return jsonify({"id": zone_id, "name": name, "radiusMeters": radius}), 201

    @app.route("/api/geofences/<zone_id>", methods=["DELETE"])
    def delete_geofence(zone_id: str):
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM geofences WHERE id = ?", (zone_id,))
        conn.commit()
        conn.close()
        return jsonify({"deleted": True, "id": zone_id})

    # Events API
    @app.route("/api/events", methods=["GET"])
    def get_events():
        limit = min(100, int(request.args.get("limit", 50)))
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, event_type, severity, title, message, timestamp, acknowledged, details_json FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([
            {
                "id": r["id"],
                "type": r["event_type"],
                "severity": r["severity"],
                "title": r["title"],
                "message": r["message"],
                "timestamp": r["timestamp"],
                "acknowledged": bool(r["acknowledged"]),
                "details": json.loads(r["details_json"]) if r["details_json"] else {}
            }
            for r in rows
        ])

    @app.route("/api/events/<int:event_id>/acknowledge", methods=["POST"])
    def acknowledge_event(event_id: int):
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE events SET acknowledged = 1 WHERE id = ?", (event_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "acknowledged", "id": event_id})

    # Tracking Controls
    @app.route("/api/tracking/start", methods=["POST"])
    def start_tracking():
        session_id = f"session-{int(time.time())}"
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE device_state SET is_tracking = 1, current_session_id = ?", (session_id,))
        cursor.execute(
            """
            INSERT INTO events (event_type, severity, title, message, timestamp, acknowledged)
            VALUES ('TRACKING_STARTED', 'info', 'Tracking Session Initialized', 'Started session ' || ?, ?, 0)
            """,
            (session_id, int(time.time() * 1000))
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "tracking", "session_id": session_id})

    @app.route("/api/tracking/stop", methods=["POST"])
    def stop_tracking():
        conn = get_db(db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE device_state SET is_tracking = 0")
        cursor.execute(
            """
            INSERT INTO events (event_type, severity, title, message, timestamp, acknowledged)
            VALUES ('TRACKING_STOPPED', 'info', 'Tracking Session Concluded', 'Session saved to database.', ?, 0)
            """,
            (int(time.time() * 1000),)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "stopped"})

    return app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app = create_app()
    print(f"[*] ORBIT GPS Backend starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
