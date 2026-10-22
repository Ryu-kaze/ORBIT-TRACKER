/**
 * ORBIT GPS — Geospatial & Telemetry Logic Engine
 * Pure math and validation functions for GPS coordinates, Haversine distance,
 * geofence boundaries, and telemetry filtering.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TelemetryPoint extends LatLng {
  timestamp: number; // Unix timestamp in milliseconds
  speed?: number; // km/h
  altitude?: number; // meters
  satellites?: number;
  accuracy?: number; // meters
  heading?: number; // degrees
  fix?: boolean;
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
}

export type GeofenceState = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';

export interface GeofenceTransition {
  zoneId: string;
  zoneName: string;
  previousState: GeofenceState;
  newState: GeofenceState;
  timestamp: number;
  coordinate: LatLng;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Validates whether latitude and longitude are within legitimate Earth ranges.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // (0, 0) is Null Island — commonly emitted when GPS has zero fix
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Calculates the great-circle distance between two points on Earth using Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  coord1: LatLng,
  coord2: LatLng
): number {
  if (!isValidCoordinate(coord1.lat, coord1.lng) || !isValidCoordinate(coord2.lat, coord2.lng)) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10; // 0.1m precision
}

/**
 * Calculates distance in kilometers.
 */
export function calculateDistanceKm(coord1: LatLng, coord2: LatLng): number {
  return calculateHaversineDistance(coord1, coord2) / 1000;
}

/**
 * Computes compass bearing (0° to 360°) from point 1 to point 2.
 */
export function calculateBearing(coord1: LatLng, coord2: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Checks if a coordinate is strictly inside a circular geofence with optional hysteresis.
 * Hysteresis margin prevents rapid flapping when on boundary edge.
 */
export function isInsideGeofence(
  coord: LatLng,
  center: LatLng,
  radiusMeters: number,
  hysteresisMeters: number = 0
): boolean {
  if (!isValidCoordinate(coord.lat, coord.lng) || !isValidCoordinate(center.lat, center.lng)) {
    return false;
  }
  const distance = calculateHaversineDistance(coord, center);
  return distance <= radiusMeters + hysteresisMeters;
}

/**
 * Evaluates whether a coordinate transition constitutes an ENTRY or EXIT event.
 */
export function evaluateGeofenceTransition(
  zone: GeofenceZone,
  currentCoord: LatLng,
  previousState: GeofenceState = 'UNKNOWN',
  hysteresisMeters: number = 5
): { state: GeofenceState; transition: 'ENTER' | 'EXIT' | 'NONE' } {
  if (!zone.enabled || !isValidCoordinate(currentCoord.lat, currentCoord.lng)) {
    return { state: previousState, transition: 'NONE' };
  }

  // Apply hysteresis: if previously inside, need to exceed radius + hysteresis to exit
  // If previously outside, need to be within radius - hysteresis to enter
  const distance = calculateHaversineDistance(currentCoord, zone.center);
  let currentState: GeofenceState;

  if (previousState === 'INSIDE') {
    currentState = distance > zone.radiusMeters + hysteresisMeters ? 'OUTSIDE' : 'INSIDE';
  } else if (previousState === 'OUTSIDE') {
    currentState = distance < zone.radiusMeters - hysteresisMeters ? 'INSIDE' : 'OUTSIDE';
  } else {
    currentState = distance <= zone.radiusMeters ? 'INSIDE' : 'OUTSIDE';
  }

  let transition: 'ENTER' | 'EXIT' | 'NONE' = 'NONE';
  if (previousState === 'OUTSIDE' && currentState === 'INSIDE' && zone.notifyOnEntry) {
    transition = 'ENTER';
  } else if (previousState === 'INSIDE' && currentState === 'OUTSIDE' && zone.notifyOnExit) {
    transition = 'EXIT';
  }

  return { state: currentState, transition };
}

/**
 * Filter out noisy or physically impossible GPS jumps.
 * Max reasonable pedestrian/vehicle speed: 180 km/h (50 m/s).
 */
export function isPlausibleJump(
  prevPoint: TelemetryPoint,
  newPoint: TelemetryPoint,
  maxSpeedKmh: number = 220
): boolean {
  if (!isValidCoordinate(newPoint.lat, newPoint.lng)) return false;
  if (!prevPoint || !isValidCoordinate(prevPoint.lat, prevPoint.lng)) return true;

  const dtSeconds = Math.max(0.1, (newPoint.timestamp - prevPoint.timestamp) / 1000);
  const distanceMeters = calculateHaversineDistance(prevPoint, newPoint);
  const calculatedSpeedKmh = (distanceMeters / dtSeconds) * 3.6;

  return calculatedSpeedKmh <= maxSpeedKmh;
}

/**
 * Calculates summary metrics for a sequence of telemetry points.
 */
export function calculateRouteSummary(points: TelemetryPoint[]) {
  const validPoints = points.filter((p) => isValidCoordinate(p.lat, p.lng));
  if (validPoints.length < 2) {
    return {
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
      averageSpeedKmh: validPoints[0]?.speed || 0,
      maxSpeedKmh: validPoints[0]?.speed || 0,
      pointCount: validPoints.length,
    };
  }

  let totalDistanceMeters = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let speedCount = 0;

  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];

    const dist = calculateHaversineDistance(prev, curr);
    totalDistanceMeters += dist;

    const recordedSpeed = curr.speed ?? 0;
    if (recordedSpeed > maxSpeed) {
      maxSpeed = recordedSpeed;
    }
    if (recordedSpeed > 0) {
      speedSum += recordedSpeed;
      speedCount++;
    }
  }

  const startTime = validPoints[0].timestamp;
  const endTime = validPoints[validPoints.length - 1].timestamp;
  const totalDurationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
  const totalDistanceKm = totalDistanceMeters / 1000;

  // If speeds were recorded, use them; otherwise derive from distance / time
  const avgSpeed =
    speedCount > 0
      ? speedSum / speedCount
      : (totalDistanceKm / (totalDurationSeconds / 3600));

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalDurationSeconds,
    averageSpeedKmh: Math.round(avgSpeed * 10) / 10,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    pointCount: validPoints.length,
  };
}
