import type { DataPoint, Settings, Metrics } from './types';

export function computeMetrics(data: DataPoint[], settings: Settings, totalLength?: number): Metrics {
  if (data.length === 0) {
    return {
      totalEnergy: 0,
      renewablePct: 0,
      mainsDependency: 0,
      chargeMin: 0,
      dischargeMin: 0,
      unmetDemand: 0,
    };
  }

  const dtHours = 24 / (totalLength ?? data.length);
  const dtMinutes = dtHours * 60;

  let totalEnergy = 0;
  let totalRenewable = 0;
  let totalMains = 0;
  let chargeCount = 0;
  let dischargeCount = 0;
  let unmetCount = 0;

  for (const d of data) {
    const loadPower =
      (d.ls1 * settings.load1Demand +
        d.ls2 * settings.load2Demand +
        d.ls3 * settings.load3Demand) *
      d.vbus *
      dtHours;
    totalEnergy += loadPower / 1000;

    const mainsCurrent = (d.mainsRequest / 10) * settings.maxMains;
    totalRenewable += d.wind + d.pv;
    totalMains += mainsCurrent;

    if (d.bchg === 1) chargeCount++;
    if (d.bdis === 1) dischargeCount++;

    if ((d.cl1 && !d.ls1) || (d.cl2 && !d.ls2) || (d.cl3 && !d.ls3)) {
      unmetCount++;
    }
  }

  const totalSupply = totalRenewable + totalMains;
  const renewablePct = totalSupply > 0 ? (totalRenewable / totalSupply) * 100 : 0;
  const mainsDependency = totalSupply > 0 ? (totalMains / totalSupply) * 100 : 0;

  return {
    totalEnergy,
    renewablePct,
    mainsDependency,
    chargeMin: chargeCount * dtMinutes,
    dischargeMin: dischargeCount * dtMinutes,
    unmetDemand: (unmetCount / data.length) * 100,
  };
}

export function formatTime(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function exportCSV(data: DataPoint[]): void {
  const headers =
    'time,wind,pv,vbus_rms,ibus_rms,cl1,cl2,cl3,mains_request,ls1,ls2,ls3,bchg,bdis,soc';
  const rows = data.map(
    (d) =>
      `${d.time},${d.wind},${d.pv},${d.vbus},${d.ibus},${d.cl1},${d.cl2},${d.cl3},${d.mainsRequest},${d.ls1},${d.ls2},${d.ls3},${d.bchg},${d.bdis},${d.soc}`
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `d5-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
