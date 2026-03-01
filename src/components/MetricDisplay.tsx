import { AlertTriangle, Check, X } from 'lucide-react';
import type { Metrics } from '../types';

interface Props {
  metrics: Metrics;
}

export default function MetricDisplay({ metrics }: Props) {
  const violation = metrics.dischargeMin > metrics.chargeMin;
  const maxMin = Math.max(metrics.chargeMin, metrics.dischargeMin);

  return (
    <div className="space-y-6">
      {/* Row 1 — Hero Renewable % */}
      <div className="py-6">
        <div className="font-mono text-[52px] font-semibold text-battery leading-none">
          {metrics.renewablePct.toFixed(1)}%
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-text-muted">
          RENEWABLE
        </div>
      </div>

      {/* Row 2 — Three elements: 25% / 50% / 25% */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Energy card */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-5">
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">
            TOTAL ENERGY
          </div>
          <div className="font-mono text-[22px] text-text-primary">
            {metrics.totalEnergy.toFixed(2)}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">kWh</div>
        </div>

        {/* Battery Balance card — spans 2 columns */}
        <div className="col-span-2 bg-bg-surface1 border border-border-default rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted">
              BATTERY BALANCE
            </div>
            {violation
              ? <X size={14} className="text-error" />
              : <Check size={14} className="text-battery" />
            }
          </div>
          <div className="flex flex-col gap-3">
            {/* Charge */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary w-[60px] shrink-0">Charge</span>
              <div className="flex-1 relative">
                <div
                  className="h-2 rounded-full bg-battery"
                  style={{
                    width: `${maxMin > 0 ? (metrics.chargeMin / maxMin) * 100 : 50}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-battery whitespace-nowrap">
                {metrics.chargeMin.toFixed(0)}m
              </span>
            </div>
            {/* Discharge */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary w-[60px] shrink-0">Discharge</span>
              <div className="flex-1 relative">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${maxMin > 0 ? (metrics.dischargeMin / maxMin) * 100 : 50}%`,
                    backgroundColor: violation ? '#EE0000' : 'var(--discharge-safe)',
                  }}
                />
              </div>
              <span className={`text-[11px] font-mono whitespace-nowrap ${violation ? 'text-error' : 'text-text-secondary'}`}>
                {metrics.dischargeMin.toFixed(0)}m
              </span>
            </div>
          </div>
          {violation && (
            <div className="text-[10px] font-semibold text-error uppercase tracking-wider mt-2">
              40% CAP RISK
            </div>
          )}
        </div>

        {/* Mains Dependency card */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-5">
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">
            MAINS DEPENDENCY
          </div>
          <div className="font-mono text-[22px] text-mains">
            {metrics.mainsDependency.toFixed(1)}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">%</div>
        </div>
      </div>

      {/* Row 3 — Unmet Demand inline */}
      <div
        className={`font-mono text-[15px] flex items-center gap-1.5 ${
          metrics.unmetDemand > 0 ? 'text-warning' : 'text-text-muted'
        }`}
      >
        {metrics.unmetDemand > 0 && <AlertTriangle size={14} />}
        {metrics.unmetDemand.toFixed(1)}% unmet
      </div>
    </div>
  );
}
