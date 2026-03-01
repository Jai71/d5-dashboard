import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  maxWind: 1.0,
  maxPV: 2.0,
  maxMains: 4.0,
  batteryRate: 1.0,
  refCapacity: 10.0,
  load1Demand: 0.8,
  load2Demand: 1.8,
  load3Demand: 1.4,
};

export const COLORS = {
  solar: '#F5A623',
  wind: '#50E3C2',
  mains: '#888888',
  battery: '#4ADE80',
  load: '#3291FF',
  accent: '#0070F3',
  error: '#EE0000',
  warning: '#F5A623',
  ai: '#7928CA',
} as const;

export const PARTICLE_SPEEDS: { min: number; max: number; duration: number }[] = [
  { min: 0, max: 0.1, duration: 0 },
  { min: 0.1, max: 1, duration: 4000 },
  { min: 1, max: 3, duration: 2500 },
  { min: 3, max: 5, duration: 1500 },
  { min: 5, max: Infinity, duration: 800 },
];

export const SIMULATION_POINTS = 288;
export const SIMULATED_HOURS = 24;
export const CHART_MAX_POINTS = 2000;
export const DOWNSAMPLE_TARGET = 288;
export const AI_SAMPLE_POINTS = 48;
export const AI_MAX_HISTORY = 6;
export const PLAYBACK_TICK_MS = 100;
export const NOTIFICATION_DISMISS_MS = 5000;
export const NOTIFICATION_DEBOUNCE_MS = 10000;
export const MAX_VISIBLE_NOTIFICATIONS = 3;
