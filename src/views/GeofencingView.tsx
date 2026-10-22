import React, { useState } from 'react';
import { GeofenceZone, LatLng, SystemEvent, TelemetryPoint } from '../types';
import { GpsMap } from '../components/map/GpsMap';
import { calculateHaversineDistance, isInsideGeofence } from '../utils/geo';
import {
  Shield,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  MapPin,
  Sliders,
  Bell,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface GeofencingViewProps {
  geofences: GeofenceZone[];
  currentPoint: TelemetryPoint | null;
  events: SystemEvent[];
  onAddGeofence: (zone: Omit<GeofenceZone, 'id'>) => void;
  onDeleteGeofence: (id: string) => void;
  onToggleGeofence: (id: string) => void;
}

export const GeofencingView: React.FC<GeofencingViewProps> = ({
  geofences,
  currentPoint,
  events,
  onAddGeofence,
  onDeleteGeofence,
  onToggleGeofence,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newRadius, setNewRadius] = useState<number>(200);
  const [selectedCenter, setSelectedCenter] = useState<LatLng | null>(
    currentPoint ? { lat: currentPoint.lat, lng: currentPoint.lng } : { lat: 37.4275, lng: -122.1697 }
  );

  const handleMapClick = (latlng: LatLng) => {
    setSelectedCenter(latlng);
  };

  const handleSaveGeofence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim() || !selectedCenter) return;

    onAddGeofence({
      name: newZoneName.trim(),
      center: selectedCenter,
      radiusMeters: newRadius,
      enabled: true,
      color: '#48E5FF',
      notifyOnEntry: true,
      notifyOnExit: true,
      lastState: 'OUTSIDE',
    });

    setNewZoneName('');
    setIsCreating(false);
  };

  // Filter geofence related events
  const geofenceEvents = events.filter(
    (e) => e.type === 'GEOFENCE_ENTER' || e.type === 'GEOFENCE_EXIT'
  );

  return (
    <div className="space-y-6">
      {/* Header & Create Zone Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#8B7CFF]" />
            Smart Geofencing Perimeter Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure circular boundary perimeters. Ingestion engine evaluates coordinates with 5m hysteresis dampening to prevent jitter.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          aria-label={isCreating ? "Cancel new perimeter" : "Add new perimeter"}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#48E5FF] text-slate-950 hover:bg-[#38d4ee] transition-all shadow-[0_0_15px_rgba(72,229,255,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? 'Cancel Creation' : 'New Geofence'}</span>
        </button>
      </div>

      {/* Creation Form Panel (when active) */}
      {isCreating && (
        <form onSubmit={handleSaveGeofence} className="p-5 rounded-xl bg-[#111A2B] border border-[#48E5FF]/40 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
              CREATE CIRCULAR GEOFENCE PERIMETER
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Click anywhere on the map to place center beacon
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">ZONE NAME</label>
              <input
                type="text"
                required
                placeholder="e.g. Science Complex, Home Depot"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#080D18] border border-slate-700 text-white text-xs font-sans focus:outline-none focus:border-[#48E5FF]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                RADIUS ({newRadius}m)
              </label>
              <input
                type="range"
                min={50}
                max={1500}
                step={25}
                value={newRadius}
                onChange={(e) => setNewRadius(Number(e.target.value))}
                className="w-full h-1.5 mt-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#48E5FF]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">CENTER COORDINATES</label>
              <div className="px-3 py-2 rounded-lg bg-[#080D18] border border-slate-800 font-mono text-xs text-[#48E5FF]">
                {selectedCenter ? `${selectedCenter.lat.toFixed(5)}°, ${selectedCenter.lng.toFixed(5)}°` : 'Click on map'}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#48E5FF] text-slate-950 hover:bg-[#38d4ee] shadow-md"
            >
              Save Perimeter
            </button>
          </div>
        </form>
      )}

      {/* Main Grid: Interactive Map & Zone List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map with Zones Rendered (2 Cols) */}
        <div className="lg:col-span-2 space-y-2">
          <GpsMap
            currentPosition={currentPoint ? { lat: currentPoint.lat, lng: currentPoint.lng } : null}
            currentPoint={currentPoint}
            geofences={geofences}
            heightClass="h-[520px]"
            autoCenter={false}
            onMapClick={isCreating ? handleMapClick : undefined}
          />
          {isCreating && (
            <div className="p-2.5 rounded-lg bg-[#080D18] border border-[#48E5FF]/30 text-center text-xs text-[#48E5FF] font-mono">
              ✦ Target mode active: Click anywhere on the map above to reposition the new perimeter center.
            </div>
          )}
        </div>

        {/* Zones List & Real-time Evaluation (1 Col) */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono block mb-3">
              ACTIVE PERIMETERS ({geofences.length})
            </span>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {geofences.map((zone) => {
                const isInside = currentPoint
                  ? isInsideGeofence(currentPoint, zone.center, zone.radiusMeters)
                  : false;
                const distanceToCenter = currentPoint
                  ? calculateHaversineDistance(currentPoint, zone.center)
                  : 0;

                return (
                  <div
                    key={zone.id}
                    className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: zone.color || '#48E5FF' }}
                        />
                        <strong className="text-xs text-white truncate max-w-[140px]">{zone.name}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onToggleGeofence(zone.id)}
                          title={zone.enabled ? 'Deactivate zone' : 'Activate zone'}
                          aria-label={`Toggle zone ${zone.name}`}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                            zone.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {zone.enabled ? 'ACTIVE' : 'MUTED'}
                        </button>
                        <button
                          onClick={() => onDeleteGeofence(zone.id)}
                          aria-label={`Delete zone ${zone.name}`}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                      <div>
                        <span>Radius: </span>
                        <span className="text-slate-200">{zone.radiusMeters}m</span>
                      </div>
                      <div>
                        <span>Beacon Dist: </span>
                        <span className="text-[#48E5FF]">{Math.round(distanceToCenter)}m</span>
                      </div>
                    </div>

                    {/* Inside / Outside Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-400">Device Status:</span>
                      <span
                        className={`font-mono font-semibold flex items-center gap-1 ${
                          isInside ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {isInside ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-400" /> Inside Zone
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-slate-500" /> Outside Perimeter
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Boundary Transitions */}
          <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
            <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono block mb-2.5">
              TRANSITION AUDIT LOG
            </span>
            <div className="space-y-2">
              {geofenceEvents.slice(0, 3).map((ev) => (
                <div key={ev.id} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className={ev.type === 'GEOFENCE_ENTER' ? 'text-emerald-400' : 'text-amber-400'}>
                      {ev.type === 'GEOFENCE_ENTER' ? 'ENTRY' : 'EXIT'}
                    </span>
                    <span className="text-slate-500">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-300 truncate">{ev.title}</p>
                </div>
              ))}
              {geofenceEvents.length === 0 && (
                <span className="text-xs text-slate-500 font-mono block">No boundary crossings logged yet.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
