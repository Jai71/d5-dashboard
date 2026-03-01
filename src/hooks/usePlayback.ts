import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataPoint } from '../types';
import { PLAYBACK_TICK_MS } from '../constants';

export interface PlaybackState {
  position: number;
  simulatedHour: number;
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  skipToStart: () => void;
  skipToEnd: () => void;
  setPosition: (hour: number) => void;
  setSpeed: (speed: number) => void;
}

export function usePlayback(data: DataPoint[]): PlaybackState {
  const [simulatedHour, setSimulatedHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const position =
    data.length > 0
      ? Math.min(Math.round((simulatedHour / 24) * (data.length - 1)), data.length - 1)
      : 0;

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSimulatedHour((prev) => {
        // 1 wall-clock second = 1 simulated minute at 1x
        // Each tick (100ms): advance by (0.1 / 60) * speed hours
        const increment = (PLAYBACK_TICK_MS / 1000) * (1 / 60) * speed;
        const next = prev + increment;
        if (next >= 24) {
          setIsPlaying(false);
          return 24;
        }
        return next;
      });
    }, PLAYBACK_TICK_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const skipToStart = useCallback(() => {
    setSimulatedHour(0);
    setIsPlaying(false);
  }, []);
  const skipToEnd = useCallback(() => {
    setSimulatedHour(24);
    setIsPlaying(false);
  }, []);
  const setPositionCb = useCallback((hour: number) => {
    setSimulatedHour(Math.max(0, Math.min(24, hour)));
  }, []);
  const setSpeedCb = useCallback((s: number) => setSpeed(s), []);

  return {
    position,
    simulatedHour,
    isPlaying,
    speed,
    play,
    pause,
    skipToStart,
    skipToEnd,
    setPosition: setPositionCb,
    setSpeed: setSpeedCb,
  };
}
