import { useState, useCallback, useRef, useEffect } from 'react';
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
  rawLines: string[];
  clearRawLines: () => void;
  packetCount: number;
  parseErrorCount: number;
}

const RAW_LINE_LIMIT = 200;
const RAW_LINE_FLUSH_MS = 500;

const FIELD_NAMES = ['time', 'wind', 'pv', 'vbus', 'ibus', 'cl1', 'cl2', 'cl3', 'mains', 'ls1', 'ls2', 'ls3', 'bchg', 'bdis', 'soc'];

function ts(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

export function useSerial(): SerialState {
  const [isConnected, setIsConnected] = useState(false);
  const [latestPacket, setLatestPacket] = useState<DataPoint | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [packetCount, setPacketCount] = useState(0);
  const [parseErrorCount, setParseErrorCount] = useState(0);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const packetCountRef = useRef(0);
  const parseErrorCountRef = useRef(0);
  const rawLineBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flush raw line buffer + counters to state every 500ms
  useEffect(() => {
    if (isConnected) {
      flushTimerRef.current = setInterval(() => {
        // Flush lines
        if (rawLineBufferRef.current.length > 0) {
          setRawLines((prev) => {
            const combined = [...prev, ...rawLineBufferRef.current];
            rawLineBufferRef.current = [];
            return combined.slice(-RAW_LINE_LIMIT);
          });
        }
        // Sync counters to state
        setPacketCount(packetCountRef.current);
        setParseErrorCount(parseErrorCountRef.current);
      }, RAW_LINE_FLUSH_MS);
    }
    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [isConnected]);

  const clearRawLines = useCallback(() => {
    rawLineBufferRef.current = [];
    setRawLines([]);
  }, []);

  const parseLine = useCallback((line: string): DataPoint | null => {
    const parts = line.split(',').map((s) => s.trim());
    // First field may be '$' start marker — skip it
    const offset = parts[0] === '$' ? 1 : 0;
    const values = parts.slice(offset);

    if (values.length < 2) {
      parseErrorCountRef.current++;
      rawLineBufferRef.current.push(`[${ts()}] [ERR] (${values.length} fields) ${line.trim()}`);
      console.warn('[Serial] Too few fields:', line);
      return null;
    }

    try {
      packetCountRef.current++;
      const v = (i: number) => (i < values.length ? parseFloat(values[i]) : 0);

      // Use raw time value as-is. We don't know the HC-06 format yet —
      // the terminal will reveal it, then we can add proper conversion.
      let timeValue = v(0);
      if (isNaN(timeValue)) timeValue = packetCountRef.current * 0.0005;

      const packet: DataPoint = {
        time: timeValue,
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

      // Terminal: raw line + parsed field mapping
      const parsed = values.map((val, i) => `${FIELD_NAMES[i] || `f${i}`}=${val}`).join(' ');
      rawLineBufferRef.current.push(`[${ts()}] (${values.length}f) ${line.trim()}`);
      rawLineBufferRef.current.push(`  → ${parsed}`);

      return packet;
    } catch (err) {
      parseErrorCountRef.current++;
      rawLineBufferRef.current.push(`[${ts()}] [PARSE ERR] ${line.trim()}`);
      console.warn('[Serial] Parse error:', line, err);
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
      } catch (err) {
        console.error('[Serial] Read error:', err);
        rawLineBufferRef.current.push(`[${ts()}] [READ ERROR] ${String(err)}`);
      }
      rawLineBufferRef.current.push(`[${ts()}] [DISCONNECTED]`);
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
      parseErrorCountRef.current = 0;
      setPacketCount(0);
      setParseErrorCount(0);
      rawLineBufferRef.current = [`[${ts()}] [CONNECTED] baudRate=9600`];
      setRawLines([]);

      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        setIsConnected(true);
        readLoop(reader);
      }
    } catch (err) {
      console.error('[Serial] Connect error:', err);
      rawLineBufferRef.current.push(`[${ts()}] [CONNECT ERROR] ${String(err)}`);
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
    } catch (err) {
      console.error('[Serial] Disconnect error:', err);
    }
    rawLineBufferRef.current.push(`[${ts()}] [DISCONNECTED]`);
    setIsConnected(false);
  }, []);

  return { isConnected, connect, disconnect, latestPacket, rawLines, clearRawLines, packetCount, parseErrorCount };
}
