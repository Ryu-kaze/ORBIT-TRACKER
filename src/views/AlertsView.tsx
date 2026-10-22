import React, { useState } from 'react';
import { SystemEvent } from '../types';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  WifiOff,
  Filter,
  Check,
} from 'lucide-react';

interface AlertsViewProps {
  events: SystemEvent[];
  onAcknowledge: (id: number | string) => void;
  onAcknowledgeAll: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  events,
  onAcknowledge,
  onAcknowledgeAll,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'alert' | 'warning' | 'info'>('all');
  const [notificationStatus, setNotificationStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filterSeverity === 'all') return true;
    return e.severity === filterSeverity;
  });

  const unreadCount = events.filter((e) => !e.acknowledged).length;

  const getEventIcon = (type: string, severity: string) => {
    switch (type) {
      case 'GEOFENCE_ENTER':
      case 'GEOFENCE_EXIT':
        return <ShieldAlert className="w-4 h-4 text-[#8B7CFF]" />;
      case 'DEVICE_OFFLINE':
      case 'FIX_LOST':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return severity === 'alert' ? (
          <AlertTriangle className="w-4 h-4 text-rose-400" />
        ) : (
          <Info className="w-4 h-4 text-[#48E5FF]" />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#48E5FF]" />
            <h2 className="text-base font-bold text-white">System Events & Safety Alerts</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {unreadCount} Unacknowledged
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Audit log of geofence crossings, GNSS lock status changes, and network telemetry disconnections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {notificationStatus !== 'granted' && typeof Notification !== 'undefined' && (
            <button
              onClick={requestNotificationPermission}
              aria-label="Enable browser push notifications"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              Enable Browser Alerts
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={onAcknowledgeAll}
              aria-label="Acknowledge all alerts"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#48E5FF]/20 text-[#48E5FF] hover:bg-[#48E5FF]/30 border border-[#48E5FF]/40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Acknowledge All</span>
            </button>
          )}
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#111A2B] rounded-lg border border-slate-800 w-fit">
        {(['all', 'alert', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              filterSeverity === sev
                ? 'bg-[#48E5FF]/20 text-[#48E5FF] font-semibold border border-[#48E5FF]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {sev === 'all' ? 'All Alerts' : sev}
          </button>
        ))}
      </div>

      {/* Event Items List */}
      <div className="space-y-3">
        {filteredEvents.map((ev) => (
          <div
            key={ev.id}
            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              ev.acknowledged
                ? 'bg-[#111A2B]/60 border-slate-800/80 opacity-75'
                : 'bg-[#111A2B] border-slate-700 shadow-lg'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-[#080D18] border border-slate-800 shrink-0 mt-0.5">
                {getEventIcon(ev.type, ev.severity)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xs font-bold text-white font-sans">{ev.title}</h3>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded uppercase ${
                      ev.severity === 'alert'
                        ? 'bg-rose-500/20 text-rose-300'
                        : ev.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-[#48E5FF]/20 text-[#48E5FF]'
                    }`}
                  >
                    {ev.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{ev.message}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-2">
                  <span>{new Date(ev.timestamp).toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>Event ID: #{ev.id}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              {ev.acknowledged ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                </span>
              ) : (
                <button
                  onClick={() => onAcknowledge(ev.id)}
                  aria-label={`Acknowledge alert ${ev.title}`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  Mark Acknowledged
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-[#111A2B] border border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">No Alerts Matching Filter</h3>
            <p className="text-xs text-slate-400 mt-1">All telemetry bounds nominal.</p>
          </div>
        )}
      </div>
    </div>
  );
};
