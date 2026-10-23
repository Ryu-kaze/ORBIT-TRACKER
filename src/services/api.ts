/**
 * ORBIT GPS — Service Layer & REST API Client
 * Manages communication with the Flask backend or deterministic demo engine.
 */

import { DeviceStatus, GeofenceZone, JourneySession, SystemEvent, TelemetryPoint } from '../types';
import { DEMO_CAMPUS_ROUTE, DEMO_GEOFENCES, DEMO_EVENTS, DEMO_JOURNEYS } from '../data/demoData';
import { evaluateGeofenceTransition } from '../utils/geo';

const STORAGE_KEY_BACKEND_URL = 'orbit_gps_backend_url';
const STORAGE_KEY_DEVICE_TOKEN = 'orbit_gps_device_token';

export class OrbitApiService {
  private backendUrl: string;
  private deviceToken: string;

  // Local demo state
  private demoIndex = 0;
  private demoTracking = true;
  private demoGeofences: GeofenceZone[] = [...DEMO_GEOFENCES];
  private demoEvents: SystemEvent[] = [...DEMO_EVENTS];

  constructor() {
    this.backendUrl = localStorage.getItem(STORAGE_KEY_BACKEND_URL) || 'http://localhost:5000';
    this.deviceToken = localStorage.getItem(STORAGE_KEY_DEVICE_TOKEN) || 'orbit_secret_token_2026';
  }

  public getBackendUrl(): string {
    return this.backendUrl;
  }

