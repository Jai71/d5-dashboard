import type { DataPoint, Settings, Metrics } from '../types';
import type { PlaybackState } from '../hooks/usePlayback';
import FlowDiagram from './FlowDiagram';
import Notifications from './Notifications';
import { formatTime } from '../calculations';
import { SkipBack, Play, Pause, SkipForward, Radio, AlertTriangle, Check, X } from 'lucide-react';

interface Props {
  currentPoint: DataPoint | undefined;
  metrics: Metrics;
  settings: Settings;
  isLive: boolean;
  dataCount: number;
  playback: PlaybackState;
  isLiveMode: boolean;
  onGoLive: () => void;
  onExitLive: () => void;
}

const SPEEDS = [1, 2, 5, 10];

const EMPTY_POINT: DataPoint = {
  time: 0, wind: 0, pv: 0, vbus: 240, ibus: 0,
  cl1: 0, cl2: 0, cl3: 0, mainsRequest: 0,
  ls1: 0, ls2: 0, ls3: 0, bchg: 0, bdis: 0, soc: 0,
};

export default function LiveMonitor({ currentPoint, metrics, settings, isLive, dataCount, playback, isLiveMode, onGoLive, onExitLive }: Props) {
  if (!currentPoint && !isLive) {
    return (
      <div className="text-text-secondary text-[13px] p-6">
        No data loaded. Generate a simulation or import CSV.
      </div>
    );
  }

  const point = currentPoint ?? EMPTY_POINT;
  const waitingForData = !currentPoint && isLive;
  const displayHour = isLiveMode ? point.time : playback.simulatedHour;
  const violation = metrics.dischargeMin > metrics.chargeMin;

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    onExitLive();
    playback.setPosition(parseFloat(e.target.value));
  };

  const handlePlayPause = () => {
    if (playback.isPlaying) {
      playback.pause();
    } else {
      onExitLive();
      playback.play();
    }
  };

  const handleSkipToStart = () => {
    onExitLive();
    playback.skipToStart();
  };

  const handleSkipToEnd = () => {
    onExitLive();
    playback.skipToEnd();
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] sm:min-h-[calc(100vh-140px)]">
      {waitingForData && (
        <div className="text-center text-text-secondary text-[13px] py-2 animate-pulse">
          Waiting for serial data...
        </div>
      )}
      <Notifications currentPoint={point} settings={settings} isLive={isLive && isLiveMode} />

      {/* Flow Diagram */}
      <FlowDiagram currentPoint={point} settings={settings} />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mt-3 sm:mt-4">
        {/* Renewable % */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-3 sm:p-4">
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">RENEWABLE</div>
          <div className="font-mono text-[18px] sm:text-[22px] text-battery">
            {metrics.renewablePct.toFixed(1)}
            <span className="text-[10px] opacity-60 ml-0.5">%</span>
          </div>
        </div>

        {/* Energy (Load) */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-3 sm:p-4">
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">ENERGY (LOAD)</div>
          <div className="font-mono text-[18px] sm:text-[22px] text-text-primary">
            {metrics.totalEnergy.toFixed(2)}
            <span className="text-[10px] text-text-tertiary ml-0.5">kWh</span>
          </div>
        </div>

        {/* Battery Balance */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted">BAT BALANCE</div>
            {violation
              ? <X size={12} className="text-error" />
              : <Check size={12} className="text-battery" />
            }
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-sm bg-battery shrink-0" />
              <span className="text-[13px] font-mono text-battery">{metrics.chargeMin.toFixed(0)}m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-sm shrink-0 ${violation ? 'bg-error' : 'bg-text-secondary'}`} />
              <span className={`text-[13px] font-mono ${violation ? 'text-error' : 'text-text-secondary'}`}>{metrics.dischargeMin.toFixed(0)}m</span>
            </div>
          </div>
          {violation && (
            <div className="text-[9px] font-semibold text-error uppercase tracking-wider mt-1">
              40% CAP RISK
            </div>
          )}
        </div>

        {/* Mains Use */}
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-3 sm:p-4">
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">MAINS USE</div>
          <div className="font-mono text-[18px] sm:text-[22px] text-mains">
            {metrics.mainsDependency.toFixed(1)}
            <span className="text-[10px] text-text-tertiary ml-0.5">%</span>
          </div>
        </div>

        {/* Unmet Demand */}
        <div className={`bg-bg-surface1 border rounded-xl p-3 sm:p-4 ${
          metrics.unmetDemand > 0 ? 'border-warning/40' : 'border-border-default'
        }`}>
          <div className="text-[9px] uppercase tracking-[0.08em] text-text-muted mb-2">UNMET</div>
          <div className={`font-mono text-[18px] sm:text-[22px] ${metrics.unmetDemand > 0 ? 'text-warning' : 'text-text-muted'}`}>
            {metrics.unmetDemand > 0 && <AlertTriangle size={14} className="inline mr-1 mb-0.5" />}
            {metrics.unmetDemand.toFixed(1)}
            <span className="text-[10px] opacity-60 ml-0.5">%</span>
          </div>
        </div>
      </div>

      {/* Spacer pushes playback bar to bottom */}
      <div className="flex-1" />

      {/* Playback scrubber */}
      <div className="bg-bg-surface1 border-t border-border-default px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6">
        {/* Skip to start */}
        <button
          onClick={handleSkipToStart}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <SkipBack size={16} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white hover:opacity-90 transition-opacity"
        >
          {playback.isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        {/* Skip to end */}
        <button
          onClick={handleSkipToEnd}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <SkipForward size={16} />
        </button>

        {/* Scrubber */}
        <input
          type="range"
          min="0"
          max="24"
          step="0.01"
          value={isLiveMode ? 24 : playback.simulatedHour}
          onChange={handleScrub}
          className="flex-1 h-1 appearance-none bg-bg-surface3 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />

        {/* Time display */}
        <span className="font-mono text-[14px] text-text-primary w-14 text-right">
          {formatTime(displayHour)}
        </span>

        {/* Speed selector — hidden on mobile */}
        <div className="hidden sm:flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => playback.setSpeed(s)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                playback.speed === s
                  ? 'bg-accent text-white'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* LIVE button */}
        <button
          onClick={onGoLive}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] rounded-md border transition-colors ${
            isLiveMode
              ? 'border-battery/50 text-battery'
              : 'border-border-default text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isLiveMode ? 'bg-battery animate-pulse' : 'bg-text-muted'
            }`}
          />
          <Radio size={12} />
          <span className="hidden sm:inline">LIVE</span>
        </button>

        {/* Point count — hidden on mobile */}
        <span className="hidden sm:inline text-[11px] text-text-tertiary font-mono">
          {playback.position + 1}/{dataCount}
        </span>
      </div>
    </div>
  );
}
