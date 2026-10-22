import React, { useState } from 'react';
import { AppMode, AppView, DeviceStatus, GeofenceZone, SystemEvent, TelemetryPoint } from '../types';
import { GpsMap } from '../components/map/GpsMap';
import { SpeedChart } from '../components/charts/SpeedChart';
import {
  Play,
  Square,
  Copy,
  Check,
  Compass,
  Gauge,
  Satellite,
  Shield,
  Activity,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface OverviewViewProps {
  currentPoint: TelemetryPoint | null;
  routePoints: TelemetryPoint[];
  geofences: GeofenceZone[];
  events: SystemEvent[];
  mode: AppMode;
  deviceStatus?: DeviceStatus;
  isTracking: boolean;
  onToggleTracking: () => void;
  onNavigate: (view: AppView) => void;
  speedChartData: Array<{ time: string; speed: number; altitude?: number }>;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentPoint,
  routePoints,
  geofences,
  events,
  mode,
  deviceStatus,
  isTracking,
  onToggleTracking,
  onNavigate,
  speedChartData,
  totalDistanceKm,
  avgSpeedKmh,
  maxSpeedKmh,
}) => {
  const [copiedCoords, setCopiedCoords] = useState(false);

  const handleCopyCoords = () => {
    if (!currentPoint) return;
    const text = `${currentPoint.lat.toFixed(6)}, ${currentPoint.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const isHardwareOffline = mode === 'HARDWARE' && !deviceStatus?.online;

  return (
    <div className="space-y-6">
      {/* Mode & Tracking Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#111A2B] border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {isTracking ? (
              <>
                <span className="w-3 h-3 rounded-full bg-[#48E5FF] shadow-[0_0_12px_#48E5FF]" />
                <span className="absolute w-5 h-5 rounded-full bg-[#48E5FF]/40 animate-ping" />
              </>
            ) : (
              <span className="w-3 h-3 rounded-full bg-slate-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {isTracking ? 'Active Telemetry Stream' : 'Tracking Paused'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {mode === 'DEMO' ? '(Deterministic Simulator)' : '(Physical Hardware Node)'}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {mode === 'DEMO'
                ? 'Simulating campus route with GPS fix and geofence triggers'
                : isHardwareOffline
                ? 'Backend is listening. Power your ESP32 on same Wi-Fi to stream live data.'
                : 'Streaming real-time telemetry from ESP32 UART GPS over Wi-Fi.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentPoint && (
            <button
              onClick={handleCopyCoords}
              aria-label="Copy current GPS coordinates"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCoords ? 'Copied' : `${currentPoint.lat.toFixed(4)}, ${currentPoint.lng.toFixed(4)}`}</span>
            </button>
          )}

          <button
            onClick={onToggleTracking}
            aria-label={isTracking ? "Stop tracking" : "Start tracking"}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-md ${
              isTracking
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-[#48E5FF] text-slate-950 hover:bg-[#38d4ee] shadow-[0_0_15px_rgba(72,229,255,0.4)]'
            }`}
          >
            {isTracking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isTracking ? 'Stop Tracking' : 'Start Tracking'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Notice if offline */}
      {isHardwareOffline && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-300 mb-0.5">ESP32 Device Offline (Hardware Mode)</strong>
              <span>
                No active telemetry packets received yet. Run <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono text-amber-300">python app.py</code> on your laptop, configure your Wi-Fi in <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono text-amber-300">firmware/esp32_gps_tracker.ino</code>, and verify your laptop's LAN IP.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="shrink-0 flex items-center gap-1 text-amber-300 hover:text-white font-medium underline underline-offset-2"
          >
            Setup Guide <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Map & Compact Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Central Map Hero (3 Columns on Large Screens) */}
        <div className="lg:col-span-3">
          <GpsMap
            currentPosition={currentPoint ? { lat: currentPoint.lat, lng: currentPoint.lng } : null}
            currentPoint={currentPoint}
            routePoints={routePoints}
            geofences={geofences}
            showAccuracyCircle={true}
            accuracyRadiusMeters={currentPoint?.accuracy || 12}
            heightClass="h-[480px]"
            autoCenter={true}
          />
        </div>

        {/* 4 Compact Telemetry Cards (1 Column on Large Screens) */}
        <div className="space-y-3.5">
          {/* Card 1: Current Speed */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">CURRENT SPEED</span>
              <Gauge className="w-4 h-4 text-[#48E5FF]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-white">
                {currentPoint?.speed !== undefined ? currentPoint.speed.toFixed(1) : '0.0'}
              </span>
              <span className="text-xs text-[#48E5FF] font-mono">km/h</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#48E5FF] to-[#8B7CFF] transition-all duration-300"
                style={{ width: `${Math.min(100, ((currentPoint?.speed || 0) / 60) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono flex justify-between">
              <span>Avg: {avgSpeedKmh.toFixed(1)} km/h</span>
              <span>Max: {maxSpeedKmh.toFixed(1)} km/h</span>
            </div>
          </div>

          {/* Card 2: Total Distance */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">JOURNEY DISTANCE</span>
              <Activity className="w-4 h-4 text-[#8B7CFF]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-white">
                {totalDistanceKm.toFixed(2)}
              </span>
              <span className="text-xs text-[#8B7CFF] font-mono">km</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              Recorded Points: <span className="text-slate-200 tabular-nums">{routePoints.length}</span>
            </div>
          </div>

          {/* Card 3: GPS Satellite Lock */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">GNSS CONSTELLATION</span>
              <Satellite className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-white">
                {currentPoint?.satellites ?? 0}
              </span>
              <span className="text-xs text-emerald-400 font-mono">Satellites Tracked</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${currentPoint?.fix ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-slate-300">
                {currentPoint?.fix ? '3D DGPS Fix Locked' : 'Searching for Satellites...'}
              </span>
            </div>
          </div>

          {/* Card 4: Heading & Altitude */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">ORIENTATION & ALT</span>
              <Compass className="w-4 h-4 text-[#48E5FF]" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">HEADING</span>
                <span className="text-lg font-bold font-mono tabular-nums text-white">
                  {currentPoint?.heading !== undefined ? `${Math.round(currentPoint.heading)}°` : '0°'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">ALTITUDE</span>
                <span className="text-lg font-bold font-mono tabular-nums text-white">
                  {currentPoint?.altitude !== undefined ? `${currentPoint.altitude.toFixed(1)}m` : '0.0m'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Speed Over Time Chart & Mini Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Speed & Altitude Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Telemetry Profile: Speed & Elevation</h2>
              <span className="text-xs text-slate-400 font-mono">
                Real-time velocity curve (cyan) and altitude variation (violet)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#48E5FF]" />
                <span>Speed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#8B7CFF]" />
                <span>Altitude</span>
              </div>
            </div>
          </div>
          {speedChartData.length > 0 ? (
            <SpeedChart dataPoints={speedChartData} height={190} />
          ) : (
            <div className="h-[190px] flex items-center justify-center text-xs text-slate-500 font-mono">
              Waiting for telemetry data points...
            </div>
          )}
        </div>

        {/* Geofence Status & Quick Alerts (1 Col) */}
        <div className="space-y-4">
          {/* Geofence Summary */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#8B7CFF]" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">GEOFENCE STATUS</h3>
              </div>
              <button
                onClick={() => onNavigate('geofencing')}
                aria-label="Manage Geofences"
                className="text-[11px] text-[#48E5FF] hover:underline flex items-center gap-1"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {geofences.slice(0, 3).map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-medium text-slate-200 block truncate">{zone.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Radius: {zone.radiusMeters}m</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap ${
                      zone.lastState === 'INSIDE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {zone.lastState || 'MONITORED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Events Snippet */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">RECENT LOGS</span>
              <button
                onClick={() => onNavigate('alerts')}
                aria-label="View all system alerts"
                className="text-[11px] text-[#48E5FF] hover:underline flex items-center gap-1"
              >
                All Events <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {events.slice(0, 2).map((ev) => (
                <div key={ev.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span className={ev.severity === 'warning' ? 'text-amber-400' : 'text-[#48E5FF]'}>
                      {ev.type}
                    </span>
                    <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-200 truncate font-medium">{ev.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
