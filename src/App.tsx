/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppMode, AppView, DeviceStatus, GeofenceZone, JourneySession, SystemEvent, TelemetryPoint } from './types';
import { apiService } from './services/api';
import { calculateRouteSummary } from './utils/geo';
import { serialService } from './services/serialService';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewView } from './views/OverviewView';
import { LiveTrackingView } from './views/LiveTrackingView';
import { HistoryView } from './views/HistoryView';
import { GeofencingView } from './views/GeofencingView';
import { AlertsView } from './views/AlertsView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [mode, setMode] = useState<AppMode>('DEMO');
  const [currentView, setCurrentView] = useState<AppView>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // USB Web Serial Cable State
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbPortInfo, setUsbPortInfo] = useState('');
  const [usbLogs, setUsbLogs] = useState<string[]>([]);

  // Telemetry & Device State
  const [currentPoint, setCurrentPoint] = useState<TelemetryPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<TelemetryPoint[]>([]);
  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [sessions, setSessions] = useState<JourneySession[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    device_id: 'ESP32-ORBIT-01',
    display_name: 'ORBIT Sentinel 01',
    online: false,
    last_seen: 0,
    is_tracking: false,
    last_fix: false,
    points_recorded: 0,
  });

  const [isTracking, setIsTracking] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(0);
  const [speedChartData, setSpeedChartData] = useState<Array<{ time: string; speed: number; altitude?: number }>>([]);

  // Telemetry loop ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize data on mode change
  useEffect(() => {
    if (mode === 'DEMO') {
      const demoGeos = apiService.getDemoGeofences();
      const demoEvs = apiService.getDemoEvents();
      const demoJourneys = apiService.getDemoJourneys();
      setGeofences(demoGeos);
      setEvents(demoEvs);
      setSessions(demoJourneys);

      // Seed initial demo point
      const initialPt = apiService.getNextDemoPoint();
      setCurrentPoint(initialPt);
      setRoutePoints([initialPt]);
      setSpeedChartData([
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          speed: initialPt.speed,
          altitude: initialPt.altitude,
        },
      ]);
    } else {
      // Hardware mode: fetch real hardware status & latest point from Flask API
      loadHardwareState();
    }
  }, [mode]);

  const loadHardwareState = async () => {
    const status = await apiService.fetchHardwareStatus();
    setDeviceStatus(status);
    const geofenceList = await apiService.fetchHardwareGeofences();
    if (geofenceList.length > 0) setGeofences(geofenceList);
    const eventList = await apiService.fetchHardwareEvents();
    if (eventList.length > 0) setEvents(eventList);

    const latest = await apiService.fetchHardwareLatestTelemetry();
    if (latest.available && latest.point) {
      setCurrentPoint(latest.point);
      setRoutePoints((prev) => [...prev, latest.point!]);
    }
  };

  // Main Telemetry Stream Timer (ticks every 2.5 seconds)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(async () => {
      setLastSyncTime(new Date());

      if (mode === 'DEMO') {
        if (isTracking) {
          const nextPt = apiService.getNextDemoPoint();
          setCurrentPoint(nextPt);
          setRoutePoints((prev) => {
            const next = [...prev, nextPt];
            return next.slice(-100); // keep last 100 points
          });

          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setSpeedChartData((prev) => {
            const next = [...prev, { time: timeStr, speed: nextPt.speed, altitude: nextPt.altitude }];
            return next.slice(-25); // keep last 25 readings for chart
          });

          setGeofences([...apiService.getDemoGeofences()]);
          setEvents([...apiService.getDemoEvents()]);
          setSessionDurationSeconds((s) => s + 2);
        }
      } else {
        // Hardware polling
        const status = await apiService.fetchHardwareStatus();
        setDeviceStatus(status);

        if (status.online) {
          const latest = await apiService.fetchHardwareLatestTelemetry();
          if (latest.available && latest.point) {
            setCurrentPoint(latest.point);
            setRoutePoints((prev) => [...prev.slice(-150), latest.point!]);

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setSpeedChartData((prev) => [
              ...prev.slice(-25),
              { time: timeStr, speed: latest.point!.speed, altitude: latest.point!.altitude },
            ]);
          }
          const evs = await apiService.fetchHardwareEvents();
          if (evs.length > 0) setEvents(evs);
        }
      }
    }, 2500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, isTracking]);

  // Route metrics calculation
  const routeSummary = calculateRouteSummary(routePoints);

  // Handlers
  const handleToggleTracking = () => {
    if (mode === 'DEMO') {
      const next = !isTracking;
      setIsTracking(next);
      apiService.setDemoTracking(next);
    } else {
      if (isTracking) {
        apiService.stopHardwareTracking().then(() => setIsTracking(false));
      } else {
        apiService.startHardwareTracking().then(() => setIsTracking(true));
      }
    }
  };

  // Web Serial cable integration
  useEffect(() => {
    serialService.setOnDataCallback((point: TelemetryPoint) => {
      setDeviceStatus((prev) => ({
        ...prev,
        online: true,
        last_seen: Date.now(),
        last_fix: point.fix,
        points_recorded: (prev.points_recorded || 0) + 1,
      }));
      setCurrentPoint(point);
      setRoutePoints((prev) => [...prev.slice(-150), point]);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSpeedChartData((prev) => [
        ...prev.slice(-25),
        { time: timeStr, speed: point.speed, altitude: point.altitude },
      ]);
      // Silently persist to backend in background
      apiService.postHardwareTelemetry(point).catch(() => {});
    });

    serialService.setOnRawLogCallback((line: string) => {
      setUsbLogs((prev) => [...prev.slice(-60), line]);
    });

    return () => {
      serialService.setOnDataCallback(null);
      serialService.setOnRawLogCallback(null);
    };
  }, []);

  const handleToggleUsb = async () => {
    if (usbConnected) {
      await serialService.disconnect();
      setUsbConnected(false);
      setUsbPortInfo('');
    } else {
      const res = await serialService.connect(115200);
      if (res.success) {
        setUsbConnected(true);
        setUsbPortInfo(serialService.getPortInfo());
        setMode('HARDWARE');
        setRoutePoints([]);
        setSpeedChartData([]);
      }
    }
  };

  const handleToggleMode = (newMode: AppMode) => {
    setMode(newMode);
    setRoutePoints([]);
    setSpeedChartData([]);
    setSessionDurationSeconds(0);
  };

  const handleAddGeofence = async (zone: Omit<GeofenceZone, 'id'>) => {
    if (mode === 'DEMO') {
      const created = apiService.addDemoGeofence(zone);
      setGeofences([...apiService.getDemoGeofences()]);
    } else {
      await apiService.createHardwareGeofence(zone);
      const list = await apiService.fetchHardwareGeofences();
      setGeofences(list);
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    if (mode === 'DEMO') {
      apiService.deleteDemoGeofence(id);
      setGeofences([...apiService.getDemoGeofences()]);
    } else {
      await apiService.deleteHardwareGeofence(id);
      const list = await apiService.fetchHardwareGeofences();
      setGeofences(list);
    }
  };

  const handleToggleGeofence = (id: string) => {
    if (mode === 'DEMO') {
      apiService.toggleDemoGeofence(id);
      setGeofences([...apiService.getDemoGeofences()]);
    } else {
      setGeofences((prev) =>
        prev.map((z) => (z.id === id ? { ...z, enabled: !z.enabled } : z))
      );
    }
  };

  const handleAcknowledgeEvent = async (id: number | string) => {
    if (mode === 'DEMO') {
      apiService.acknowledgeDemoEvent(id);
      setEvents([...apiService.getDemoEvents()]);
    } else {
      await apiService.acknowledgeHardwareEvent(id);
      const evs = await apiService.fetchHardwareEvents();
      setEvents(evs);
    }
  };

  const handleAcknowledgeAll = () => {
    setEvents((prev) => prev.map((e) => ({ ...e, acknowledged: true })));
  };

  const unreadAlertCount = events.filter((e) => !e.acknowledged).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#080D18] text-slate-100 font-sans selection:bg-[#48E5FF]/20 selection:text-[#48E5FF]">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={(v) => {
          setCurrentView(v);
          setMobileMenuOpen(false);
        }}
        mode={mode}
        onToggleMode={handleToggleMode}
        deviceStatus={deviceStatus}
        lastSyncTime={lastSyncTime}
        unreadAlertCount={unreadAlertCount}
        onOpenAlerts={() => {
          setCurrentView('alerts');
          setMobileMenuOpen(false);
        }}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        usbConnected={usbConnected}
        usbPortInfo={usbPortInfo}
        onToggleUsb={handleToggleUsb}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(v) => {
            setCurrentView(v);
            setMobileMenuOpen(false);
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mode={mode}
          deviceStatus={deviceStatus}
          unreadAlertCount={unreadAlertCount}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentView === 'overview' && (
            <OverviewView
              currentPoint={currentPoint}
              routePoints={routePoints}
              geofences={geofences}
              events={events}
              mode={mode}
              deviceStatus={deviceStatus}
              isTracking={isTracking}
              onToggleTracking={handleToggleTracking}
              onNavigate={setCurrentView}
              speedChartData={speedChartData}
              totalDistanceKm={routeSummary.totalDistanceKm}
              avgSpeedKmh={routeSummary.averageSpeedKmh}
              maxSpeedKmh={routeSummary.maxSpeedKmh}
            />
          )}

          {currentView === 'live' && (
            <LiveTrackingView
              currentPoint={currentPoint}
              routePoints={routePoints}
              geofences={geofences}
              mode={mode}
              deviceStatus={deviceStatus}
              isTracking={isTracking}
              totalDistanceKm={routeSummary.totalDistanceKm}
              sessionDurationSeconds={sessionDurationSeconds}
            />
          )}

          {currentView === 'history' && (
            <HistoryView sessions={sessions} />
          )}

          {currentView === 'geofencing' && (
            <GeofencingView
              geofences={geofences}
              currentPoint={currentPoint}
              events={events}
              onAddGeofence={handleAddGeofence}
              onDeleteGeofence={handleDeleteGeofence}
              onToggleGeofence={handleToggleGeofence}
            />
          )}

          {currentView === 'alerts' && (
            <AlertsView
              events={events}
              onAcknowledge={handleAcknowledgeEvent}
              onAcknowledgeAll={handleAcknowledgeAll}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsView
              sessions={sessions}
              speedChartData={speedChartData}
              totalDistanceKm={routeSummary.totalDistanceKm}
              avgSpeedKmh={routeSummary.averageSpeedKmh}
              maxSpeedKmh={routeSummary.maxSpeedKmh}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              mode={mode}
              deviceStatus={deviceStatus}
              onRefreshStatus={loadHardwareState}
              usbConnected={usbConnected}
              usbPortInfo={usbPortInfo}
              usbLogs={usbLogs}
              onToggleUsb={handleToggleUsb}
            />
          )}
        </main>
      </div>
    </div>
  );
}
