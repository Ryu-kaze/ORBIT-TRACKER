import React, { useState } from 'react';
import { AppMode, DeviceStatus, GeofenceZone, TelemetryPoint } from '../types';
import { GpsMap } from '../components/map/GpsMap';
import {
  Copy,
  Check,
  Compass,
  Gauge,
  Satellite,
  Wifi,
  WifiOff,
  Clock,
  Navigation,
  FileCode,
  Shield,
  Layers,
} from 'lucide-react';

interface LiveTrackingViewProps {
  currentPoint: TelemetryPoint | null;
  routePoints: TelemetryPoint[];
  geofences: GeofenceZone[];
  mode: AppMode;
  deviceStatus?: DeviceStatus;
  isTracking: boolean;
  totalDistanceKm: number;
  sessionDurationSeconds: number;
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  currentPoint,
  routePoints,
  geofences,
  mode,
  deviceStatus,
  isTracking,
  totalDistanceKm,
  sessionDurationSeconds,
}) => {
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [showAccuracy, setShowAccuracy] = useState(true);
  const [showRawInspector, setShowRawInspector] = useState(false);

  const handleCopyCoords = () => {
    if (!currentPoint) return;
    navigator.clipboard.writeText(`${currentPoint.lat.toFixed(6)}, ${currentPoint.lng.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins}m ${secs}s`;
  };

  const isOnline = mode === 'DEMO' || Boolean(deviceStatus?.online);

  return (
    <div className="space-y-6">
      {/* Top Telemetry HUD Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Lat / Lng */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-mono tracking-wider">COORDINATES</span>
            <button
              onClick={handleCopyCoords}
              title="Copy GPS Coordinates"
              aria-label="Copy latitude and longitude"
              className="text-slate-400 hover:text-[#48E5FF] transition-colors"
            >
              {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-xs font-mono font-medium text-white truncate">
            {currentPoint ? `${currentPoint.lat.toFixed(5)}°, ${currentPoint.lng.toFixed(5)}°` : '0.00000°, 0.00000°'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">WGS-84 Datum</span>
        </div>

        {/* Speed */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider mb-1">SPEED</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white tabular-nums">
              {currentPoint?.speed !== undefined ? currentPoint.speed.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-[#48E5FF] font-mono">km/h</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Ground Velocity</span>
        </div>

        {/* Altitude */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider mb-1">ALTITUDE</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-[#8B7CFF] tabular-nums">
              {currentPoint?.altitude !== undefined ? currentPoint.altitude.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-[#8B7CFF] font-mono">m</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Above MSL</span>
        </div>

        {/* Satellites */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider mb-1">CONSTELLATION</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              {currentPoint?.satellites ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">SVs Tracked</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono block mt-0.5">
            {currentPoint?.fix ? 'Fix Valid (3D Lock)' : 'Acquiring...'}
          </span>
        </div>

        {/* Distance */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider mb-1">DISTANCE</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white tabular-nums">
              {totalDistanceKm.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">km</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Session Total</span>
        </div>

        {/* Session Time */}
        <div className="p-3.5 rounded-xl bg-[#111A2B] border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider mb-1">DURATION</span>
          <div className="text-sm font-bold font-mono text-white mt-1">
            {formatDuration(sessionDurationSeconds)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
            {isTracking ? 'Active Recording' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Main Full-Bleed Map Viewport */}
      <div className="relative">
        <GpsMap
          currentPosition={currentPoint ? { lat: currentPoint.lat, lng: currentPoint.lng } : null}
          currentPoint={currentPoint}
          routePoints={routePoints}
          geofences={geofences}
          showAccuracyCircle={showAccuracy}
          accuracyRadiusMeters={currentPoint?.accuracy || 12}
          heightClass="h-[620px]"
          autoCenter={true}
        />

        {/* Floating Quick Action Drawer (Top Left on Map) */}
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
          <button
            onClick={() => setShowAccuracy(!showAccuracy)}
            aria-label="Toggle accuracy circle"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-lg backdrop-blur-md ${
              showAccuracy
                ? 'bg-[#111A2B]/90 text-[#48E5FF] border-[#48E5FF]/40'
                : 'bg-[#111A2B]/90 text-slate-400 border-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Accuracy Circle</span>
          </button>

          <button
            onClick={() => setShowRawInspector(!showRawInspector)}
            aria-label="Toggle raw NMEA and JSON payload inspector"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-lg backdrop-blur-md ${
              showRawInspector
                ? 'bg-[#48E5FF]/20 text-[#48E5FF] border-[#48E5FF]/40'
                : 'bg-[#111A2B]/90 text-slate-300 border-slate-700/80 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Raw Telemetry</span>
          </button>
        </div>
      </div>

      {/* Raw Telemetry & NMEA Inspector Modal/Drawer */}
      {showRawInspector && (
        <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Raw Hardware Packet Inspector</h3>
              <span className="text-xs text-slate-400 font-mono">
                Decoded NMEA Sentence & JSON structure emitted by ESP32 TinyGPSPlus
              </span>
            </div>
            <button
              onClick={() => setShowRawInspector(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Decoded Telemetry JSON */}
            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">PARSED JSON PAYLOAD</span>
              <pre className="p-3 rounded-lg bg-[#080D18] border border-slate-800 font-mono text-xs text-[#48E5FF] overflow-x-auto">
{JSON.stringify(
  {
    device_id: mode === 'DEMO' ? 'SIM-ORBIT-01' : (deviceStatus?.device_id || 'ESP32-ORBIT-01'),
    lat: currentPoint?.lat,
    lng: currentPoint?.lng,
    speed_kmh: currentPoint?.speed,
    altitude_m: currentPoint?.altitude,
    satellites: currentPoint?.satellites,
    fix: currentPoint?.fix,
    heading_deg: currentPoint?.heading,
    accuracy_m: currentPoint?.accuracy,
    timestamp: currentPoint?.timestamp,
  },
  null,
  2
)}
              </pre>
            </div>

            {/* Simulated NMEA Format */}
            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">NMEA-0183 SATELLITE SENTENCE</span>
              <div className="p-3 rounded-lg bg-[#080D18] border border-slate-800 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
                <p className="text-slate-400">
                  $GPRMC,{new Date().toISOString().slice(11, 19).replace(/:/g, '')}.00,A,
                  {currentPoint ? `${Math.floor(Math.abs(currentPoint.lat))}${((Math.abs(currentPoint.lat) % 1) * 60).toFixed(4)},${currentPoint.lat >= 0 ? 'N' : 'S'}` : ''},
                  {currentPoint ? `0${Math.floor(Math.abs(currentPoint.lng))}${((Math.abs(currentPoint.lng) % 1) * 60).toFixed(4)},${currentPoint.lng >= 0 ? 'E' : 'W'}` : ''},
                  {currentPoint ? (currentPoint.speed / 1.852).toFixed(2) : '0.00'},{currentPoint?.heading?.toFixed(1) || '0.0'},221026,,,A*7A
                </p>
                <p className="text-slate-500">
                  $GPGGA,{new Date().toISOString().slice(11, 19).replace(/:/g, '')}.00,
                  {currentPoint?.lat.toFixed(4)},N,{currentPoint?.lng.toFixed(4)},W,1,{currentPoint?.satellites || 8},1.0,{currentPoint?.altitude.toFixed(1) || 30.0},M,,,,*47
                </p>
                <div className="mt-3 text-[11px] text-slate-400">
                  <span className="text-[#8B7CFF]">NEO-6M UART Protocol:</span> 9600 Baud, 8 Data Bits, No Parity, 1 Stop Bit. Connected to ESP32 GPIO 16 (RX2).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
