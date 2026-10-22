import React, { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

interface SpeedChartProps {
  dataPoints: Array<{ time: string; speed: number; altitude?: number }>;
  height?: number;
}

export const SpeedChart: React.FC<SpeedChartProps> = ({ dataPoints, height = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = dataPoints.map((d) => d.time);
    const speeds = dataPoints.map((d) => d.speed);
    const altitudes = dataPoints.map((d) => d.altitude ?? 0);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(72, 229, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(72, 229, 255, 0.0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Speed (km/h)',
            data: speeds,
            borderColor: '#48E5FF',
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: dataPoints.length > 30 ? 0 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#48E5FF',
            pointBorderColor: '#080D18',
            pointBorderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Altitude (m)',
            data: altitudes,
            borderColor: 'rgba(139, 124, 255, 0.6)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [4, 4],
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            backgroundColor: '#111A2B',
            borderColor: 'rgba(72, 229, 255, 0.3)',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono', size: 11 },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            padding: 8,
            boxPadding: 4,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y ?? 0;
                return `${label}: ${val.toFixed(1)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748B',
              font: { family: 'JetBrains Mono', size: 10 },
              maxTicksLimit: 7,
            },
            border: { color: 'rgba(255, 255, 255, 0.08)' },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#48E5FF',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val} km/h`,
            },
            min: 0,
            border: { color: 'rgba(255, 255, 255, 0.08)' },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#8B7CFF',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val}m`,
            },
            border: { color: 'rgba(255, 255, 255, 0.08)' },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [dataPoints, height]);

  return (
    <div style={{ height: `${height}px` }} className="w-full relative">
      <canvas ref={canvasRef} />
    </div>
  );
};
