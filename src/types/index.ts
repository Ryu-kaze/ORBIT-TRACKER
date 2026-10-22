export interface LatLng {
  lat: number;
  lng: number;
}

export interface TelemetryPoint {
  id?: number | string;
  lat: number;
  lng: number;
  speed: number; // km/h
  altitude: number; // meters
  satellites: number;
  fix: boolean;
  accuracy?: number; // meters
  heading?: number; // degrees 0-360
  timestamp: number; // Unix ms
  session_id?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  enabled: boolean;
  color?: string;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
  lastState?: 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';
}

export interface SystemEvent {
  id: number | string;
  type: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'FIX_LOST' | 'FIX_REACQUIRED' | 'DEVICE_OFFLINE' | 'DEVICE_CONNECTED' | 'TRACKING_STARTED' | 'TRACKING_STOPPED';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  details?: Record<string, unknown>;
}

export interface DeviceStatus {
  device_id: string;
  display_name: string;
  online: boolean;
  last_seen: number;
  is_tracking: boolean;
  current_session_id?: string;
  last_lat?: number;
  last_lng?: number;
  last_speed?: number;
  last_altitude?: number;
  last_satellites?: number;
  last_fix?: boolean;
  points_recorded?: number;
}

export interface JourneySession {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  points: TelemetryPoint[];
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  durationMinutes: number;
}

export type AppMode = 'DEMO' | 'HARDWARE';
export type AppView = 'overview' | 'live' | 'history' | 'geofencing' | 'alerts' | 'analytics' | 'settings';
