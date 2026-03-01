export interface DataPoint {
  time: number;          // simulated hour, 0–24 (float, e.g. 6.5 = 06:30)
  wind: number;          // amps (0–1)
  pv: number;            // amps (0–2)
  vbus: number;          // volts RMS (~240)
  ibus: number;          // amps RMS (total busbar current)
  cl1: 0 | 1;           // call for load 1
  cl2: 0 | 1;
  cl3: 0 | 1;
  mainsRequest: number;  // raw DC voltage 0–10V — NOT converted current
  ls1: 0 | 1;           // load 1 switch
  ls2: 0 | 1;
  ls3: 0 | 1;
  bchg: 0 | 1;          // battery charge signal
  bdis: 0 | 1;          // battery discharge signal
  soc: number;           // amp-hours — NOT percentage
}

export interface Settings {
  maxWind: number;       // default 1.0
  maxPV: number;         // default 2.0
  maxMains: number;      // default 4.0
  batteryRate: number;   // default 1.0
  refCapacity: number;   // default 10.0 Ah (display convention only)
  load1Demand: number;   // default 0.8
  load2Demand: number;   // default 1.8
  load3Demand: number;   // default 1.4
}

export interface Metrics {
  totalEnergy: number;     // kWh
  renewablePct: number;    // 0–100
  mainsDependency: number; // 0–100
  chargeMin: number;
  dischargeMin: number;
  unmetDemand: number;     // 0–100 percentage
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Notification {
  id: string;
  triggerId: number;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
}
