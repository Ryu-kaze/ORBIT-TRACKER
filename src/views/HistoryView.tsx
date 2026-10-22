import React, { useState, useEffect, useRef } from 'react';
import { JourneySession, TelemetryPoint } from '../types';
import { GpsMap } from '../components/map/GpsMap';
import { calculateRouteSummary } from '../utils/geo';
import {
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Clock,
  Navigation,
  Download,
  Gauge,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface HistoryViewProps {
  sessions: JourneySession[];
  onExportSession?: (session: JourneySession) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ sessions }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const points = activeSession?.points || [];
  const currentPlaybackPoint = points[playbackIndex] || points[0] || null;

  // Playback loop
  useEffect(() => {
    if (isPlaying && points.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, points.length]);

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    setIsPlaying(false);
    setPlaybackIndex(0);
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackIndex(0);
  };

  const handleExportGeoJson = () => {
    if (!activeSession) return;
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: activeSession.name,
            totalDistanceKm: activeSession.totalDistanceKm,
            avgSpeedKmh: activeSession.avgSpeedKmh,
            maxSpeedKmh: activeSession.maxSpeedKmh,
            startTime: activeSession.startTime,
            endTime: activeSession.endTime,
          },
          geometry: {
            type: 'LineString',
            coordinates: activeSession.points.map((p) => [p.lng, p.lat, p.altitude || 0]),
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.id}_orbit_gps.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeSession || sessions.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl bg-[#111A2B] border border-slate-800">
        <Navigation className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">No Journey History Recorded</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Telemetry points are indexed in SQLite upon every active tracking session. Start a session or use Demo Mode to inspect recorded journeys.
        </p>
      </div>
    );
  }

  const summary = calculateRouteSummary(points);
  const startPt = points[0] ? { lat: points[0].lat, lng: points[0].lng } : undefined;
  const endPt = points[points.length - 1] ? { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng } : undefined;

  // Render polyline up to current playback index if playback active
  const playedPoints = points.slice(0, playbackIndex + 1);

  return (
    <div className="space-y-6">
      {/* Session Selection & Summary Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List Drawer (1 Col) */}
        <div className="space-y-2">
          <span className="text-[11px] uppercase font-mono text-slate-400 tracking-wider block mb-1">
            RECORDED JOURNEYS ({sessions.length})
          </span>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {sessions.map((sess) => {
              const isSelected = sess.id === activeSession.id;
              return (
                <button
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  aria-label={`Select journey ${sess.name}`}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[#111A2B] border-[#48E5FF]/40 text-white shadow-[0_0_15px_rgba(72,229,255,0.1)]'
                      : 'bg-[#111A2B]/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold truncate">{sess.name}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#48E5FF]' : 'text-slate-600'}`} />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>{sess.totalDistanceKm.toFixed(2)} km</span>
                    <span>{sess.durationMinutes} min</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Journey Stats (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#111A2B] border border-slate-800 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-white">{activeSession.name}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#48E5FF]" />
                  {new Date(activeSession.startTime).toLocaleDateString()}
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#8B7CFF]" />
                  {new Date(activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <button
              onClick={handleExportGeoJson}
              aria-label="Export GeoJSON"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#48E5FF]" />
              <span>Export GeoJSON</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">DISTANCE</span>
              <span className="text-lg font-bold font-mono text-white tabular-nums">
                {activeSession.totalDistanceKm.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">km</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">DURATION</span>
              <span className="text-lg font-bold font-mono text-white tabular-nums">
                {activeSession.durationMinutes}
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">min</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">AVG SPEED</span>
              <span className="text-lg font-bold font-mono text-[#48E5FF] tabular-nums">
                {activeSession.avgSpeedKmh.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">km/h</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">PEAK VELOCITY</span>
              <span className="text-lg font-bold font-mono text-[#8B7CFF] tabular-nums">
                {activeSession.maxSpeedKmh.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Playback Control Bar */}
      <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pause replay' : 'Play journey replay'}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#48E5FF] text-slate-950 hover:bg-[#38d4ee] transition-all shadow-[0_0_15px_rgba(72,229,255,0.3)]"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleResetPlayback}
              title="Reset to Start"
              aria-label="Reset playback"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 bg-[#080D18] p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-[#48E5FF]/20 text-[#48E5FF] font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Current Waypoint HUD info */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <span>
              Waypoint <strong className="text-white tabular-nums">{playbackIndex + 1}</strong> of{' '}
              <span className="tabular-nums">{points.length}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Speed:{' '}
              <strong className="text-[#48E5FF] tabular-nums">
                {currentPlaybackPoint?.speed?.toFixed(1) || '0.0'} km/h
              </strong>
            </span>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, points.length - 1)}
            value={playbackIndex}
            onChange={(e) => {
              setPlaybackIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            aria-label="Journey playback progress"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#48E5FF]"
          />
        </div>
      </div>

      {/* Map displaying route with replay marker */}
      <GpsMap
        currentPosition={currentPlaybackPoint ? { lat: currentPlaybackPoint.lat, lng: currentPlaybackPoint.lng } : null}
        currentPoint={currentPlaybackPoint}
        routePoints={playedPoints}
        startPoint={startPt}
        endPoint={endPt}
        heightClass="h-[520px]"
        autoCenter={false}
      />
    </div>
  );
};
