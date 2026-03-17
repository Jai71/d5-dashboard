import { useState, useRef, useEffect } from 'react';
import type { DataPoint, Settings } from '../types';
import type { SerialState } from '../hooks/useSerial';
import { formatTime } from '../calculations';
import Papa from 'papaparse';
import { Upload, Download, RefreshCw, Bluetooth, BluetoothOff, Terminal, Trash2 } from 'lucide-react';

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
  dataSource: 'simulation' | 'csv' | 'serial';
  onCSVImport: (data: DataPoint[]) => void;
  onExport: () => void;
  serial: SerialState;
  rawData: DataPoint[];
  playbackPosition: number;
  onRegenerate: () => void;
}

const SIGNAL_FIELDS: (keyof DataPoint)[] = [
  'time', 'wind', 'pv', 'vbus', 'ibus',
  'cl1', 'cl2', 'cl3', 'mainsRequest',
  'ls1', 'ls2', 'ls3', 'bchg', 'bdis', 'soc',
];

const BLUETOOTH_HEADERS = [
  'time', 'wind', 'pv', 'vbus_rms', 'ibus_rms',
  'cl1', 'cl2', 'cl3', 'mains_request',
  'ls1', 'ls2', 'ls3', 'bchg', 'bdis', 'soc',
];

const HEADER_MAP: Record<string, keyof DataPoint> = {
  time: 'time', wind: 'wind', pv: 'pv',
  vbus_rms: 'vbus', vbus: 'vbus',
  ibus_rms: 'ibus', ibus: 'ibus',
  cl1: 'cl1', cl2: 'cl2', cl3: 'cl3',
  mains_request: 'mainsRequest', mainsRequest: 'mainsRequest',
  ls1: 'ls1', ls2: 'ls2', ls3: 'ls3',
  bchg: 'bchg', bdis: 'bdis', soc: 'soc',
};

const FIELD_COLORS: Partial<Record<keyof DataPoint, string>> = {
  pv: '#F5A623',
  wind: '#50E3C2',
  mainsRequest: '#888888',
  soc: '#4ADE80',
  cl1: '#3291FF', cl2: '#3291FF', cl3: '#3291FF',
  ls1: '#3291FF', ls2: '#3291FF', ls3: '#3291FF',
  bchg: '#4ADE80', bdis: '#A855F7',
};

