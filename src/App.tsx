import { useState, useMemo, useEffect, useCallback } from 'react';
import { Activity, Radio, MessageSquare, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import type { DataPoint, Settings } from './types';
import { DEFAULT_SETTINGS, CHART_MAX_POINTS, DOWNSAMPLE_TARGET } from './constants';
import { computeMetrics, exportCSV } from './calculations';
import { generateSimulation } from './simulation';
import { usePlayback } from './hooks/usePlayback';
import { useSerial } from './hooks/useSerial';
import { useAI } from './hooks/useAI';
import LiveMonitor from './components/LiveMonitor';
import Analytics from './components/Analytics';
import SettingsPanel from './components/SettingsPanel';
import AIInsights from './components/AIInsights';

const TABS = [
  { label: 'Live', icon: Activity },
  { label: 'Analytics', icon: Radio },
  { label: 'AI Insights', icon: MessageSquare },
  { label: 'Settings', icon: SettingsIcon },
];

const SESSION_KEY = 'd5-session';

function App() {
  const [dataSource, setDataSource] = useState<'simulation' | 'csv' | 'serial'>('simulation');
  const [rawData, setRawData] = useState<DataPoint[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState(0);
  const [showRestore, setShowRestore] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('d5-theme');
    return saved ? saved === 'dark' : true;
  });

  // Derived: downsampled chart data
  const chartData = useMemo(() => {
    if (rawData.length <= CHART_MAX_POINTS) return rawData;
    const step = Math.floor(rawData.length / DOWNSAMPLE_TARGET);
    return rawData.filter((_, i) => i % step === 0);
  }, [rawData]);

  // Derived: metrics (full session — used by AI and as fallback)
  const metrics = useMemo(() => computeMetrics(rawData, settings), [rawData, settings]);

  // Hooks
  const playback = usePlayback(chartData);       // Tab 2
  const livePlayback = usePlayback(chartData);   // Tab 1
  const serial = useSerial();
  const ai = useAI(rawData, settings, metrics);

  // Theme toggle
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('d5-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Tab 1 live mode: pins to latest data point by default
  const [tab1Live, setTab1Live] = useState(true);

  // Playback-sliced metrics: cumulative from start to current playback position
  const liveMetrics = useMemo(() => {
    if (tab1Live || chartData.length === 0) return metrics;
    const sliceIdx = Math.min(livePlayback.position + 1, chartData.length);
    return computeMetrics(chartData.slice(0, sliceIdx), settings, chartData.length);
  }, [tab1Live, metrics, livePlayback.position, chartData, settings]);

  const analyticsMetrics = useMemo(() => {
    if (chartData.length === 0) return metrics;
    const sliceIdx = Math.min(playback.position + 1, chartData.length);
    return computeMetrics(chartData.slice(0, sliceIdx), settings, chartData.length);
  }, [metrics, playback.position, chartData, settings]);

  // On mount: check localStorage or generate simulation
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      setShowRestore(true);
    } else {
      const data = generateSimulation(settings);
      setRawData(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (rawData.length > 0) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ dataSource, rawData, settings }));
    }
  }, [rawData, dataSource, settings]);

  // Regenerate simulation when settings change (only for simulation source)
  useEffect(() => {
    if (dataSource === 'simulation' && rawData.length > 0) {
      setRawData(generateSimulation(settings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, dataSource]);

  // Auto-pin live when serial connects and switch data source
  useEffect(() => {
    if (serial.isConnected) {
      setTab1Live(true);
      setDataSource('serial');
      setRawData([]);
      livePlayback.skipToStart();
      playback.skipToStart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial.isConnected]);

  // Serial data appending
  useEffect(() => {
    if (dataSource === 'serial' && serial.latestPacket) {
      setRawData((prev) => [...prev, serial.latestPacket!]);
    }
  }, [dataSource, serial.latestPacket]);

  // Tab 1 current point: live mode pins to latest, otherwise follows scrubber
  const tab1CurrentPoint = useMemo(() => {
    if (rawData.length === 0) return undefined;
    if (tab1Live) return rawData[rawData.length - 1];
    return chartData[livePlayback.position] ?? rawData[rawData.length - 1];
  }, [rawData, chartData, tab1Live, livePlayback.position]);

  const handleGoLive = useCallback(() => {
    setTab1Live(true);
    livePlayback.pause();
  }, [livePlayback]);

  const handleExitLive = useCallback(() => {
    setTab1Live(false);
  }, []);

  const handleRestore = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      if (saved.rawData) {
        setRawData(saved.rawData);
        setDataSource(saved.dataSource || 'simulation');
        if (saved.settings) setSettings(saved.settings);
      }
    } catch {
      setRawData(generateSimulation(settings));
    }
    setShowRestore(false);
  }, [settings]);

  const handleDismissRestore = useCallback(() => {
    setShowRestore(false);
    setRawData(generateSimulation(settings));
  }, [settings]);

  const handleCSVImport = useCallback((data: DataPoint[]) => {
    setRawData(data);
    setDataSource('csv');
  }, []);

  const handleRegenerate = useCallback(() => {
    setRawData(generateSimulation(settings));
    setDataSource('simulation');
  }, [settings]);

  const handleExport = useCallback(() => {
    exportCSV(rawData);
  }, [rawData]);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-sans">
      {/* Restore banner */}
      {showRestore && (
        <div className="flex items-center justify-between px-6 py-2 bg-bg-surface1 border-b border-border-default">
          <span className="text-[13px] text-text-secondary">
            Previous session found.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              className="px-3 py-1 text-[12px] bg-accent text-white rounded-md"
            >
              Restore
            </button>
            <button
              onClick={handleDismissRestore}
              className="px-3 py-1 text-[12px] text-text-secondary border border-border-default rounded-md hover:bg-bg-surface3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="flex items-center border-b border-border-default">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-2 px-5 py-2.5 text-[12px] tracking-[0.08em] transition-colors ${
              activeTab === i
                ? 'text-text-primary border-b-2 border-accent'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setIsDark(d => !d)}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="flex items-center gap-1.5 px-5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            serial.isConnected ? 'bg-battery animate-pulse' : 'bg-text-tertiary'
          }`} />
          <span className="text-[11px] text-text-secondary">
            {serial.isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </nav>

      {/* Tab content */}
      <main className="p-6">
        {activeTab === 0 && (
          <LiveMonitor
            currentPoint={tab1CurrentPoint}
            metrics={liveMetrics}
            settings={settings}
            isLive={serial.isConnected}
            dataCount={rawData.length}
            playback={livePlayback}
            isLiveMode={tab1Live}
            onGoLive={handleGoLive}
            onExitLive={handleExitLive}
          />
        )}
        {activeTab === 1 && (
          <Analytics
            chartData={chartData}
            metrics={analyticsMetrics}
            settings={settings}
            playback={playback}
          />
        )}
        {activeTab === 2 && (
          <AIInsights
            messages={ai.messages}
            sendMessage={ai.sendMessage}
            isLoading={ai.isLoading}
            clearMessages={ai.clearMessages}
            hasData={rawData.length > 0}
          />
        )}
        {activeTab === 3 && (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            dataSource={dataSource}
            onCSVImport={handleCSVImport}
            onExport={handleExport}
            serial={serial}
            rawData={rawData}
            playbackPosition={playback.position}
            onRegenerate={handleRegenerate}
          />
        )}
      </main>

    </div>
  );
}

export default App;
