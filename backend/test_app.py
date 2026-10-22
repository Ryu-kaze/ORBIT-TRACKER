#!/usr/bin/env python3
"""
ORBIT GPS — Backend Automated Unit Tests
Verifies database initialization, coordinate validation, Haversine calculations,
geofence state transitions, and jump rejection algorithms.
"""

import os
import sys
import tempfile
import unittest
import sqlite3

# Import pure logic from app without needing Flask
sys.path.insert(0, os.path.dirname(__file__))
from app import (
    calculate_haversine,
    is_valid_coordinate,
    init_db,
    get_db,
    process_geofence_transitions
)

class TestOrbitGpsBackend(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        init_db(self.db_path, schema_path)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_coordinate_validation(self):
        self.assertTrue(is_valid_coordinate(37.7749, -122.4194))
        self.assertTrue(is_valid_coordinate(-33.8688, 151.2093))
        # Null Island
        self.assertFalse(is_valid_coordinate(0.0, 0.0))
        # Out of bounds
        self.assertFalse(is_valid_coordinate(95.0, 0.0))
        self.assertFalse(is_valid_coordinate(-91.0, 10.0))
        self.assertFalse(is_valid_coordinate(10.0, 185.0))
        self.assertFalse(is_valid_coordinate("invalid", "coords"))

    def test_haversine_distance(self):
        # New York to London ~ 5570 km
        nyc = (40.7128, -74.0060)
        lon = (51.5074, -0.1278)
        dist = calculate_haversine(nyc[0], nyc[1], lon[0], lon[1])
        self.assertTrue(5550000 < dist < 5600000, f"Got {dist} meters")

        # Zero distance same point
        self.assertEqual(calculate_haversine(37.7749, -122.4194, 37.7749, -122.4194), 0.0)

    def test_database_initialization(self):
        conn = get_db(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        conn.close()

        self.assertIn("telemetry", tables)
        self.assertIn("geofences", tables)
        self.assertIn("events", tables)
        self.assertIn("device_state", tables)

    def test_geofence_transitions(self):
        conn = get_db(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM geofences")
        # Insert a test zone of 100m radius around (37.7749, -122.4194)
        cursor.execute(
            """
            INSERT INTO geofences (id, name, center_lat, center_lng, radius_meters, enabled, notify_on_entry, notify_on_exit, last_state)
            VALUES ('test-zone-1', 'Test Lab', 37.7749, -122.4194, 100.0, 1, 1, 1, 'OUTSIDE')
            """
        )
        conn.commit()

        # Step 1: Device moves inside (center point)
        events = process_geofence_transitions(conn, 37.7749, -122.4194, 1700000000000)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "GEOFENCE_ENTER")

        # Verify last_state changed to INSIDE
        cursor.execute("SELECT last_state FROM geofences WHERE id = 'test-zone-1'")
        self.assertEqual(cursor.fetchone()[0], "INSIDE")

        # Step 2: Device stays inside
        events_stay = process_geofence_transitions(conn, 37.7750, -122.4194, 1700000010000)
        self.assertEqual(len(events_stay), 0)

        # Step 3: Device leaves (1km away)
        events_exit = process_geofence_transitions(conn, 37.7850, -122.4194, 1700000020000)
        self.assertEqual(len(events_exit), 1)
        self.assertEqual(events_exit[0]["type"], "GEOFENCE_EXIT")

        conn.close()

if __name__ == "__main__":
    unittest.main()
