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

    if (values.length < 14) return null;

    try {
      packetCountRef.current++;
      const hasTime = values.length >= 15;
      const idx = (i: number) => (hasTime ? i : i - 1);
      const timeValue = hasTime ? parseFloat(values[0]) : packetCountRef.current * 0.0005;

      return {
        time: isNaN(timeValue) ? packetCountRef.current * 0.0005 : timeValue,
        wind: parseFloat(values[idx(1)]) || 0,
        pv: parseFloat(values[idx(2)]) || 0,
        vbus: parseFloat(values[idx(3)]) || 240,
        ibus: parseFloat(values[idx(4)]) || 0,
        cl1: (parseInt(values[idx(5)]) || 0) as 0 | 1,
        cl2: (parseInt(values[idx(6)]) || 0) as 0 | 1,
        cl3: (parseInt(values[idx(7)]) || 0) as 0 | 1,
        mainsRequest: parseFloat(values[idx(8)]) || 0,
        ls1: (parseInt(values[idx(9)]) || 0) as 0 | 1,
        ls2: (parseInt(values[idx(10)]) || 0) as 0 | 1,
        ls3: (parseInt(values[idx(11)]) || 0) as 0 | 1,
        bchg: (parseInt(values[idx(12)]) || 0) as 0 | 1,
        bdis: (parseInt(values[idx(13)]) || 0) as 0 | 1,
        soc: parseFloat(values[idx(14)]) || 0,
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
