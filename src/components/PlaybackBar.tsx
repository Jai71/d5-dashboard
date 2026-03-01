import type { PlaybackState } from '../hooks/usePlayback';
import { formatTime } from '../calculations';
import { SkipBack, Play, Pause, SkipForward } from 'lucide-react';

interface Props {
  playback: PlaybackState;
}

const SPEEDS = [1, 2, 5, 10];

export default function PlaybackBar({ playback }: Props) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-bg-surface1 border-t border-border-default px-6 py-3 flex items-center gap-4 z-40">
      {/* Skip to start */}
      <button
        onClick={playback.skipToStart}
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <SkipBack size={16} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={playback.isPlaying ? playback.pause : playback.play}
        className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white hover:opacity-90 transition-opacity"
      >
        {playback.isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Skip to end */}
      <button
        onClick={playback.skipToEnd}
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
        value={playback.simulatedHour}
        onChange={(e) => playback.setPosition(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none bg-bg-surface3 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />

      {/* Time display */}
      <span className="font-mono text-[14px] text-text-primary w-14 text-right">
        {formatTime(playback.simulatedHour)}
      </span>

      {/* Speed selector */}
      <div className="flex gap-1">
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
    </div>
  );
}
