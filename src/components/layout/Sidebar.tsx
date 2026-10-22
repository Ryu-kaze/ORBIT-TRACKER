import React from 'react';
import { AppView, AppMode, DeviceStatus } from '../../types';
import {
  LayoutDashboard,
  Navigation,
  Route,
  Shield,
  Bell,
  BarChart3,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Satellite,
} from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mode: AppMode;
  deviceStatus?: DeviceStatus;
  unreadAlertCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mode,
  deviceStatus,
  unreadAlertCount,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'overview' as AppView, label: 'Overview', icon: LayoutDashboard },
    { id: 'live' as AppView, label: 'Live Tracking', icon: Navigation },
    { id: 'history' as AppView, label: 'Journey History', icon: Route },
    { id: 'geofencing' as AppView, label: 'Geofencing', icon: Shield },
    { id: 'alerts' as AppView, label: 'Alerts', icon: Bell, badge: unreadAlertCount },
    { id: 'analytics' as AppView, label: 'Analytics', icon: BarChart3 },
    { id: 'settings' as AppView, label: 'Device & Hardware', icon: Cpu },
  ];

  const isOnline = mode === 'DEMO' || Boolean(deviceStatus?.online);

  const handleItemClick = (id: AppView) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 bg-[#080D18] border-r border-slate-800/80 transition-all duration-300 z-50 shrink-0 flex flex-col justify-between ${
          mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
      {/* Navigation Links */}
      <div className="p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-[#111A2B] text-[#48E5FF] border border-[#48E5FF]/20 shadow-[0_0_15px_rgba(72,229,255,0.07)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#48E5FF]' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                {!collapsed && (
                  <span className="truncate whitespace-nowrap text-left flex-1">
                    {item.label}
                  </span>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Area: Hardware Diagnostics Snippet & Collapse Toggle */}
      <div className="p-3 border-t border-slate-800/80 bg-[#080D18]/50">
        {!collapsed && (
          <div className="mb-3 p-3 rounded-lg bg-[#111A2B]/80 border border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">TRACKER STATE</span>
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <Wifi className="w-3 h-3 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-amber-400" />
                )}
                <span className={`font-mono text-[10px] font-medium ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between">
              <span>{mode === 'DEMO' ? 'Simulator GPS' : (deviceStatus?.device_id || 'ESP32-ORBIT-01')}</span>
              <span className="text-[#48E5FF]">{mode === 'DEMO' ? '10 SVs' : `${deviceStatus?.last_satellites ?? 0} SVs`}</span>
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center py-2 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
    </>
  );
};
