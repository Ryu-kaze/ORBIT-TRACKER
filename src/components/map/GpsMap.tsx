/**
 * ORBIT GPS — Interactive Leaflet Map Component
 * High-performance dark-themed telemetry map with pulsing beacon,
 * live breadcrumb path, geofence zones, and zoom/center controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GeofenceZone, LatLng, TelemetryPoint } from '../../types';
import { Crosshair, Maximize2, Shield, Eye, EyeOff } from 'lucide-react';

interface GpsMapProps {
  currentPosition?: LatLng | null;
  currentPoint?: TelemetryPoint | null;
  routePoints?: LatLng[];
  geofences?: GeofenceZone[];
  startPoint?: LatLng;
  endPoint?: LatLng;
  showAccuracyCircle?: boolean;
  accuracyRadiusMeters?: number;
  heightClass?: string;
  autoCenter?: boolean;
  onMapClick?: (latlng: LatLng) => void;
  interactive?: boolean;
}

export const GpsMap: React.FC<GpsMapProps> = ({
  currentPosition,
  currentPoint,
  routePoints = [],
  geofences = [],
  startPoint,
  endPoint,
  showAccuracyCircle = true,
  accuracyRadiusMeters = 15,
  heightClass = 'h-[520px]',
  autoCenter = false,
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const geofenceLayersRef = useRef<L.Circle[]>([]);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const endMarkerRef = useRef<L.CircleMarker | null>(null);

  const [followLive, setFollowLive] = useState(autoCenter);
  const [showGeofences, setShowGeofences] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = currentPosition
      ? [currentPosition.lat, currentPosition.lng]
      : [37.4275, -122.1697];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false, // We render custom HUD controls
      attributionControl: true,
    });

    // Free OpenStreetMap tile layer (no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'dark-osm-tile',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    // Trigger resize after paint
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (routePoints.length > 1) {
      const latlngs: [number, number][] = routePoints.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latlngs, {
        color: '#48E5FF',
        weight: 3.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: undefined,
      }).addTo(map);

      polylineRef.current = polyline;
    }
  }, [routePoints]);

  // Update Start & End Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();

    if (startPoint) {
      startMarkerRef.current = L.circleMarker([startPoint.lat, startPoint.lng], {
        radius: 6,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 1,
        weight: 2,
      }).bindPopup('<span style="color:#000;font-size:12px;font-weight:600;">Trip Origin</span>').addTo(map);
    }

    if (endPoint) {
      endMarkerRef.current = L.circleMarker([endPoint.lat, endPoint.lng], {
        radius: 6,
        color: '#8B7CFF',
        fillColor: '#8B7CFF',
        fillOpacity: 1,
        weight: 2,
      }).bindPopup('<span style="color:#000;font-size:12px;font-weight:600;">Trip Destination</span>').addTo(map);
    }
  }, [startPoint, endPoint]);

  // Update Geofences
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean old
    geofenceLayersRef.current.forEach((layer) => layer.remove());
    geofenceLayersRef.current = [];

    if (!showGeofences) return;

    geofences.forEach((zone) => {
      if (!zone.enabled) return;
      const color = zone.color || '#48E5FF';
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radiusMeters,
        color: color,
        weight: 1.5,
        opacity: 0.7,
        fillColor: color,
        fillOpacity: 0.12,
        dashArray: '4, 6',
      }).bindPopup(`
        <div style="font-family:sans-serif;color:#0F172A;padding:4px;">
          <strong style="display:block;font-size:13px;margin-bottom:2px;">${zone.name}</strong>
          <span style="font-size:11px;color:#64748B;">Radius: ${zone.radiusMeters}m · Status: ${zone.lastState || 'MONITORED'}</span>
        </div>
      `).addTo(map);

      geofenceLayersRef.current.push(circle);
    });
  }, [geofences, showGeofences]);

  // Update Live Position & Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentPosition) return;

    const latlng: [number, number] = [currentPosition.lat, currentPosition.lng];

    if (!markerRef.current) {
      // Create Custom Pulsing HTML Icon
      const beaconHtml = `
        <div class="relative flex items-center justify-center w-8 h-8 -translate-x-1/2 -translate-y-1/2">
          <span class="absolute w-8 h-8 rounded-full bg-[#48E5FF]/25 animate-ping"></span>
          <span class="absolute w-6 h-6 rounded-full bg-[#48E5FF]/40"></span>
          <span class="relative w-3.5 h-3.5 rounded-full bg-[#48E5FF] shadow-[0_0_12px_#48E5FF] border-2 border-white"></span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'orbit-beacon-marker',
        html: beaconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      markerRef.current = L.marker(latlng, { icon: customIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }

    // Accuracy Circle
    if (showAccuracyCircle) {
      const radius = currentPoint?.accuracy || accuracyRadiusMeters || 12;
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(latlng, {
          radius: radius,
          color: '#48E5FF',
          weight: 1,
          opacity: 0.4,
          fillColor: '#48E5FF',
          fillOpacity: 0.08,
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng(latlng);
        accuracyCircleRef.current.setRadius(radius);
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    // Auto Follow
    if (followLive) {
      map.panTo(latlng, { animate: true, duration: 0.8 });
    }
  }, [currentPosition, currentPoint, followLive, showAccuracyCircle, accuracyRadiusMeters]);

  // Actions
  const handleCenterOnDevice = () => {
    if (!mapInstanceRef.current || !currentPosition) return;
    mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 17, { animate: true });
    setFollowLive(true);
  };

  const handleFitRoute = () => {
    if (!mapInstanceRef.current) return;
    setFollowLive(false);

    const points: [number, number][] = [];
    if (routePoints.length > 0) {
      routePoints.forEach((p) => points.push([p.lat, p.lng]));
    } else if (currentPosition) {
      points.push([currentPosition.lat, currentPosition.lng]);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  };

  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta);
  };

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-800/80 bg-[#080D18] shadow-2xl`}>
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} aria-label="Interactive GPS Navigation Map" />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        <button
          onClick={handleCenterOnDevice}
          title={followLive ? "Centering Active" : "Center on Live Tracker"}
          aria-label="Center map on live device"
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-lg backdrop-blur-md ${
            followLive
              ? 'bg-[#48E5FF]/20 text-[#48E5FF] border-[#48E5FF]/40 shadow-[0_0_15px_rgba(72,229,255,0.2)]'
              : 'bg-[#111A2B]/90 text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-500'
          }`}
        >
          <Crosshair className={`w-3.5 h-3.5 ${followLive ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Center</span>
        </button>

        <button
          onClick={handleFitRoute}
          title="Fit recorded route to screen"
          aria-label="Fit entire route bounds"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#111A2B]/90 text-slate-300 border border-slate-700/80 hover:text-white hover:border-slate-500 transition-all shadow-lg backdrop-blur-md"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fit Route</span>
        </button>

        <button
          onClick={() => setShowGeofences(!showGeofences)}
          title={showGeofences ? "Hide Geofence Zones" : "Show Geofence Zones"}
          aria-label="Toggle geofence zones visibility"
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-lg backdrop-blur-md ${
            showGeofences
              ? 'bg-[#111A2B]/90 text-[#8B7CFF] border-[#8B7CFF]/40'
              : 'bg-[#111A2B]/90 text-slate-400 border-slate-700/80'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Zones</span>
        </button>

        <div className="flex flex-col bg-[#111A2B]/90 rounded-lg border border-slate-700/80 overflow-hidden shadow-lg backdrop-blur-md">
          <button
            onClick={() => handleZoom(1)}
            aria-label="Zoom In"
            className="px-3 py-1.5 text-sm font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            +
          </button>
          <div className="h-px bg-slate-800" />
          <button
            onClick={() => handleZoom(-1)}
            aria-label="Zoom Out"
            className="px-3 py-1.5 text-sm font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            −
          </button>
        </div>
      </div>

      {/* Floating Coordinate Bar (Bottom Left) */}
      {currentPosition && (
        <div className="absolute bottom-4 left-4 z-[400] max-w-sm rounded-lg bg-[#111A2B]/90 border border-slate-700/70 p-2.5 backdrop-blur-md shadow-xl text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider">LATITUDE</span>
              <span className="font-mono tabular-nums text-white font-medium text-xs">
                {currentPosition.lat.toFixed(6)}°
              </span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider">LONGITUDE</span>
              <span className="font-mono tabular-nums text-white font-medium text-xs">
                {currentPosition.lng.toFixed(6)}°
              </span>
            </div>
            {currentPoint?.altitude !== undefined && (
              <>
                <div className="w-px h-6 bg-slate-700" />
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider">ALT</span>
                  <span className="font-mono tabular-nums text-[#48E5FF] font-medium text-xs">
                    {currentPoint.altitude.toFixed(1)}m
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
