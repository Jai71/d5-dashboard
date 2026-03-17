import { useMemo } from 'react';
import type { DataPoint, Settings } from '../types';
import { COLORS, PARTICLE_SPEEDS } from '../constants';
import { Sun, Wind, Zap, Battery, Activity } from 'lucide-react';

interface Props {
  currentPoint: DataPoint;
  settings: Settings;
}

// Node positions per CLAUDE.md Pass 1
const NODES = {
  pv: { x: 80, y: 100 },
  wind: { x: 80, y: 300 },
  mains: { x: 80, y: 200 },
  battery: { x: 280, y: 300 },
  busbar: { x: 400, y: 200 },
  load1: { x: 680, y: 100 },
  load2: { x: 680, y: 200 },
  load3: { x: 680, y: 300 },
};

function getParticleDuration(current: number): number {
  for (const band of PARTICLE_SPEEDS) {
    if (current >= band.min && current < band.max) return band.duration;
  }
  return 0;
}

function getStrokeWidth(current: number, max: number): number {
  if (current <= 0) return 1.5;
  return 1.5 + (current / max) * 2.5;
}

interface FlowPath {
  id: string;
  d: string;
  color: string;
  current: number;
  maxCurrent: number;
  active: boolean;
}

export default function FlowDiagram({ currentPoint, settings }: Props) {
  const d = currentPoint;
  const mainsCurrent = (d.mainsRequest / 10) * settings.maxMains;

  // Detect SoC drift (charge rejected)
  const chargeRejected = useMemo(() => {
    if (d.bchg !== 1) return false;
    const supply = d.wind + d.pv + mainsCurrent;
    const demand =
      d.ls1 * settings.load1Demand +
      d.ls2 * settings.load2Demand +
      d.ls3 * settings.load3Demand;
    return supply - demand < 1.0;
  }, [d, mainsCurrent, settings]);

  const paths: FlowPath[] = useMemo(() => [
    // Sources → Busbar
    {
      id: 'pv-bus',
      d: `M 120 100 C 250 100, 280 200, 360 200`,
      color: COLORS.solar,
      current: d.pv,
      maxCurrent: settings.maxPV,
      active: d.pv > 0.05,
    },
    {
      id: 'wind-bus',
      d: `M 120 300 C 200 300, 280 250, 360 200`,
      color: COLORS.wind,
      current: d.wind,
      maxCurrent: settings.maxWind,
      active: d.wind > 0.05,
    },
    {
      id: 'mains-bus',
      d: `M 120 200 C 200 200, 280 200, 360 200`,
      color: COLORS.mains,
      current: mainsCurrent,
      maxCurrent: settings.maxMains,
      active: mainsCurrent > 0.05,
    },
    // Battery ↔ Busbar
    {
      id: 'bat-bus',
      d: d.bchg
        ? `M 360 200 C 340 250, 310 280, 300 300`
        : `M 300 300 C 310 280, 340 250, 360 200`,
      color: COLORS.battery,
      current: d.bchg || d.bdis ? settings.batteryRate : 0,
      maxCurrent: settings.batteryRate * 2,
      active: d.bchg === 1 || d.bdis === 1,
    },
    // Busbar → Loads
    {
      id: 'bus-l1',
      d: `M 440 200 C 520 200, 580 100, 640 100`,
      color: COLORS.load,
      current: d.ls1 ? settings.load1Demand : 0,
      maxCurrent: settings.load1Demand,
      active: d.ls1 === 1,
    },
    {
      id: 'bus-l2',
      d: `M 440 200 C 520 200, 580 200, 640 200`,
      color: COLORS.load,
      current: d.ls2 ? settings.load2Demand : 0,
      maxCurrent: settings.load2Demand,
      active: d.ls2 === 1,
    },
    {
      id: 'bus-l3',
      d: `M 440 200 C 520 200, 580 300, 640 300`,
      color: COLORS.load,
      current: d.ls3 ? settings.load3Demand : 0,
      maxCurrent: settings.load3Demand,
      active: d.ls3 === 1,
    },
  ], [d, mainsCurrent, settings]);

  const pvScale = settings.maxPV > 0 ? 0.9 + (d.pv / settings.maxPV) * 0.2 : 1;
  const windScale = settings.maxWind > 0 ? 0.9 + (d.wind / settings.maxWind) * 0.2 : 1;
  const mainsScale = settings.maxMains > 0 ? 0.9 + (mainsCurrent / settings.maxMains) * 0.2 : 1;
  const socFillHeight = settings.refCapacity > 0 ? Math.min((d.soc / settings.refCapacity) * 56, 56) : 0;

  return (
    <div className="bg-bg-surface1 border-0 sm:border sm:border-border-default rounded-none sm:rounded-xl p-0 sm:p-3">
      <div className="relative w-full">
        <svg
          viewBox="-15 70 800 300"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          {/* Grain filter */}
          <defs>
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#grain)" style={{ opacity: 'var(--grain-opacity)' }} />

          {/* Flow paths */}
          {paths.map((p) => (
            <g key={p.id}>
              <path
                d={p.d}
                fill="none"
                stroke={p.active ? p.color : 'var(--border-default)'}
                strokeWidth={getStrokeWidth(p.current, p.maxCurrent)}
                strokeDasharray={p.active ? undefined : '6 4'}
                opacity={p.active ? 0.8 : 0.3}
              />
              {/* Particles */}
              {p.active && getParticleDuration(p.current) > 0 && (
                Array.from({ length: Math.min(Math.ceil(p.current * 2) + 1, 6) }).map((_, i) => (
                  <circle
                    key={`${p.id}-p${i}`}
                    r="3"
                    fill={p.color}
                    style={{
                      offsetPath: `path("${p.d}")`,
                      animation: `flowMove ${getParticleDuration(p.current)}ms linear infinite`,
                      animationDelay: `${i * (getParticleDuration(p.current) / (Math.min(Math.ceil(p.current * 2) + 1, 6)))}ms`,
                    }}
                  />
                ))
              )}
            </g>
          ))}

          {/* Busbar rings */}
          {[30, 38, 46].map((r, i) => (
            <circle
              key={`ring-${r}`}
              cx={NODES.busbar.x}
              cy={NODES.busbar.y}
              r={r}
              fill="none"
              stroke="var(--border-default)"
              strokeWidth="1"
              style={{
                animation: `pulse ${2 + i * 0.5}s ease-in-out infinite`,
              }}
            />
          ))}

          {/* Busbar node */}
          <circle cx={NODES.busbar.x} cy={NODES.busbar.y} r="22" fill="var(--bg-surface1)" stroke="var(--border-default)" strokeWidth="1.5" />
          <Activity x={NODES.busbar.x - 8} y={NODES.busbar.y - 8} size={16} color="var(--text-primary)" />
          <text
            x={NODES.busbar.x} y={NODES.busbar.y + 34}
            textAnchor="middle" fill="var(--text-primary)" fontSize="11"
            fontFamily="'SF Mono', monospace"
          >
            {d.vbus.toFixed(1)}V
          </text>
          <text
            x={NODES.busbar.x} y={NODES.busbar.y + 47}
            textAnchor="middle" fill="var(--text-secondary)" fontSize="11"
            fontFamily="'SF Mono', monospace"
          >
            {d.ibus.toFixed(2)}A
          </text>

          {/* PV/Solar node */}
          <g transform={`translate(${NODES.pv.x}, ${NODES.pv.y}) scale(${Math.min(pvScale, 1.1)})`}>
            <circle r="24" fill="var(--bg-surface1)" stroke={COLORS.solar} strokeWidth="1.5" />
            <Sun x={-8} y={-8} size={16} color={COLORS.solar} />
            <text y="38" textAnchor="middle" fill={COLORS.solar} fontSize="12" fontFamily="'SF Mono', monospace">
              {d.pv.toFixed(2)}A
            </text>
            <text y="52" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" letterSpacing="0.08em">
              SOLAR
            </text>
          </g>

          {/* Wind node */}
          <g transform={`translate(${NODES.wind.x}, ${NODES.wind.y}) scale(${Math.min(windScale, 1.1)})`}>
            <circle r="24" fill="var(--bg-surface1)" stroke={COLORS.wind} strokeWidth="1.5" />
            <Wind x={-8} y={-8} size={16} color={COLORS.wind} />
            <text y="38" textAnchor="middle" fill={COLORS.wind} fontSize="12" fontFamily="'SF Mono', monospace">
              {d.wind.toFixed(2)}A
            </text>
            <text y="52" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" letterSpacing="0.08em">
              WIND
            </text>
          </g>

          {/* Mains node */}
          <g transform={`translate(${NODES.mains.x}, ${NODES.mains.y}) scale(${Math.min(mainsScale, 1.1)})`}>
            <circle r="24" fill="var(--bg-surface1)" stroke={COLORS.mains} strokeWidth="1.5" />
            <Zap x={-8} y={-8} size={16} color={COLORS.mains} />
            <text y="38" textAnchor="middle" fill={COLORS.mains} fontSize="12" fontFamily="'SF Mono', monospace">
              {mainsCurrent.toFixed(2)}A
            </text>
            <text y="52" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" letterSpacing="0.08em">
              MAINS
            </text>
          </g>

          {/* Battery node */}
          <g transform={`translate(${NODES.battery.x}, ${NODES.battery.y})`}>
            {/* Battery body */}
            <rect x="-20" y="-30" width="40" height="60" rx="6" fill="var(--bg-surface1)" stroke={COLORS.battery} strokeWidth="1.5" />
            {/* Terminal cap */}
            <rect x="-8" y="-36" width="16" height="6" rx="2" fill={COLORS.battery} opacity="0.6" />
            {/* SoC fill (bottom-anchored) */}
            <clipPath id="bat-clip">
              <rect x="-17" y="-27" width="34" height="54" rx="4" />
            </clipPath>
            <rect
              x="-17"
              y={27 - socFillHeight}
              width="34"
              height={socFillHeight}
              fill={COLORS.battery}
              opacity="0.4"
              clipPath="url(#bat-clip)"
            />
            <Battery x={-8} y={-8} size={16} color={COLORS.battery} />
            <text y="46" textAnchor="middle" fill={COLORS.battery} fontSize="12" fontFamily="'SF Mono', monospace">
              {d.soc.toFixed(1)}Ah
            </text>
            <text y="60" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" letterSpacing="0.08em">
              {d.bchg ? 'CHARGING' : d.bdis ? 'DISCHARGING' : 'IDLE'}
            </text>
            {/* Charge rejected warning */}
            {chargeRejected && (
              <text y="74" textAnchor="middle" fill={COLORS.warning} fontSize="9" fontWeight="600">
                CHARGE REJECTED?
              </text>
            )}
          </g>

          {/* Load nodes */}
          {[
            { key: 'load1', node: NODES.load1, cl: d.cl1, ls: d.ls1, demand: settings.load1Demand, label: 'LOAD 1' },
            { key: 'load2', node: NODES.load2, cl: d.cl2, ls: d.ls2, demand: settings.load2Demand, label: 'LOAD 2' },
            { key: 'load3', node: NODES.load3, cl: d.cl3, ls: d.ls3, demand: settings.load3Demand, label: 'LOAD 3' },
          ].map((load) => {
            const isOn = load.ls === 1;
            const isCalling = load.cl === 1 && load.ls === 0;
            const color = isOn ? COLORS.load : isCalling ? COLORS.warning : 'var(--text-tertiary)';
            const displacement = isCalling ? 10 : 0;

            return (
              <g
                key={load.key}
                transform={`translate(${load.node.x + displacement}, ${load.node.y})`}
              >
                <circle
                  r="24"
                  fill="var(--bg-surface1)"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray={isCalling ? '4 3' : undefined}
                />
                <Zap x={-8} y={-8} size={16} color={color} />
                <text y="38" textAnchor="middle" fill={color} fontSize="12" fontFamily="'SF Mono', monospace">
                  {isOn ? `${load.demand.toFixed(1)}A` : '0.0A'}
                </text>
                <text y="52" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" letterSpacing="0.08em">
                  {load.label}
                </text>
                <text y="64" textAnchor="middle" fill={color} fontSize="8">
                  {isOn ? 'ON' : isCalling ? 'CALLING' : 'OFF'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
