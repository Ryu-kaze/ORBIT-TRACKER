import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Terminal, AlertTriangle, Cpu, RefreshCw } from 'lucide-react';

export interface UsbModalInfo {
  isOpen: boolean;
  code?: string;
  title?: string;
  message?: string;
}

interface UsbConnectionModalProps {
  info: UsbModalInfo;
  onClose: () => void;
  onRetry?: () => void;
}

export const UsbConnectionModal: React.FC<UsbConnectionModalProps> = ({
  info,
  onClose,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  if (!info.isOpen) return null;

  const isIframe = info.code === 'IFRAME_RESTRICTED';
  const isBusy = info.code === 'PORT_BUSY';
  const isNotSupported = info.code === 'NOT_SUPPORTED';

  const powershellCmd = 'python -m pip install pyserial\npython backend/serial_bridge.py COM3';

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(powershellCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLocalTab = () => {
    try {
      window.open('http://localhost:3000', '_blank');
    } catch {
      window.location.href = 'http://localhost:3000';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isBusy ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              {isBusy ? <AlertTriangle className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-snug">
                {info.title || (isIframe ? 'USB Cable Direct Access' : 'USB Cable Connection')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isIframe ? 'Browser Sandbox Security Notice' : 'Hardware Serial Link (COM3)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Content based on issue */}
        {isIframe && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              Google Chrome and Microsoft Edge automatically disable the <span className="text-cyan-400 font-mono font-semibold">Web Serial API</span> inside embedded preview frames for security.
              <br /><br />
              Choose either of the two easy solutions below:
            </div>

            {/* Solution A: Open Localhost Tab */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider">
                  Option 1: Open in Dedicated Chrome Tab
                </span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                  1-Click
                </span>
              </div>
              <p className="text-xs text-slate-300">
                In a direct browser tab at <span className="text-white font-mono font-medium">http://localhost:3000</span>, clicking <b>Connect USB</b> prompts your OS to pick <b>COM3</b> without any restrictions.
              </p>
              <button
                onClick={handleOpenLocalTab}
                className="w-full mt-2 py-2 px-3 bg-[#48E5FF] hover:bg-[#38d4ee] text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <span>Launch http://localhost:3000 in New Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Solution B: Python Cable Bridge */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  Option 2: Run Cable Bridge in PowerShell
                </span>
                <button
                  onClick={handleCopyCmd}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-2.5 bg-[#080D18] rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 select-all overflow-x-auto">
                <div>python -m pip install pyserial</div>
                <div>python backend/serial_bridge.py COM3</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Or double-click <span className="text-cyan-300 font-mono">run_usb_bridge.bat</span> in your project folder!
              </p>
            </div>
          </div>
        )}

        {isBusy && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed space-y-2">
              <p className="font-semibold text-amber-300">
                Port COM3 is locked by another program.
              </p>
              <p>
                Windows only permits one app at a time to listen to COM3. Follow these 2 steps:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Go to <b>Arduino IDE</b>.</li>
                <li>Close the <b>Serial Monitor</b> window or tab.</li>
                <li>Click <b>Retry Connection</b> below.</li>
              </ol>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connecting COM3</span>
              </button>
            )}
          </div>
        )}

        {isNotSupported && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
              Your current browser does not have the Web Serial API enabled.
              <br /><br />
              Please switch to <b>Google Chrome</b> or <b>Microsoft Edge</b> on Windows, or use the Python serial bridge script.
            </div>
          </div>
        )}

        {!isIframe && !isBusy && !isNotSupported && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {info.message || 'Ensure your ESP32 is plugged in via USB and no other program has COM3 open.'}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
