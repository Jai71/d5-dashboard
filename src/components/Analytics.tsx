import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import type { DataPoint, Settings, Metrics } from '../types';
import type { PlaybackState } from '../hooks/usePlayback';
import { COLORS } from '../constants';
import { formatTime } from '../calculations';
import GanttTimeline from './GanttTimeline';
import PlaybackBar from './PlaybackBar';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  chartData: DataPoint[];
  metrics: Metrics;
  settings: Settings;
  playback: PlaybackState;
}

export default function Analytics({ chartData, metrics, settings, playback }: Props) {
  const violation = metrics.dischargeMin > metrics.chargeMin;

  // Prepare stacked area data with mains conversion
  const areaData = useMemo(
    () =>
      chartData.map((d) => ({
        time: d.time,
        timeLabel: formatTime(d.time),
        mains: (d.mainsRequest / 10) * settings.maxMains,
        wind: d.wind,
        solar: d.pv,
        totalLoad:
          d.ls1 * settings.load1Demand +
          d.ls2 * settings.load2Demand +
          d.ls3 * settings.load3Demand,
      })),
    [chartData, settings]
  );

  const currentTime = chartData[playback.position]?.time ?? 0;

  // Donut data — cumulative up to playback position
  const donutData = useMemo(() => {
    const slice = chartData.slice(0, playback.position + 1);
    let totalSolar = 0;
    let totalWind = 0;
    let totalMains = 0;
    for (const d of slice) {
      totalSolar += d.pv;
      totalWind += d.wind;
      totalMains += (d.mainsRequest / 10) * settings.maxMains;
    }
    const total = totalSolar + totalWind + totalMains;
    if (total === 0) return [];
    return [
      { name: 'Solar', value: totalSolar, color: COLORS.solar },
      { name: 'Wind', value: totalWind, color: COLORS.wind },
      { name: 'Mains', value: totalMains, color: COLORS.mains },
    ];
  }, [chartData, settings, playback.position]);

  // SoC chart data
  const socData = useMemo(
    () => chartData.map((d) => ({ time: d.time, timeLabel: formatTime(d.time), soc: d.soc })),
    [chartData]
  );

  // Busbar health data
  const busbarData = useMemo(
    () => chartData.map((d) => ({ time: d.time, timeLabel: formatTime(d.time), vbus: d.vbus, ibus: d.ibus })),
    [chartData]
  );

  // X-axis tick formatter (show every ~4 hours)
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let h = 0; h <= 24; h += 4) ticks.push(h);
    return ticks;
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* Stacked Area Chart — Energy Sources */}
      <div className="bg-bg-surface1 border border-border-default rounded-[14px] p-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
          ENERGY SOURCES
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="time"
              ticks={xTicks}
              tickFormatter={(v) => formatTime(v)}
              stroke="var(--text-tertiary)"
              fontSize={10}
            />
            <YAxis stroke="var(--text-tertiary)" fontSize={10} unit="A" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-surface2)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}
              labelFormatter={(v) => formatTime(v as number)}
            />
            <Area
              type="monotone"
              dataKey="mains"
              stackId="1"
              stroke={COLORS.mains}
              fill="rgba(136,136,136,0.15)"
              name="Mains"
            />
            <Area
              type="monotone"
              dataKey="wind"
              stackId="1"
              stroke={COLORS.wind}
              fill="rgba(80,227,194,0.15)"
              name="Wind"
            />
            <Area
              type="monotone"
              dataKey="solar"
              stackId="1"
              stroke={COLORS.solar}
              fill="rgba(245,166,35,0.15)"
              name="Solar"
            />
            <Area
              type="monotone"
              dataKey="totalLoad"
              stroke="var(--contrast-line)"
              strokeDasharray="5 3"
              fill="none"
              name="Total Load"
            />
            <ReferenceLine x={currentTime} stroke="var(--contrast-line)" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Middle row: Donut + Safety panel */}
      <div className="grid grid-cols-[1fr_200px] gap-4">
        {/* Donut Chart */}
        <div className="bg-bg-surface1 border border-border-default rounded-[14px] p-4">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
            SOURCE MIX
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface2)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                  formatter={(value: number) => `${value.toFixed(1)}A`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center absolute">
              <div className="font-mono text-[18px] text-text-primary">
                {metrics.totalEnergy.toFixed(2)}
              </div>
              <div className="text-[9px] text-text-tertiary uppercase">kWh</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[10px] text-text-tertiary">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* Safety Check Panel */}
        <div
          className={`bg-bg-surface1 border rounded-[14px] p-4 flex flex-col items-center justify-center text-center ${
            violation ? 'border-error' : 'border-border-default'
          }`}
        >
          {violation ? (
            <>
              <AlertTriangle size={32} className="text-error mb-2" />
              <div className="text-[12px] font-semibold text-error">DISCHARGE {'>'} CHARGE</div>
              <div className="text-[10px] text-error mt-1">40% mark cap risk</div>
              <div className="font-mono text-[11px] text-text-secondary mt-2">
                {metrics.chargeMin.toFixed(0)}m / {metrics.dischargeMin.toFixed(0)}m
              </div>
            </>
          ) : (
            <>
              <CheckCircle size={32} className="text-battery mb-2" />
              <div className="text-[12px] font-semibold text-battery">BALANCE OK</div>
              <div className="font-mono text-[11px] text-text-secondary mt-2">
                {metrics.chargeMin.toFixed(0)}m charge / {metrics.dischargeMin.toFixed(0)}m discharge
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gantt Timeline */}
      <div className="bg-bg-surface1 border border-border-default rounded-[14px] p-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
          LOAD & BATTERY TIMELINE
        </div>
        <GanttTimeline data={chartData} settings={settings} position={playback.position} />
      </div>

      {/* SoC Chart */}
      <div className="bg-bg-surface1 border border-border-default rounded-[14px] p-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
          BATTERY STATE OF CHARGE
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={socData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="time"
              ticks={xTicks}
              tickFormatter={(v) => formatTime(v)}
              stroke="var(--text-tertiary)"
              fontSize={10}
            />
            <YAxis stroke="var(--text-tertiary)" fontSize={10} unit="Ah" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}
              labelFormatter={(v) => formatTime(v as number)}
              formatter={(value: number) => [`${value.toFixed(2)} Ah`, 'SoC']}
            />
            <Area
              type="monotone"
              dataKey="soc"
              stroke={COLORS.battery}
              fill="rgba(74,222,128,0.15)"
              name="SoC"
            />
            {/* Dashed ref capacity line */}
            <Area
              type="monotone"
              dataKey={() => settings.refCapacity}
              stroke="var(--text-tertiary)"
              strokeDasharray="5 3"
              fill="none"
              name="Ref Capacity"
            />
            <ReferenceLine x={currentTime} stroke="var(--contrast-line)" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Busbar Health (collapsible) */}
      <details className="bg-bg-surface1 border border-border-default rounded-[14px] p-4">
        <summary className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary cursor-pointer">
          BUSBAR HEALTH
        </summary>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={busbarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="time"
                ticks={xTicks}
                tickFormatter={(v) => formatTime(v)}
                stroke="var(--text-tertiary)"
                fontSize={10}
              />
              <YAxis yAxisId="left" stroke="#F472B6" fontSize={10} unit="V" />
              <YAxis yAxisId="right" orientation="right" stroke="#818CF8" fontSize={10} unit="A" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface2)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                labelFormatter={(v) => formatTime(v as number)}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="vbus" stroke="#F472B6" dot={false} name="Voltage" />
              <Line yAxisId="right" type="monotone" dataKey="ibus" stroke="#818CF8" dot={false} name="Current" />
              <ReferenceLine x={currentTime} yAxisId="left" stroke="var(--contrast-line)" strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </details>

      {/* Playback Bar */}
      <PlaybackBar playback={playback} />
    </div>
  );
}