  public setBackendUrl(url: string) {
    this.backendUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEY_BACKEND_URL, this.backendUrl);
  }

  public getDeviceToken(): string {
    return this.deviceToken;
  }

  public setDeviceToken(token: string) {
    this.deviceToken = token.trim();
    localStorage.setItem(STORAGE_KEY_DEVICE_TOKEN, this.deviceToken);
  }

  // --- HEALTH & PING ---
  public async pingBackend(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.backendUrl}/api/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, message: `Connected to ${data.service || 'Flask Engine'}`, latencyMs };
      }
      return { ok: false, message: `Server returned HTTP ${res.status}: ${res.statusText}` };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Cannot reach backend at ${this.backendUrl}: ${errorMsg}` };
    }
  }

  // --- HARDWARE API CALLS ---
  public async fetchHardwareStatus(): Promise<DeviceStatus> {
    try {
      const res = await fetch(`${this.backendUrl}/api/device/status`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.deviceToken}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        device_id: 'ESP32-ORBIT-01',
        display_name: 'ORBIT Sentinel 01',
        online: false,
        last_seen: 0,
        is_tracking: false,
        last_fix: false,
        points_recorded: 0,
      };
    }
  }

  public async fetchHardwareLatestTelemetry(): Promise<{ available: boolean; point?: TelemetryPoint }> {
    try {
      const res = await fetch(`${this.backendUrl}/api/telemetry/latest`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.deviceToken}`,
        },
      });
      if (!res.ok) return { available: false };
      return await res.json();
    } catch {
      return { available: false };
    }
  }

  public async postHardwareTelemetry(point: TelemetryPoint): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': this.deviceToken,
        },
        body: JSON.stringify({
          device_id: 'ESP32-ORBIT-01',
          lat: point.lat,
          lng: point.lng,
          speed: point.speed,
          altitude: point.altitude,
          satellites: point.satellites,
          fix: point.fix,
          heading: point.heading || 0,
          timestamp: point.timestamp || Date.now(),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async fetchHardwareHistory(sessionId?: string, limit: number = 500): Promise<TelemetryPoint[]> {
    try {
      const url = new URL(`${this.backendUrl}/api/history`);
      if (sessionId) url.searchParams.set('session_id', sessionId);
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.points || [];
    } catch {
      return [];
    }
  }

  public async fetchHardwareGeofences(): Promise<GeofenceZone[]> {
    try {
      const res = await fetch(`${this.backendUrl}/api/geofences`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public async createHardwareGeofence(zone: Partial<GeofenceZone>): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/geofences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deviceToken}`,
        },
        body: JSON.stringify(zone),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async deleteHardwareGeofence(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/geofences/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.deviceToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async fetchHardwareEvents(): Promise<SystemEvent[]> {
    try {
      const res = await fetch(`${this.backendUrl}/api/events?limit=50`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public async acknowledgeHardwareEvent(id: number | string): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/events/${id}/acknowledge`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async startHardwareTracking(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/tracking/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.deviceToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async stopHardwareTracking(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/tracking/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.deviceToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendTestTelemetry(point: Partial<TelemetryPoint>): Promise<{ ok: boolean; status: number; text: string }> {
    try {
      const payload = {
        device_id: 'ESP32-ORBIT-01',
        token: this.deviceToken,
        lat: point.lat,
        lng: point.lng,
        speed: point.speed ?? 15.5,
        altitude: point.altitude ?? 35.0,
        satellites: point.satellites ?? 9,
        fix: true,
        heading: point.heading ?? 45.0,
        accuracy: 2.5,
        timestamp: Date.now(),
      };
      const res = await fetch(`${this.backendUrl}/api/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': this.deviceToken,
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, text: msg };
    }
  }

  // --- DEMO MODE ENGINE ---
  public getNextDemoPoint(): TelemetryPoint {
    const pt = DEMO_CAMPUS_ROUTE[this.demoIndex];
    if (this.demoTracking) {
      this.demoIndex = (this.demoIndex + 1) % DEMO_CAMPUS_ROUTE.length;
    }

    // Evaluate demo geofences for transitions
    for (let i = 0; i < this.demoGeofences.length; i++) {
      const zone = this.demoGeofences[i];
      const result = evaluateGeofenceTransition(zone, pt, zone.lastState || 'UNKNOWN');
      if (result.transition === 'ENTER') {
        zone.lastState = 'INSIDE';
        this.demoEvents.unshift({
          id: Date.now(),
          type: 'GEOFENCE_ENTER',
          severity: 'info',
          title: `Entered ${zone.name}`,
          message: `Waypoint breached zone perimeter.`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      } else if (result.transition === 'EXIT') {
        zone.lastState = 'OUTSIDE';
        this.demoEvents.unshift({
          id: Date.now(),
          type: 'GEOFENCE_EXIT',
          severity: 'warning',
          title: `Exited ${zone.name}`,
          message: `Waypoint exited zone perimeter.`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }
    }

    return {
      ...pt,
      timestamp: Date.now(),
    };
  }

  public getDemoRoute(): TelemetryPoint[] {
    return DEMO_CAMPUS_ROUTE;
  }

  public getDemoGeofences(): GeofenceZone[] {
    return this.demoGeofences;
  }

  public addDemoGeofence(zone: Omit<GeofenceZone, 'id'>): GeofenceZone {
    const newZone: GeofenceZone = {
      ...zone,
      id: `zone-${Date.now()}`,
      lastState: 'OUTSIDE',
    };
    this.demoGeofences.push(newZone);
    return newZone;
  }

  public deleteDemoGeofence(id: string) {
    this.demoGeofences = this.demoGeofences.filter((z) => z.id !== id);
  }

  public toggleDemoGeofence(id: string) {
    this.demoGeofences = this.demoGeofences.map((z) =>
      z.id === id ? { ...z, enabled: !z.enabled } : z
    );
  }

  public getDemoEvents(): SystemEvent[] {
    return this.demoEvents;
  }

  public acknowledgeDemoEvent(id: number | string) {
    this.demoEvents = this.demoEvents.map((e) =>
      e.id === id ? { ...e, acknowledged: true } : e
    );
  }

  public getDemoJourneys(): JourneySession[] {
    return DEMO_JOURNEYS;
  }

  public setDemoTracking(active: boolean) {
    this.demoTracking = active;
  }

  public isDemoTracking(): boolean {
    return this.demoTracking;
  }

  public resetDemoIndex() {
    this.demoIndex = 0;
  }
}

export const apiService = new OrbitApiService();
