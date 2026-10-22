-- ORBIT GPS SQLite Database Schema
-- High-performance indexed storage for personal IoT GPS telemetry

CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL DEFAULT 0.0,
    altitude REAL DEFAULT 0.0,
    satellites INTEGER DEFAULT 0,
    fix INTEGER DEFAULT 1,
    accuracy REAL DEFAULT 5.0,
    heading REAL DEFAULT 0.0,
    timestamp INTEGER NOT NULL,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_session ON telemetry(device_id, session_id);

CREATE TABLE IF NOT EXISTS geofences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    center_lat REAL NOT NULL,
    center_lng REAL NOT NULL,
    radius_meters REAL NOT NULL,
    enabled INTEGER DEFAULT 1,
    notify_on_entry INTEGER DEFAULT 1,
    notify_on_exit INTEGER DEFAULT 1,
    last_state TEXT DEFAULT 'UNKNOWN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- GEOFENCE_ENTER, GEOFENCE_EXIT, FIX_LOST, FIX_REACQUIRED, DEVICE_OFFLINE, DEVICE_CONNECTED
    severity TEXT NOT NULL,   -- info, warning, alert
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

CREATE TABLE IF NOT EXISTS device_state (
    device_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    last_seen INTEGER,
    is_tracking INTEGER DEFAULT 0,
    current_session_id TEXT,
    last_lat REAL,
    last_lng REAL,
    last_speed REAL,
    last_altitude REAL,
    last_satellites INTEGER,
    last_fix INTEGER DEFAULT 0
);