export default function SettingsPanel({
  settings, setSettings, dataSource, onCSVImport, onExport,
  serial, rawData, playbackPosition, onRegenerate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[] | null>(null);
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<keyof DataPoint, string>>({} as Record<keyof DataPoint, string>);
  const [showTerminal, setShowTerminal] = useState(false);
  const userScrolledRef = useRef(false);

  // Auto-scroll terminal to bottom unless user has scrolled up
  useEffect(() => {
    if (!showTerminal || !terminalRef.current || userScrolledRef.current) return;
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [showTerminal, serial.rawLines]);

  const updateSetting = (key: keyof Settings, value: number, min: number, max: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    setSettings({ ...settings, [key]: clamped });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, unknown>[];

        // Check if headers match Bluetooth format
        const isBluetoothFormat = BLUETOOTH_HEADERS.every((h) => headers.includes(h));
        if (isBluetoothFormat) {
          const mapped = rows
            .filter((r) => r.time != null)
            .map((r) => ({
              time: Number(r.time),
              wind: Number(r.wind),
              pv: Number(r.pv),
              vbus: Number(r.vbus_rms ?? r.vbus),
              ibus: Number(r.ibus_rms ?? r.ibus),
              cl1: (Number(r.cl1) || 0) as 0 | 1,
              cl2: (Number(r.cl2) || 0) as 0 | 1,
              cl3: (Number(r.cl3) || 0) as 0 | 1,
              mainsRequest: Number(r.mains_request ?? r.mainsRequest),
              ls1: (Number(r.ls1) || 0) as 0 | 1,
              ls2: (Number(r.ls2) || 0) as 0 | 1,
              ls3: (Number(r.ls3) || 0) as 0 | 1,
              bchg: (Number(r.bchg) || 0) as 0 | 1,
              bdis: (Number(r.bdis) || 0) as 0 | 1,
              soc: Number(r.soc),
            }));
          onCSVImport(mapped);
        } else {
          // Show column mapping screen
          setCsvHeaders(headers);
          setCsvRows(rows);
          // Try to auto-map known columns
          const savedMap = localStorage.getItem('d5-column-map');
          if (savedMap) {
            try { setMapping(JSON.parse(savedMap)); } catch { /* ignore */ }
          } else {
            const autoMap: Record<string, string> = {};
            for (const h of headers) {
              const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
              for (const [alias, field] of Object.entries(HEADER_MAP)) {
                if (normalized === alias.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                  autoMap[field] = h;
                }
              }
            }
            setMapping(autoMap as Record<keyof DataPoint, string>);
          }
        }
      },
    });
    e.target.value = '';
  };

  const confirmMapping = () => {
    if (!csvRows.length) return;
    localStorage.setItem('d5-column-map', JSON.stringify(mapping));
    const mapped = csvRows
      .filter((r) => r[mapping.time] != null)
      .map((r) => ({
        time: Number(r[mapping.time]),
        wind: Number(r[mapping.wind]) || 0,
        pv: Number(r[mapping.pv]) || 0,
        vbus: Number(r[mapping.vbus]) || 240,
        ibus: Number(r[mapping.ibus]) || 0,
        cl1: (Number(r[mapping.cl1]) || 0) as 0 | 1,
        cl2: (Number(r[mapping.cl2]) || 0) as 0 | 1,
        cl3: (Number(r[mapping.cl3]) || 0) as 0 | 1,
        mainsRequest: Number(r[mapping.mainsRequest]) || 0,
        ls1: (Number(r[mapping.ls1]) || 0) as 0 | 1,
        ls2: (Number(r[mapping.ls2]) || 0) as 0 | 1,
        ls3: (Number(r[mapping.ls3]) || 0) as 0 | 1,
        bchg: (Number(r[mapping.bchg]) || 0) as 0 | 1,
        bdis: (Number(r[mapping.bdis]) || 0) as 0 | 1,
        soc: Number(r[mapping.soc]) || 0,
      }));
    onCSVImport(mapped);
    setCsvHeaders(null);
    setCsvRows([]);
  };

  // Raw data table: show ~15 rows around playback position
  const tableStart = Math.max(0, playbackPosition - 7);
  const tableEnd = Math.min(rawData.length, tableStart + 15);
  const tableData = rawData.slice(tableStart, tableEnd);

  const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  return (
    <div className="space-y-4">
      {/* System Configuration */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
          SYSTEM CONFIGURATION
        </div>
        <div className="grid grid-cols-4 gap-3">
          {([
            ['maxWind', 'Max Wind', 'A', 0, 5, 0.1],
            ['maxPV', 'Max PV', 'A', 0, 5, 0.1],
            ['maxMains', 'Max Mains', 'A', 0, 10, 0.1],
            ['batteryRate', 'Bat Rate', 'A', 0, 5, 0.1],
            ['refCapacity', 'Ref Cap', 'Ah', 1, 50, 0.5],
            ['load1Demand', 'Load 1', 'A', 0, 5, 0.1],
            ['load2Demand', 'Load 2', 'A', 0, 5, 0.1],
            ['load3Demand', 'Load 3', 'A', 0, 5, 0.1],
          ] as [keyof Settings, string, string, number, number, number][]).map(([key, label, unit, min, max, step]) => (
            <div key={key} className="bg-bg-surface1 border border-border-default rounded-xl p-3">
              <label className="text-[11px] text-text-tertiary block mb-1.5">{label}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={settings[key]}
                  onChange={(e) => updateSetting(key, parseFloat(e.target.value) || 0, min, max)}
                  className="w-full bg-bg-surface2 border border-border-default rounded-lg px-2.5 py-1.5 text-[13px] font-mono text-text-primary
                    focus:outline-none focus:[box-shadow:0_0_0_2px_rgba(160,200,255,0.4)]"
                />
                <span className="text-[11px] text-text-tertiary font-mono shrink-0">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bluetooth + Data — two cards side by side */}
      <div className="flex gap-4">
        {/* Bluetooth */}
        <div className="flex-1 bg-bg-surface1 border border-border-default rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
            BLUETOOTH CONNECTION
          </div>
          {hasSerial ? (
            <div className="flex items-center gap-2">
              <button
                onClick={serial.isConnected ? serial.disconnect : serial.connect}
                className="flex items-center gap-2 px-4 py-2 text-[12px] border border-border-default rounded-lg hover:bg-bg-surface3 transition-colors"
              >
                {serial.isConnected ? <BluetoothOff size={14} /> : <Bluetooth size={14} />}
                {serial.isConnected ? 'Disconnect' : 'Connect via Bluetooth'}
              </button>
              <button
                onClick={() => setShowTerminal((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 text-[12px] border rounded-lg transition-colors ${
                  showTerminal
                    ? 'border-accent text-accent bg-bg-surface2'
                    : 'border-border-default text-text-secondary hover:bg-bg-surface3'
                }`}
              >
                <Terminal size={14} />
                {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
              </button>
            </div>
          ) : (
            <div className="text-[12px] text-error">
              Web Serial not available. Chrome required.
            </div>
          )}
        </div>

        {/* Data Import / Export */}
        <div className="flex-1 bg-bg-surface1 border border-border-default rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-3">
            DATA IMPORT / EXPORT
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-[12px] bg-accent text-white rounded-lg"
            >
              <Upload size={14} />
              Import CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={onExport}
              disabled={rawData.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-[12px] border border-border-default text-text-secondary rounded-lg hover:bg-bg-surface3 disabled:opacity-40"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 px-4 py-2 text-[12px] border border-border-default text-text-secondary rounded-lg hover:bg-bg-surface3"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
          <div className="mt-2 text-[11px] text-text-tertiary font-mono">
            {dataSource} | {rawData.length} pts
          </div>
        </div>
      </div>

      {/* Terminal — full width */}
      {showTerminal && (
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              SERIAL TERMINAL ({serial.rawLines.length} lines)
            </span>
            <button
              onClick={serial.clearRawLines}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <Trash2 size={10} />
              Clear
            </button>
          </div>
          <div
            ref={terminalRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              userScrolledRef.current = !atBottom;
            }}
            className="bg-black border border-border-default rounded-xl p-3 max-h-[500px] overflow-y-auto"
          >
            {serial.rawLines.length === 0 ? (
              <div className="text-[11px] font-mono text-text-muted">
                {serial.isConnected ? 'Waiting for data...' : 'Connect to see serial data'}
              </div>
            ) : (
              serial.rawLines.map((line, i) => (
                <div key={i} className="text-[11px] font-mono text-text-secondary leading-5 whitespace-pre">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Column mapping screen */}
      {csvHeaders && (
        <div className="bg-bg-surface1 border border-border-default rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary mb-4">
            COLUMN MAPPING
          </div>
          <div className="space-y-2">
            {SIGNAL_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <span className="w-28 text-[11px] font-mono text-text-secondary">{field}</span>
                <select
                  value={mapping[field] || ''}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                  className="flex-1 bg-bg-surface2 border border-border-default rounded-lg px-2 py-1.5 text-[12px] text-text-primary"
                >
                  <option value="">-- select --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={confirmMapping}
            className="mt-4 px-4 py-2 text-[12px] bg-accent text-white rounded-lg"
          >
            Confirm Mapping
          </button>
        </div>
      )}

      {/* Raw Data Table */}
      <details className="bg-bg-surface1 border border-border-default rounded-xl p-5">
        <summary className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary cursor-pointer">
          RAW DATA TABLE
        </summary>
        {rawData.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-text-tertiary">
                  {SIGNAL_FIELDS.map((f) => (
                    <th key={f} className="px-2 py-1 text-left whitespace-nowrap" style={{ color: FIELD_COLORS[f] || 'var(--text-tertiary)' }}>
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((d, i) => (
                  <tr
                    key={tableStart + i}
                    className={`border-t border-border-subtle ${
                      tableStart + i === playbackPosition ? 'bg-bg-surface3' : ''
                    }`}
                  >
                    <td className="px-2 py-1">{formatTime(d.time)}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.wind }}>{d.wind.toFixed(3)}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.pv }}>{d.pv.toFixed(3)}</td>
                    <td className="px-2 py-1">{d.vbus.toFixed(1)}</td>
                    <td className="px-2 py-1">{d.ibus.toFixed(3)}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.cl1 }}>{d.cl1}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.cl2 }}>{d.cl2}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.cl3 }}>{d.cl3}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.mainsRequest }}>{d.mainsRequest.toFixed(3)}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.ls1 }}>{d.ls1}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.ls2 }}>{d.ls2}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.ls3 }}>{d.ls3}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.bchg }}>{d.bchg}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.bdis }}>{d.bdis}</td>
                    <td className="px-2 py-1" style={{ color: FIELD_COLORS.soc }}>{d.soc.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
