import type { DataPoint, Settings } from './types';
import { SIMULATION_POINTS, SIMULATED_HOURS } from './constants';

export function generateSimulation(settings: Settings): DataPoint[] {
  const data: DataPoint[] = [];
  const dtHours = SIMULATED_HOURS / SIMULATION_POINTS;

  let windCurrent = 0.3;
  let soc = 0;

  for (let i = 0; i < SIMULATION_POINTS; i++) {
    const time = i * dtHours;
    const hour = time;

    // PV: bell curve peaking at noon
    let pv = settings.maxPV * Math.exp(-0.5 * Math.pow((hour - 12) / 3, 2));
    if (pv < 0.05) pv = 0;

    // Wind: slow drift
    windCurrent += (Math.random() - 0.5) * 0.1;
    windCurrent = Math.max(0, Math.min(settings.maxWind, windCurrent));
    const wind = windCurrent;

    // Vbus: jitter around 240V
    const vbus = 238 + Math.random() * 4;

    // Load calls
    const cl1: 0 | 1 = hour >= 6 && hour < 22 ? 1 : 0;
    const cl2: 0 | 1 = (hour >= 7 && hour < 10) || (hour >= 17 && hour < 21) ? 1 : 0;

    // cl3: intermittent, ON 2h then OFF 1h from hour 8-20
    let cl3: 0 | 1 = 0;
    if (hour >= 8 && hour < 20) {
      const cyclePos = (hour - 8) % 3;
      cl3 = cyclePos < 2 ? 1 : 0;
    }

    // Algorithm: prioritise loads by size (smallest first)
    const renewable = pv + wind;
    let availableSupply = renewable;

    // Switch on called loads if supply covers demand
    // Priority: Load 1 (0.8A), Load 3 (1.4A), Load 2 (1.8A)
    let ls1: 0 | 1 = 0;
    let ls2: 0 | 1 = 0;
    let ls3: 0 | 1 = 0;

    if (cl1 && availableSupply >= settings.load1Demand * 0.3) {
      ls1 = 1;
    }
    if (cl3 && availableSupply >= settings.load3Demand * 0.3) {
      ls3 = 1;
    }
    // During hours 0-5 and 19-24, leave Load 2 unmet when wind < 0.3A
    if (cl2) {
      if ((hour < 5 || hour >= 19) && wind < 0.3) {
        ls2 = 0;
      } else {
        ls2 = 1;
      }
    }

    const totalLoad =
      ls1 * settings.load1Demand +
      ls2 * settings.load2Demand +
      ls3 * settings.load3Demand;

    const deficit = totalLoad - renewable;
    let bchg: 0 | 1 = 0;
    let bdis: 0 | 1 = 0;
    let mainsRequest = 0;

    if (deficit > 0) {
      // Need more power
      let remaining = deficit;

      // Try battery discharge first
      if (soc > 0) {
        bdis = 1;
        const batteryContribution = Math.min(settings.batteryRate, remaining);
        remaining -= batteryContribution;
        soc -= dtHours * settings.batteryRate;
        if (soc < 0) soc = 0;
      }

      // Remaining from mains
      if (remaining > 0) {
        mainsRequest = (remaining / settings.maxMains) * 10;
        mainsRequest = Math.max(0, Math.min(10, mainsRequest));
      }
    } else {
      // Surplus
      const surplus = renewable - totalLoad;
      if (surplus >= 1.0) {
        bchg = 1;
        soc += dtHours * settings.batteryRate;
      }
    }

    // Ensure bchg and bdis never both on
    if (bchg === 1 && bdis === 1) {
      bdis = 0;
    }

    const ibus = totalLoad + (bchg ? settings.batteryRate : 0);

    data.push({
      time,
      wind: Math.round(wind * 1000) / 1000,
      pv: Math.round(pv * 1000) / 1000,
      vbus: Math.round(vbus * 10) / 10,
      ibus: Math.round(ibus * 1000) / 1000,
      cl1,
      cl2,
      cl3,
      mainsRequest: Math.round(mainsRequest * 1000) / 1000,
      ls1,
      ls2,
      ls3,
      bchg,
      bdis,
      soc: Math.round(soc * 1000) / 1000,
    });
  }

  return data;
}
