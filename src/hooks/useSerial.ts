import { useState, useCallback, useRef } from 'react';
import type { DataPoint } from '../types';

// Web Serial API types (not in standard DOM lib)
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}

interface SerialAPI {
  requestPort(): Promise<SerialPort>;
}

export interface SerialState {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  latestPacket: DataPoint | null;
}

export function useSerial(): SerialState {
  const [isConnected, setIsConnected] = useState(false);
  const [latestPacket, setLatestPacket] = useState<DataPoint | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const packetCountRef = useRef(0);

  const parseLine = useCallback((line: string): DataPoint | null => {
    const parts = line.split(',').map((s) => s.trim());
    // First field may be '$' start marker — skip it
    const offset = parts[0] === '$' ? 1 : 0;
    const values = parts.slice(offset);

    if (values.length < 2) return null;

    // Log first 5 packets so we can see the raw format
    if (packetCountRef.current < 5) {
      console.log(`[Serial packet #${packetCountRef.current}] fields=${values.length}: ${line.trim()}`);
    }

    try {
      packetCountRef.current++;
      const v = (i: number) => (i < values.length ? parseFloat(values[i]) : 0);

      // Time: first field. If in seconds (0-364), scale to hours (0-24).
      let timeValue = v(0);
      if (isNaN(timeValue)) timeValue = packetCountRef.current * 0.0005;
      // Auto-detect seconds format: if time exceeds 24, assume seconds and convert
      const timeHours = timeValue > 24 ? (timeValue / 364) * 24 : timeValue;

      return {
        time: timeHours,
        wind: v(1),
        pv: v(2),
        vbus: v(3) || 240,
        ibus: v(4),
        cl1: (Math.round(v(5)) || 0) as 0 | 1,
        cl2: (Math.round(v(6)) || 0) as 0 | 1,
        cl3: (Math.round(v(7)) || 0) as 0 | 1,
        mainsRequest: v(8),
        ls1: (Math.round(v(9)) || 0) as 0 | 1,
        ls2: (Math.round(v(10)) || 0) as 0 | 1,
        ls3: (Math.round(v(11)) || 0) as 0 | 1,
        bchg: (Math.round(v(12)) || 0) as 0 | 1,
        bdis: (Math.round(v(13)) || 0) as 0 | 1,
        soc: v(14),
      };
    } catch {
      return null;
    }
  }, []);

  const readLoop = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const packet = parseLine(trimmed);
            if (packet) setLatestPacket(packet);
          }
        }
      } catch {
        // Port closed or error
      }
      setIsConnected(false);
    },
    [parseLine]
  );

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) return;

    try {
      const serial = (navigator as unknown as { serial: SerialAPI }).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      packetCountRef.current = 0;

      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        setIsConnected(true);
        readLoop(reader);
      }
    } catch {
      // User cancelled or error
    }
  }, [readLoop]);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // Already closed
    }
    setIsConnected(false);
  }, []);

  return { isConnected, connect, disconnect, latestPacket };
}
