import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  calculateHaversineDistance,
  calculateDistanceKm,
  calculateBearing,
  isInsideGeofence,
  evaluateGeofenceTransition,
  isPlausibleJump,
  calculateRouteSummary,
  GeofenceZone,
} from './geo';

test('isValidCoordinate accepts valid latitude and longitude', () => {
  assert.equal(isValidCoordinate(37.7749, -122.4194), true); // San Francisco
  assert.equal(isValidCoordinate(-33.8688, 151.2093), true); // Sydney
  assert.equal(isValidCoordinate(51.5074, -0.1278), true); // London
});

test('isValidCoordinate rejects invalid boundaries and Null Island', () => {
  assert.equal(isValidCoordinate(91, 0), false);
  assert.equal(isValidCoordinate(-91, 0), false);
  assert.equal(isValidCoordinate(0, 181), false);
  assert.equal(isValidCoordinate(0, -181), false);
  assert.equal(isValidCoordinate(0, 0), false); // Null Island GPS artifact
  assert.equal(isValidCoordinate(NaN, 10), false);
  assert.equal(isValidCoordinate('37', '-122'), false);
  assert.equal(isValidCoordinate(null, undefined), false);
});

test('calculateHaversineDistance computes accurate distance between landmarks', () => {
  // Distance between London (51.5074, -0.1278) and Paris (48.8566, 2.3522) is approx 343 km
  const london = { lat: 51.5074, lng: -0.1278 };
  const paris = { lat: 48.8566, lng: 2.3522 };
  const distMeters = calculateHaversineDistance(london, paris);
  const distKm = calculateDistanceKm(london, paris);

  assert.ok(distMeters > 340000 && distMeters < 346000, `Expected ~343km, got ${distMeters}m`);
  assert.ok(distKm > 340 && distKm < 346);
});

test('calculateBearing calculates compass direction accurately', () => {
  // Due North
  const p1 = { lat: 10, lng: 10 };
  const pNorth = { lat: 20, lng: 10 };
  const bearingNorth = calculateBearing(p1, pNorth);
  assert.ok(Math.abs(bearingNorth - 0) < 0.1 || Math.abs(bearingNorth - 360) < 0.1);

  // Due East
  const pEast = { lat: 10, lng: 20 };
  const bearingEast = calculateBearing(p1, pEast);
  assert.ok(Math.abs(bearingEast - 90) < 1.0);
});

test('isInsideGeofence accurately classifies points within radius', () => {
  const center = { lat: 37.7749, lng: -122.4194 };
  const radius = 500; // 500m

  // Exactly center
  assert.equal(isInsideGeofence(center, center, radius), true);

  // Point ~100m away
  const nearby = { lat: 37.7758, lng: -122.4194 }; // ~100m north
  assert.equal(isInsideGeofence(nearby, center, radius), true);

  // Point ~2000m away
  const farAway = { lat: 37.8, lng: -122.4194 };
  assert.equal(isInsideGeofence(farAway, center, radius), false);
});

test('evaluateGeofenceTransition triggers entry and exit events with hysteresis', () => {
  const zone: GeofenceZone = {
    id: 'zone-campus',
    name: 'College Campus',
    center: { lat: 37.7749, lng: -122.4194 },
    radiusMeters: 200,
    enabled: true,
    notifyOnEntry: true,
    notifyOnExit: true,
  };

  const insideCoord = { lat: 37.7749, lng: -122.4194 };
  const outsideCoord = { lat: 37.785, lng: -122.4194 }; // ~1.1km away

  // Coming from outside to inside -> ENTER
  const entryResult = evaluateGeofenceTransition(zone, insideCoord, 'OUTSIDE');
  assert.equal(entryResult.state, 'INSIDE');
  assert.equal(entryResult.transition, 'ENTER');

  // Moving from inside to outside -> EXIT
  const exitResult = evaluateGeofenceTransition(zone, outsideCoord, 'INSIDE');
  assert.equal(exitResult.state, 'OUTSIDE');
  assert.equal(exitResult.transition, 'EXIT');

  // Staying inside -> NONE
  const stayInsideResult = evaluateGeofenceTransition(zone, insideCoord, 'INSIDE');
  assert.equal(stayInsideResult.state, 'INSIDE');
  assert.equal(stayInsideResult.transition, 'NONE');
});

test('isPlausibleJump filters out teleportation/GPS jump glitches', () => {
  const t0 = 1700000000000;
  const p1 = { lat: 37.7749, lng: -122.4194, timestamp: t0 };

  // Reasonable move: 50m in 5 seconds = 36 km/h
  const p2 = { lat: 37.77535, lng: -122.4194, timestamp: t0 + 5000 };
  assert.equal(isPlausibleJump(p1, p2), true);

  // Impossible jump: 50km in 1 second = 180,000 km/h
  const pGlitch = { lat: 38.2, lng: -122.4194, timestamp: t0 + 1000 };
  assert.equal(isPlausibleJump(p1, pGlitch), false);
});

test('calculateRouteSummary computes correct stats across trajectory points', () => {
  const points = [
    { lat: 37.7749, lng: -122.4194, timestamp: 1000, speed: 10 },
    { lat: 37.7759, lng: -122.4194, timestamp: 20000, speed: 25 },
    { lat: 37.7769, lng: -122.4194, timestamp: 40000, speed: 15 },
  ];

  const summary = calculateRouteSummary(points);
  assert.ok(summary.totalDistanceKm > 0.2 && summary.totalDistanceKm < 0.25);
  assert.equal(summary.maxSpeedKmh, 25);
  assert.ok(summary.averageSpeedKmh > 10);
  assert.equal(summary.pointCount, 3);
  assert.equal(summary.totalDurationSeconds, 39);
});
