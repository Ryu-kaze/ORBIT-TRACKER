import React, { useState } from 'react';
import { JourneySession } from '../types';
import { SpeedChart } from '../components/charts/SpeedChart';
import {
  BarChart3,
  Calendar,
  Activity,
  Gauge,
  Clock,
  Navigation,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsViewProps {
  sessions: JourneySession[];
  speedChartData: Array<{ time: string; speed: number; altitude?: number }>;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  sessions,
  speedChartData,
  totalDistanceKm,
  avgSpeedKmh,
  maxSpeedKmh,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('7days');

  // Compute aggregated stats
  const totalSessionMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalSessionsCount = sessions.length;

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#48E5FF]" />
            <h2 className="text-base font-bold text-white">Telemetry & Movement Analytics</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historical aggregate calculations derived from authenticated ESP32 GPS fixes.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#080D18] rounded-lg border border-slate-800">
          {(['today', '7days', '30days', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? 'bg-[#48E5FF]/20 text-[#48E5FF] font-semibold border border-[#48E5FF]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === '7days' ? 'Last 7 Days' : p === '30days' ? 'Last 30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">TOTAL DISTANCE</span>
            <Activity className="w-4 h-4 text-[#48E5FF]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {(totalDistanceKm + (sessions.reduce((a, b) => a + b.totalDistanceKm, 0))).toFixed(2)}
            </span>
            <span className="text-xs text-[#48E5FF] font-mono">km</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Cumulative Travelled</span>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">AVERAGE VELOCITY</span>
            <Gauge className="w-4 h-4 text-[#8B7CFF]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {avgSpeedKmh.toFixed(1)}
            </span>
            <span className="text-xs text-[#8B7CFF] font-mono">km/h</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Ground Speed Average</span>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">MAX PEAK VELOCITY</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {maxSpeedKmh.toFixed(1)}
            </span>
            <span className="text-xs text-emerald-400 font-mono">km/h</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Highest Observed Reading</span>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl bg-[#111A2B] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">TRACKING SESSIONS</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {totalSessionsCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">Sessions ({totalSessionMinutes} min)</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Recorded In SQLite</span>
        </div>
      </div>

      {/* Speed & Altitude Chart */}
      <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Velocity & Altitude Progression Over Time</h3>
            <span className="text-xs text-slate-400 font-mono">
              Speed telemetry curve synchronized with barometric/GNSS altitude
            </span>
          </div>
        </div>
        <SpeedChart dataPoints={speedChartData} height={240} />
      </div>

      {/* Session Breakdown Data Table */}
      <div className="p-5 rounded-xl bg-[#111A2B] border border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-3">Session Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="py-2.5 px-3">Session Name</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Distance (km)</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
                <th className="py-2.5 px-3 text-right">Avg Speed</th>
                <th className="py-2.5 px-3 text-right">Peak Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-sans font-medium text-white">{s.name}</td>
                  <td className="py-3 px-3 text-slate-400">{new Date(s.startTime).toLocaleDateString()}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[#48E5FF]">{s.totalDistanceKm.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{s.durationMinutes}m</td>
                  <td className="py-3 px-3 text-right tabular-nums">{s.avgSpeedKmh.toFixed(1)} km/h</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[#8B7CFF]">{s.maxSpeedKmh.toFixed(1)} km/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
