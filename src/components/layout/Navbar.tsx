import React from 'react';
import { AppMode, AppView, DeviceStatus } from '../../types';
import { Radio, Cpu, RefreshCw, Bell } from 'lucide-react';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  mode: AppMode;
  onToggleMode: (mode: AppMode) => void;
  deviceStatus?: DeviceStatus;
  lastSyncTime?: Date | null;
  unreadAlertCount: number;
  onOpenAlerts: () => void;
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  usbConnected?: boolean;
  usbPortInfo?: string;
  isConnectingUsb?: boolean;
  onToggleUsb?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  mode,
  onToggleMode,
  deviceStatus,
  lastSyncTime,
  unreadAlertCount,
  onOpenAlerts,
  mobileMenuOpen,
  onToggleMobileMenu,
  usbConnected = false,
  usbPortInfo,
  isConnectingUsb = false,
  onToggleUsb,
}) => {
  const isHardwareOnline = mode === 'HARDWARE' && deviceStatus?.online;
  const isDemo = mode === 'DEMO';

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-3 bg-[#080D18]/95 border-b border-slate-800/80 backdrop-blur-md">
      {/* Zone 1: Single text wordmark with mobile toggle */}
      <div className="flex items-center gap-3 shrink-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="lg:hidden p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60"
          >
            <Radio className="w-5 h-5 text-[#48E5FF]" />
          </button>
        )}
        <button
          onClick={() => onNavigate('overview')}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
          aria-label="Go to ORBIT GPS Overview"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#48E5FF] to-[#8B7CFF] flex items-center justify-center p-0.5 shadow-[0_0_15px_rgba(72,229,255,0.3)] hidden sm:flex">
            <div className="w-full h-full bg-[#080D18] rounded-[6px] flex items-center justify-center">
              <Radio className="w-4 h-4 text-[#48E5FF] group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-white font-sans whitespace-nowrap block leading-none">
              ORBIT <span className="text-[#48E5FF]">GPS</span>
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono tracking-wider uppercase block leading-none mt-1">
              Personal Tracking Intelligence
            </span>
          </div>
        </button>
      </div>

      {/* Zone 2: 4–5 concise single-line nav links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onNavigate('overview')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'overview' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => onNavigate('live')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'live' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Live Tracking
        </button>
        <button
          onClick={() => onNavigate('history')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'history' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Journey History
        </button>
        <button
          onClick={() => onNavigate('geofencing')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'geofencing' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Geofencing
        </button>
        <button
          onClick={() => onNavigate('analytics')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'analytics' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'settings' ? 'text-[#48E5FF] border-b-2 border-[#48E5FF]' : ''
          }`}
        >
          Device & Code
        </button>
      </nav>

      {/* Zone 3: Actions & Mode Selector */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Unboxed Metadata: Last Sync & Satellite Info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          {isDemo ? (
            <span className="text-[#8B7CFF]">DEMO SIMULATOR</span>
          ) : (
            <span className={isHardwareOnline ? 'text-emerald-400' : 'text-amber-400'}>
              {isHardwareOnline ? 'ESP32 LINKED' : 'WAITING FOR ESP32'}
            </span>
          )}
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="tabular-nums">
            {lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Active'}
          </span>
        </div>

        {/* USB Cable Direct Stream Button */}
        {onToggleUsb && (
          <button
            onClick={onToggleUsb}
            disabled={isConnectingUsb}
            title={
              usbConnected
                ? `USB Connected (${usbPortInfo || 'COM'}) — Click to disconnect`
                : isConnectingUsb
                ? 'Opening USB Serial selector...'
                : 'Connect ESP32 directly via USB Cable (COM3)'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg transition-all border ${
              usbConnected
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : isConnectingUsb
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                usbConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : isConnectingUsb
                  ? 'bg-cyan-400 animate-ping'
                  : 'bg-slate-500'
              }`}
            />
            <span className="hidden sm:inline">
              {usbConnected
                ? 'USB: Linked'
                : isConnectingUsb
                ? 'Connecting...'
                : 'Connect USB'}
            </span>
            <span className="sm:hidden">{usbConnected ? 'USB' : isConnectingUsb ? '...' : 'USB'}</span>
          </button>
        )}

        {/* Alerts Bell Button */}
        <button
          onClick={onOpenAlerts}
          aria-label={`View system alerts (${unreadAlertCount} unread)`}
          className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] shadow-[0_0_8px_#EF4444]" />
          )}
        </button>

        {/* Segmented Mode Selector Button (Demo vs Hardware) */}
        <div className="flex items-center p-0.5 bg-[#111A2B] rounded-lg border border-slate-700/80">
          <button
            onClick={() => onToggleMode('DEMO')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              isDemo
                ? 'bg-[#48E5FF]/20 text-[#48E5FF] shadow-sm font-semibold border border-[#48E5FF]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Demo Mode
          </button>
          <button
            onClick={() => onToggleMode('HARDWARE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              !isDemo
                ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] shadow-sm font-semibold border border-[#8B7CFF]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3 h-3" />
            Hardware ESP32
          </button>
        </div>
      </div>
    </header>
  );
};
