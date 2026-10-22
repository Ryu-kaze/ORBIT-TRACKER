import React, { useState } from 'react';
import { AppMode, DeviceStatus } from '../types';
import { apiService } from '../services/api';
import {
  Cpu,
  Radio,
  Server,
  Terminal,
  Copy,
  Check,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface SettingsViewProps {
  mode: AppMode;
  deviceStatus?: DeviceStatus;
  onRefreshStatus: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  mode,
  deviceStatus,
  onRefreshStatus,
}) => {
  const [backendUrl, setBackendUrl] = useState(apiService.getBackendUrl());
  const [deviceToken, setDeviceToken] = useState(apiService.getDeviceToken());
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Ping test state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);

  // Test packet state
  const [isSendingPacket, setIsSendingPacket] = useState(false);
  const [packetResult, setPacketResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    apiService.setBackendUrl(backendUrl);
    apiService.setDeviceToken(deviceToken);
    onRefreshStatus();
    setCopiedSection('config_saved');
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handlePingBackend = async () => {
    setIsPinging(true);
    setPingResult(null);
    const res = await apiService.pingBackend();
    setPingResult(res);
    setIsPinging(false);
  };

  const handleSendTestTelemetry = async () => {
    setIsSendingPacket(true);
    setPacketResult(null);
    // Send a test coordinate around campus (37.4278, -122.1695)
    const res = await apiService.sendTestTelemetry({
      lat: 37.42785,
      lng: -122.16965,
      speed: 24.5,
      altitude: 33.2,
      satellites: 9,
      heading: 45,
    });
    setPacketResult({ ok: res.ok, text: res.text });
    setIsSendingPacket(false);
    onRefreshStatus();
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sampleCurl = `curl -X POST "${backendUrl}/api/telemetry" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Token: ${deviceToken}" \\
  -d '{"device_id":"ESP32-ORBIT-01","token":"${deviceToken}","lat":37.42785,"lng":-122.16965,"speed":22.4,"altitude":34.0,"satellites":10,"fix":true,"heading":35.0,"timestamp":${Date.now()}}'`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#48E5FF]" />
          <h2 className="text-base font-bold text-white">Device Diagnostics & IoT Hardware Setup</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Hardware configuration for ESP32-WROOM-32 dev board paired with u-blox NEO-6M GPS receiver.
        </p>
      </div>

      {/* Grid: Diagnostics Status & Backend Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Status Panel */}
        <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
              HARDWARE LINK DIAGNOSTICS
            </span>
            <button
              onClick={onRefreshStatus}
              title="Refresh connection status"
              aria-label="Refresh hardware link diagnostics"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D18] border border-slate-800">
              <span className="text-slate-400">Operating Mode:</span>
              <span className="text-[#48E5FF] font-semibold">{mode}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D18] border border-slate-800">
              <span className="text-slate-400">Device Hardware ID:</span>
              <span className="text-white font-medium">{deviceStatus?.device_id || 'ESP32-ORBIT-01'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D18] border border-slate-800">
              <span className="text-slate-400">Wi-Fi Telemetry Stream:</span>
              <span className={`font-semibold ${mode === 'DEMO' || deviceStatus?.online ? 'text-emerald-400' : 'text-amber-400'}`}>
                {mode === 'DEMO' ? 'SIMULATED (ONLINE)' : deviceStatus?.online ? 'CONNECTED' : 'WAITING FOR PACKETS'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D18] border border-slate-800">
              <span className="text-slate-400">Total Telemetry Points:</span>
              <span className="text-white tabular-nums">{deviceStatus?.points_recorded || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D18] border border-slate-800">
              <span className="text-slate-400">GPS Satellites Tracked:</span>
              <span className="text-[#8B7CFF] tabular-nums">
                {mode === 'DEMO' ? '11 (Simulated)' : `${deviceStatus?.last_satellites ?? 0} SVs`}
              </span>
            </div>
          </div>
        </div>

        {/* Backend Endpoint & Token Configuration */}
        <form onSubmit={handleSaveConfig} className="p-5 rounded-xl bg-[#111A2B] border border-slate-800 space-y-4">
          <span className="text-xs font-semibold text-white uppercase font-mono tracking-wider block">
            FLASK REST API & AUTHENTICATION
          </span>

          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              BACKEND ENDPOINT URL
            </label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:5000 or http://192.168.1.150:5000"
              className="w-full px-3 py-2 rounded-lg bg-[#080D18] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#48E5FF]"
            />
            <span className="text-[10px] text-slate-500 font-mono block mt-1">
              When flashing ESP32, use your laptop's Wi-Fi LAN IP (run <code>ipconfig</code> in cmd).
            </span>
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              DEVICE AUTH TOKEN (SHARED SECRET)
            </label>
            <input
              type="text"
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
              placeholder="orbit_secret_token_2026"
              className="w-full px-3 py-2 rounded-lg bg-[#080D18] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#48E5FF]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePingBackend}
                disabled={isPinging}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <Server className="w-3.5 h-3.5 text-[#48E5FF]" />
                <span>{isPinging ? 'Pinging...' : 'Ping Server'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestTelemetry}
                disabled={isSendingPacket}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-[#8B7CFF]" />
                <span>{isSendingPacket ? 'Sending...' : 'Test POST'}</span>
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#48E5FF] text-slate-950 hover:bg-[#38d4ee] shadow-md transition-all"
            >
              {copiedSection === 'config_saved' ? 'Saved!' : 'Save Config'}
            </button>
          </div>

          {/* Ping result toast */}
          {pingResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                pingResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {pingResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{pingResult.message}</span>
              </div>
              {pingResult.latencyMs !== undefined && (
                <span className="tabular-nums font-bold">{pingResult.latencyMs}ms</span>
              )}
            </div>
          )}

          {/* Test Packet result */}
          {packetResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                packetResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Response: {packetResult.text}</span>
            </div>
          )}
        </form>
      </div>

      {/* Hardware Wiring Diagram & Pinout Specification */}
      <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
            ESP32 & NEO-6M HARDWARE SCHEMATIC & WIRING
          </span>
          <span className="text-xs text-[#48E5FF] font-mono">UART Serial2 (9600 Baud)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg bg-[#080D18] border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">UART RECEIVE (RX)</span>
            <div className="text-sm font-bold font-mono text-white">ESP32 GPIO 16</div>
            <span className="text-[11px] text-[#48E5FF] font-mono block mt-1">Connects to NEO-6M TX</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080D18] border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">UART TRANSMIT (TX)</span>
            <div className="text-sm font-bold font-mono text-white">ESP32 GPIO 17</div>
            <span className="text-[11px] text-[#8B7CFF] font-mono block mt-1">Connects to NEO-6M RX</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080D18] border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">POWER GROUND</span>
            <div className="text-sm font-bold font-mono text-white">ESP32 GND</div>
            <span className="text-[11px] text-emerald-400 font-mono block mt-1">Connects to NEO-6M GND</span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#080D18] border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">SUPPLY VOLTAGE</span>
            <div className="text-sm font-bold font-mono text-white">3.3V or 5V (VIN)</div>
            <span className="text-[11px] text-amber-400 font-mono block mt-1">Connects to NEO-6M VCC</span>
          </div>
        </div>

        {/* Beginner Debugging Tips */}
        <div className="p-4 rounded-lg bg-[#080D18] border border-slate-800/80 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-white font-semibold">
            <HelpCircle className="w-4 h-4 text-[#48E5FF]" />
            <span>NEO-6M LED Status Troubleshooting</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-400 font-sans text-xs">
            <li>
              <strong className="text-slate-200">Solid LED on NEO-6M:</strong> GPS is powered on but searching for satellite constellation. Test outdoors or near a window for initial cold-start lock (takes 1-3 minutes).
            </li>
            <li>
              <strong className="text-slate-200">Blinking 1Hz Pulse:</strong> GPS has acquired a valid 3D satellite lock. Telemetry packets will begin transmitting.
            </li>
            <li>
              <strong className="text-slate-200">No LED:</strong> Check jumper wires and ensure VCC is delivering 3.3V-5V and GND is firmly seated.
            </li>
          </ul>
        </div>
      </div>

      {/* Copyable curl Test Payload */}
      <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white uppercase font-mono tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#48E5FF]" />
            TEST WITH CURL FROM WINDOWS POWERSHELL / CMD
          </span>
          <button
            onClick={() => copyToClipboard(sampleCurl, 'curl')}
            aria-label="Copy curl command"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
          >
            {copiedSection === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSection === 'curl' ? 'Copied' : 'Copy Command'}</span>
          </button>
        </div>
        <pre className="p-3.5 rounded-lg bg-[#080D18] border border-slate-800 font-mono text-xs text-[#48E5FF] overflow-x-auto leading-relaxed">
{sampleCurl}
        </pre>
      </div>
    </div>
  );
};
