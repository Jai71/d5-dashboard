import { useMemo } from 'react';
import type { DataPoint, Settings } from '../types';

interface Props {
  data: DataPoint[];
  settings: Settings;
  position: number;
}

interface Span {
  start: number;
  end: number;
}

function findSpans(data: DataPoint[], predicate: (d: DataPoint) => boolean): Span[] {
  const spans: Span[] = [];
  let spanStart = -1;
  for (let i = 0; i < data.length; i++) {
    if (predicate(data[i])) {
      if (spanStart === -1) spanStart = i;
    } else {
      if (spanStart !== -1) {
        spans.push({ start: spanStart, end: i - 1 });
        spanStart = -1;
      }
    }
  }
  if (spanStart !== -1) spans.push({ start: spanStart, end: data.length - 1 });
  return spans;
}

function detectRejectedChargeSpans(data: DataPoint[], settings: Settings): Span[] {
  const spans: Span[] = [];
  let spanStart = -1;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (d.bchg === 1) {
      const mainsCurrent = (d.mainsRequest / 10) * settings.maxMains;
      const supply = d.wind + d.pv + mainsCurrent;
      const demand = d.ls1 * settings.load1Demand + d.ls2 * settings.load2Demand + d.ls3 * settings.load3Demand;
      const surplus = supply - demand;
      if (surplus < 1.0) {
        if (spanStart === -1) spanStart = i;
      } else {
        if (spanStart !== -1) { spans.push({ start: spanStart, end: i - 1 }); spanStart = -1; }
      }
    } else {
      if (spanStart !== -1) { spans.push({ start: spanStart, end: i - 1 }); spanStart = -1; }
    }
  }
  if (spanStart !== -1) spans.push({ start: spanStart, end: data.length - 1 });
  return spans;
}

function SpanBar({ span, total, color, hatched }: { span: Span; total: number; color: string; hatched?: boolean }) {
  const left = `${(span.start / total) * 100}%`;
  const width = `${(Math.max(span.end - span.start + 1, 1) / total) * 100}%`;
  return (
    <div
      className="absolute top-0 bottom-0 rounded"
      style={{
        left,
        width,
        backgroundColor: hatched ? undefined : color,
        backgroundImage: hatched
          ? `repeating-linear-gradient(45deg, #4ADE80 0px 4px, transparent 4px 8px)`
          : undefined,
        opacity: hatched ? 0.5 : 1,
      }}
    />
  );
}

export default function GanttTimeline({ data, settings, position }: Props) {
  const total = data.length;

  const spans = useMemo(() => ({
    cl1: findSpans(data, (d) => d.cl1 === 1),
    ls1: findSpans(data, (d) => d.ls1 === 1),
    cl2: findSpans(data, (d) => d.cl2 === 1),
    ls2: findSpans(data, (d) => d.ls2 === 1),
    cl3: findSpans(data, (d) => d.cl3 === 1),
    ls3: findSpans(data, (d) => d.ls3 === 1),
    bchg: findSpans(data, (d) => d.bchg === 1),
    bdis: findSpans(data, (d) => d.bdis === 1),
    rejected: detectRejectedChargeSpans(data, settings),
  }), [data, settings]);

  const rows = [
    { label: 'Load 1', call: spans.cl1, switch_: spans.ls1 },
    { label: 'Load 2', call: spans.cl2, switch_: spans.ls2 },
    { label: 'Load 3', call: spans.cl3, switch_: spans.ls3 },
  ];

  return (
    <div className="space-y-1">
      {/* Load rows */}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-0">
          <div className="w-[50px] text-[10px] text-text-tertiary uppercase tracking-wider shrink-0">
            {row.label}
          </div>
          <div className="flex-1 h-5 relative bg-bg-surface1 rounded">
            {/* Calls (amber back) */}
            {row.call.map((s, i) => (
              <SpanBar key={`c${i}`} span={s} total={total} color="rgba(245,166,35,0.3)" />
            ))}
            {/* Switches (blue front) */}
            {row.switch_.map((s, i) => (
              <SpanBar key={`s${i}`} span={s} total={total} color="rgba(50,145,255,0.5)" />
            ))}
            {/* Position marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-text-primary"
              style={{ left: `${(position / total) * 100}%` }}
            />
          </div>
        </div>
      ))}

      {/* Battery row */}
      <div className="flex items-center gap-0">
        <div className="w-[50px] text-[10px] text-text-tertiary uppercase tracking-wider shrink-0">
          Battery
        </div>
        <div className="flex-1 h-5 relative bg-bg-surface1 rounded">
          {spans.bchg.map((s, i) => (
            <SpanBar key={`chg${i}`} span={s} total={total} color="rgba(74,222,128,0.4)" />
          ))}
          {spans.bdis.map((s, i) => (
            <SpanBar key={`dis${i}`} span={s} total={total} color="rgba(168,85,247,0.4)" />
          ))}
          {/* Hatched pattern for suspected rejected charges */}
          {spans.rejected.map((s, i) => (
            <SpanBar key={`rej${i}`} span={s} total={total} color="" hatched />
          ))}
          <div
            className="absolute top-0 bottom-0 w-px bg-text-primary"
            style={{ left: `${(position / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 pt-2 text-[10px] text-text-tertiary">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(245,166,35,0.3)' }} />
          Call
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(50,145,255,0.5)' }} />
          Switch
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(74,222,128,0.4)' }} />
          Charge
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(168,85,247,0.4)' }} />
          Discharge
        </div>
      </div>
    </div>
  );
}
