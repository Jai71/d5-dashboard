# D5 Dashboard — Build Instructions

## Changelog

### Modified
- **Section 5.0 (Header):** Removed `<Header>` component reference — header is built inline in App.tsx, not a separate component. Updated code example to match implementation.
- **Section 5.0 (Tab 1 Props):** Documented that Tab 1 (LiveMonitor) includes full playback controls (scrubber, play/pause, speed selector, LIVE button), not just a time bar.
- **Section 5.4 (calculations.ts):** Added documentation for `formatTime()` and `exportCSV()` utility functions that live in this file.
- **Section 6 Pass 2 (MetricDisplay):** Updated to match implementation — Battery Balance is now wrapped in a card with "BATTERY BALANCE" label and "Charge"/"Discharge" row labels. Discharge bar uses conditional colour: `rgba(255,255,255,0.4)` when safe, `#EE0000` when violation. Unmet demand is `15px` with `AlertTriangle` icon when > 0.
- **Section 6 Pass 2 (Hero):** Updated margin description from `32px` to `py-6` (24px) to match implementation.
- **Section 7 (Notifications):** Clarified that all three load triggers share triggerId 1, so only one unmet-load notification fires per debounce window.
- **Section 8 (Gantt):** Added reference to hatched rejected-charge spans (SoC drift detection from Section 9).

---

Read SPEC.md first, then dashboarddesign.md. Both files must be in the
project root alongside this file before any code is written.

- SPEC.md is the single source of truth for all data architecture,
  signal mappings, I/O tables, formulas, state definitions, and UI structure.
- CLAUDE.md is the authoritative source for all implementation decisions:
  stack, project structure, build configuration, AI integration, and
  data layer. It replaces SPEC.md Section 10 entirely.
- dashboarddesign.md is the design reference for colour tokens, spacing,
  animation CSS, and chart styling.
- Where dashboarddesign.md conflicts with SPEC.md, the spec wins.
- Where the design passes in Section 6 of this file contradict SPEC.md's
  component descriptions, the design passes win for visual treatment.
  The spec remains authoritative for data, formulas, and signal mappings.
- Comparison mode (SPEC.md Section 6.6) is deferred. Build for a single
  dataset only. Do not implement a second data slot or comparison UI.

---

## 1. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React 18 + TypeScript | Strict mode enabled. |
| Build | Vite 5 | With `@vitejs/plugin-react`. |
| Styling | Tailwind CSS v3 | Custom colour tokens in `tailwind.config.ts`. Do NOT use Tailwind v4. |
| Charts | Recharts | All area charts, line charts, bar charts, pie/donut charts. |
| Icons | lucide-react 0.263.1 | Pin this version exactly. |
| Font | Inter | Loaded via `<link>` in index.html from Google Fonts CDN. Not via npm. |
| Backend | Express 4 | Proxies OpenAI requests only. See Section 3. |
| CSV parsing | PapaParse | For CSV import. |
| Dev runner | concurrently | Runs Vite + Express in one command. |

Monospace font stack for all numerical values:
`"SF Mono", "Cascadia Code", "Consolas", "Liberation Mono", monospace`.

**No other dependencies.** No UI component libraries (no shadcn, no Radix,
no MUI). No animation libraries (no framer-motion). All animation is CSS.

---

## 2. Project Structure

```
d5-dashboard/
├── CLAUDE.md
├── SPEC.md
├── dashboarddesign.md
├── .env                         # OPENAI_API_KEY=sk-...
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── server.js                    # Express proxy (CommonJS)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── constants.ts
    ├── calculations.ts
    ├── simulation.ts            # Data generator (pure function, no hooks)
    ├── hooks/
    │   ├── usePlayback.ts
    │   ├── useSerial.ts
    │   └── useAI.ts
    └── components/
        ├── FlowDiagram.tsx
        ├── MetricDisplay.tsx
        ├── PlaybackBar.tsx
        ├── Notifications.tsx
        ├── GanttTimeline.tsx    # Custom — not a Recharts component
        ├── LiveMonitor.tsx
        ├── Analytics.tsx
        ├── AIInsights.tsx
        └── SettingsPanel.tsx
```

No additional files, subdirectories, or barrel exports beyond this.

### Configuration Files

**index.html:**
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D5 Smart Meter Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
<body class="bg-bg-base text-text-primary">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**tailwind.config.ts:**
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { base: '#000000', surface1: '#111111', surface2: '#171717', surface3: '#1F1F1F' },
        border: { default: '#333333', subtle: 'rgba(255,255,255,0.06)' },
        text: { primary: '#FAFAFA', secondary: '#888888', tertiary: '#666666', muted: '#444444' },
        solar: '#F5A623',
        wind: '#50E3C2',
        mains: '#888888',
        battery: '#4ADE80',
        load: '#3291FF',
        accent: '#0070F3',
        error: '#EE0000',
        warning: '#F5A623',
        ai: '#7928CA',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Cascadia Code"', '"Consolas"', '"Liberation Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**postcss.config.js:**
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**vite.config.ts:**
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; margin: 0; padding: 0; }

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }

@keyframes flowMove {
  0% { offset-distance: 0%; opacity: 0; }
  5% { opacity: 1; }
  95% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.4; }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

**src/main.tsx:**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 3. AI Integration — OpenAI via Express Proxy

The spec references Anthropic's API. This project uses OpenAI instead.

### server.js (complete, working)

```js
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

app.post('/api/chat', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        stream: true,
        messages: req.body.messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    // Forward the SSE stream to the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(decoder.decode(value, { stream: true }));
      }
    };

    pump().catch(() => res.end());

    // Clean up if client disconnects
    req.on('close', () => {
      reader.cancel().catch(() => {});
    });
  } catch (err) {
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

// SPA fallback for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API proxy on :${PORT}`));
```

### package.json scripts

```json
{
  "dev": "concurrently \"vite\" \"node --env-file=.env server.js\"",
  "build": "vite build",
  "preview": "NODE_ENV=production node --env-file=.env server.js"
}
```

### useAI hook — OpenAI SSE parsing

The OpenAI streaming format sends lines like:
```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"...","choices":[{"delta":{"content":" world"}}]}
data: [DONE]
```

The hook must:
1. Send POST to `/api/chat` with `{ messages }`.
2. Read the response as a stream using `getReader()`.
3. Buffer incoming text, split by `\n`, filter lines starting with `data: `.
4. Skip `data: [DONE]`.
5. Parse each `data: {...}` line as JSON, extract `choices[0].delta.content`.
6. Append each content chunk to the assistant message in state.

```ts
const processStream = async (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) appendToCurrentMessage(token);
      } catch { /* skip malformed lines */ }
    }
  }
};
```

### System prompt construction

Build dynamically in the hook from current state:

```ts
const buildSystemPrompt = (
  settings: Settings,
  metrics: Metrics,
  sampledData: DataPoint[]
) => {
  return `You are the AI analysis engine for the D5 Smart Electricity Meter dashboard.

System configuration:
- Max wind: ${settings.maxWind}A, Max PV: ${settings.maxPV}A, Max mains: ${settings.maxMains}A
- Battery rate: ${settings.batteryRate}A, Ref capacity: ${settings.refCapacity}Ah
- Load 1: ${settings.load1Demand}A, Load 2: ${settings.load2Demand}A, Load 3: ${settings.load3Demand}A

Key rules:
- Battery discharge time must NEVER exceed charge time (violation caps marks at 40%)
- Loads must be served when called — unmet demand hurts the score
- Renewables should be prioritised over mains

Current scenario: Renewable optimisation — maximise renewable usage, minimise mains dependency.

Session metrics:
- Total energy (load): ${metrics.totalEnergy.toFixed(2)} kWh
- Renewable: ${metrics.renewablePct.toFixed(1)}%, Mains dependency: ${metrics.mainsDependency.toFixed(1)}%
- Battery balance: ${metrics.chargeMin}min charge / ${metrics.dischargeMin}min discharge ${metrics.dischargeMin > metrics.chargeMin ? '⚠ VIOLATION' : '✓ OK'}
- Unmet demand: ${metrics.unmetDemand.toFixed(1)}%

Sampled data (48 points across 24h):
${JSON.stringify(sampledData)}

Be concise, technical, and specific. Reference exact timestamps and values.
When analysing performance, evaluate against the renewable optimisation target.`;
};
```

Sample 48 points: `rawData.filter((_, i) => i % Math.max(1, Math.floor(rawData.length / 48)) === 0).slice(0, 48)`.
This works for both the 288-point simulation and multi-million-row CSVs.
Include the last 6 messages for context continuity.

### AI Tab UI (AIInsights.tsx)

**Quick action buttons** — row of pill-shaped buttons at the top of Tab 3:

| Style | Label | Injected prompt |
|-------|-------|-----------------|
| Primary (purple `#7928CA` border) | 🔍 Analyze Performance | "Provide a comprehensive assessment of this algorithm's performance. Evaluate renewable usage, mains dependency, battery management, and load servicing. Identify specific timestamps where the algorithm performed well or poorly." |
| Secondary | 📄 Report Summary | "Write a concise technical paragraph summarising this test run, suitable for inclusion in a 5,000-word engineering report. State the scenario, key metrics, notable events, and areas for improvement." |
| Secondary | ⚡ Battery Analysis | "Analyse the battery charge/discharge patterns. Is the discharge-never-exceeds-charge rule satisfied? Were there any suspected rejected charge commands? How could battery cycling be improved?" |

Clicking a quick action populates the input field and auto-sends.

**Empty state** — when no messages exist, the chat area shows:
Left-aligned text: "Ask about the algorithm's performance." in `#888888`
13px. Below, five suggested prompts as text links (not pills):

- "What was peak mains draw and when?"
- "How many times was load 2 not served?"
- "Compare renewable usage day vs night"
- "Was battery cycling efficient?"
- "Where could the algorithm improve?"

Clicking a prompt populates the input field (does not auto-send).

**Message styling:**
- User messages: right-aligned, `#171717` background pill, 14px rounded
  corners, 12px 16px padding.
- AI messages: left-aligned, no background, full-width, monospace for data
  values, pre-wrap whitespace.
- Streaming cursor: `#4ADE80` 2px-wide blinking bar at end of streaming text.

**Error and loading states:**
- While streaming: disable the send button and input field. Show the
  streaming cursor. If the user presses Enter, ignore it.
- Server unreachable (fetch throws): show an inline system message in the
  chat: "Could not reach AI server. Make sure the Express proxy is
  running on port 3001." Style as `#EE0000` text, 12px, no background.
- API error (non-200 response): show the error text inline in the chat
  as a system message. Same red styling.
- No data loaded: the "Analyze Performance" button should be disabled
  with tooltip "Load data first." The input field remains usable for
  general questions.

---

## 4. Design System — Absolute Constraints

**Dark mode only.** No light mode. No theme toggle.

| Token | Value |
|-------|-------|
| Background | `#000000` |
| Surface 1 (cards) | `#111111` |
| Surface 2 (elevated) | `#171717` |
| Surface 3 (hover) | `#1F1F1F` |
| Border | `1px solid #333333` |
| Border subtle | `rgba(255,255,255,0.06)` |
| Text primary | `#FAFAFA` |
| Text secondary | `#888888` |
| Text tertiary | `#666666` |
| Text muted | `#444444` |

**No box shadows anywhere.** Borders replace shadows.
Cards use `box-shadow: 0 0 0 1px #333333` if a ring is needed.

**No gradients. No glow effects. No bloom. No glassmorphism.
No blurred backdrops. No background opacity/blur on modals.**

**Energy semantic colours:**

| Source | Stroke | Fill (15% opacity) |
|--------|--------|--------------------|
| Solar/PV | `#F5A623` | `rgba(245,166,35,0.15)` |
| Wind | `#50E3C2` | `rgba(80,227,194,0.15)` |
| Mains | `#888888` | `rgba(136,136,136,0.15)` |
| Battery | `#4ADE80` | `rgba(74,222,128,0.15)` |
| Loads | `#3291FF` | `rgba(50,145,255,0.15)` |

**UI state colours:** Accent `#0070F3`, Error `#EE0000`,
Warning `#F5A623`, AI/Info `#7928CA`.

**Typography** follows SPEC.md Section 8.2:
Page title 14–15px weight 600. Section labels 10–11px uppercase 0.08em
letter-spacing. Card values 20–24px monospace. Body 13px.
All numerical values use monospace.

---

## 5. Data Layer

### 5.0 Application Architecture (App.tsx)

App.tsx is the single state owner. All data flows down via props.
No context providers, no state management libraries.

**State owned by App.tsx:**

```ts
const [dataSource, setDataSource] = useState<'simulation' | 'csv' | 'serial'>('simulation');
const [rawData, setRawData] = useState<DataPoint[]>([]);
const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
const [activeTab, setActiveTab] = useState(0);
```

**Derived values (useMemo in App.tsx):**

```ts
const chartData = useMemo(() => {
  if (rawData.length <= CHART_MAX_POINTS) return rawData;
  const step = Math.floor(rawData.length / DOWNSAMPLE_TARGET);
  return rawData.filter((_, i) => i % step === 0);
}, [rawData]);

const metrics = useMemo(() => computeMetrics(rawData, settings), [rawData, settings]);
```

**Hooks instantiated in App.tsx:**

```ts
const playback = usePlayback(chartData);       // Tab 2
const livePlayback = usePlayback(chartData);   // Tab 1
const serial = useSerial();
const ai = useAI(rawData, settings, metrics);
```

**Data source switching:**

- On mount: try `localStorage.getItem('d5-session')`. If found, show
  restore banner. If dismissed or absent, call `generateSimulation(settings)`
  and set `dataSource = 'simulation'`, `rawData = result`.
- On settings change when `dataSource === 'simulation'`: regenerate
  `rawData` from `generateSimulation(settings)`.
- On CSV import: set `dataSource = 'csv'`, `rawData = parsed result`.
  Settings do NOT regenerate the data (CSV is external).
- On serial connect: set `dataSource = 'serial'`, `rawData = []`.
  Each `serial.latestPacket` is appended to `rawData` via `useEffect`.
- On serial disconnect: `dataSource` stays `'serial'`. `rawData` is frozen.
- "Regenerate Simulation" button on Tab 4: set `dataSource = 'simulation'`,
  regenerate from current settings.

**Tab 1 vs Tab 2 — current data point semantics:**

Tab 1 and Tab 2 have independent "current point" concepts. They do not
interact.

- **Tab 1 (LiveMonitor):** Has independent playback with a default
  "LIVE" mode. In LIVE mode, `currentPoint = rawData[rawData.length - 1]`.
  When the user drags the scrubber or presses play, Tab 1 exits LIVE mode
  and `currentPoint = chartData[livePlayback.position]`. A "LIVE" button
  re-pins to the latest data point. Tab 1 uses its own `usePlayback`
  instance, independent of Tab 2's. Tab 1 contains the energy flow diagram.
  Tab 1 has its own full playback bar (sticky bottom) with: skip-to-start,
  play/pause, skip-to-end, scrubber (0–24h), time display, speed selector
  (1x/2x/5x/10x), LIVE button (green pulsing dot when active), and a
  data point count. The `Notifications` component is rendered inside
  `LiveMonitor`, not at the App level.

- **Tab 2 (Analytics):** Shows the full dataset with playback. The
  scrubber controls `playback.simulatedHour`, which resolves to
  `playback.position` (an index into `chartData`). All Tab 2 charts
  and the Gantt position marker sync to this index. Tab 2 does NOT
  contain the energy flow diagram.

**Props passed to each tab component:**

```
<LiveMonitor
  currentPoint={tab1CurrentPoint}
  metrics={metrics}
  settings={settings}
  isLive={serial.isConnected}
  dataCount={rawData.length}
  playback={livePlayback}
  isLiveMode={tab1Live}
  onGoLive={handleGoLive}
  onExitLive={handleExitLive}
/>

<Analytics
  chartData={chartData}
  metrics={metrics}
  settings={settings}
  playback={playback}
/>

<AIInsights
  messages={ai.messages}
  sendMessage={ai.sendMessage}
  isLoading={ai.isLoading}
  clearMessages={ai.clearMessages}
  hasData={rawData.length > 0}
/>

<SettingsPanel
  settings={settings}
  setSettings={setSettings}
  dataSource={dataSource}
  onCSVImport={(data) => { setRawData(data); setDataSource('csv'); }}
  onExport={() => exportCSV(rawData)}
  serial={serial}
  rawData={rawData}
  playbackPosition={playback.position}
  onRegenerate={() => { setRawData(generateSimulation(settings)); setDataSource('simulation'); }}
/>
```

**Header (always visible above tabs):**

The header is built inline in App.tsx (not a separate component). It
contains: team name "D5" (left, 15px semibold), live/offline badge
(centre), Bluetooth connect/disconnect button (right). The badge shows
a green pulsing dot with "LIVE" when `serial.isConnected`, grey dot
with "OFFLINE" otherwise. The button uses `Bluetooth` / `BluetoothOff`
icons from lucide-react.

### 5.1 Types (types.ts)

```ts
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
```

### 5.1b Constants (constants.ts)

```ts
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
```

### 5.2 Simulation (simulation.ts)

Pure function, not a hook. Returns `DataPoint[]`.

```ts
export function generateSimulation(settings: Settings): DataPoint[]
```

288 data points (5-minute intervals, 24 simulated hours).

Generation rules:
- `time`: `i * (24 / 288)` for i = 0..287, giving 0.000, 0.0833, ..., 23.917.
- `pv`: bell curve. `settings.maxPV * Math.exp(-0.5 * Math.pow((hour - 12) / 3, 2))`.
  Clamp to 0 below 0.05A. Zero at night, peaks ~2A at noon.
- `wind`: slow drift. Start at 0.3. Each step: `+= (Math.random() - 0.5) * 0.1`,
  clamped `[0, settings.maxWind]`. Produces gentle variation, not white noise.
- `vbus`: `238 + Math.random() * 4` (jitter around 240V).
- Load calls:
  - `cl1` (0.8A): ON hours 6–22.
  - `cl2` (1.8A): ON hours 7–10 and 17–21.
  - `cl3` (1.4A): intermittent, ON 2h then OFF 1h from hour 8–20.
- Algorithm logic at each step:
  1. `renewable = pv + wind`.
  2. Switch on called loads if supply covers demand. Prioritise by size:
     Load 1 (0.8A) first, Load 3 (1.4A) second, Load 2 (1.8A) last.
     During hours 0–5 and 19–24, leave Load 2 unmet when wind < 0.3A.
  3. `totalLoad = Σ(lsN × loadN_demand)`.
  4. `deficit = totalLoad - renewable`. If > 0:
     - If `soc > 0` and not charging: `bdis = 1`, covers up to 1A of deficit.
     - Remaining: `mainsRequest = (remaining / settings.maxMains) * 10`, clamped [0, 10].
  5. `surplus = renewable - totalLoad`. If ≥ 1A and not discharging:
     - `bchg = 1`. `soc += Δt_hours * settings.batteryRate`.
  6. SoC: starts 0. `+= Δt * rate` charging, `-= Δt * rate` discharging.
     Clamp min 0. No max (unlimited capacity).
  7. `ibus ≈ totalLoad + (bchg ? settings.batteryRate : 0)`.
- `bchg` and `bdis` must never both be 1.
- Simulation must produce charge > discharge overall (safety check passes).

### 5.3 Hooks

**usePlayback(data: DataPoint[])**
Returns `{ position, simulatedHour, isPlaying, speed, play, pause,
skipToStart, skipToEnd, setPosition, setSpeed }`.

Playback is time-based, not index-based. This ensures consistent
behaviour regardless of how many data points exist.

- `simulatedHour`: float 0–24. This is the primary state value.
- `position`: derived index into `data` — the closest data point to the
  current `simulatedHour`. `Math.round((simulatedHour / 24) * (data.length - 1))`.
- At 1× speed, 1 wall-clock second = 1 simulated minute. So 24 simulated
  hours = 24 real minutes (matching the test bed run time).
- At 10× speed, 24 simulated hours = 2.4 real minutes.
- Speed options: 1, 2, 5, 10.
- `useEffect` with `setInterval` at 100ms. Each tick advances
  `simulatedHour` by `(100 / 1000) × (1 / 60) × speed` hours.
- The scrubber on Tab 2 maps to `simulatedHour` (0–24), not array index.
- `setPosition(hour: number)` for scrubber drag.

**useSerial()**
Returns `{ isConnected, connect, disconnect, latestPacket }`.

Web Serial, 9600 baud, read-only. Parses CSV lines into `DataPoint`.
Guard with `if ('serial' in navigator)`. Show "Chrome required" if absent.

**useAI(data, settings, metrics)**
Returns `{ messages, sendMessage, isLoading, clearMessages }`.
Full implementation in Section 3.

### 5.4 Metric Calculations (calculations.ts)

```ts
export function computeMetrics(data: DataPoint[], settings: Settings): Metrics
export function formatTime(hour: number): string   // hour float → "HH:MM"
export function exportCSV(data: DataPoint[]): void  // triggers browser download
```

Implements SPEC.md Section 11.

Derive `Δt` from the data: `Δt_hours = 24 / data.length`. For the
288-point simulation this gives 5/60 hours. For a CSV with a different
point count it adjusts automatically.

- **Total Energy (Load):**
  `Σ ((ls1×L1 + ls2×L2 + ls3×L3) × vbus × Δt_hours) / 1000` kWh.
  Uses switch states, not calls.
- **Renewable %:**
  `Σ(wind + pv) / Σ(wind + pv + mainsCurrent) × 100`.
  `mainsCurrent = (mainsRequest / 10) × settings.maxMains`.
- **Mains Dependency:**
  `Σ(mainsCurrent) / Σ(wind + pv + mainsCurrent) × 100`.
- **Battery Balance:**
  `chargeMin = (count bchg===1) × (24 * 60 / data.length)`.
  `dischargeMin = (count bdis===1) × (24 * 60 / data.length)`.
- **Unmet Demand:**
  `(count where (cl1&&!ls1)||(cl2&&!ls2)||(cl3&&!ls3)) / total × 100`.

### 5.5 Data Persistence

Use `localStorage`.

On load: check `localStorage.getItem('d5-session')`. If found, show
banner "Previous session found. Restore / Dismiss". Otherwise generate
fresh simulation. On data change, save to localStorage.

### 5.6 CSV Import and Export

**Import** (Tab 4):

Use PapaParse:
```ts
import Papa from 'papaparse';
Papa.parse(file, {
  header: true,
  dynamicTyping: true,
  complete: (results) => { /* results.data → DataPoint[] */ }
});
```

If headers match the Bluetooth format (`time,wind,pv,vbus_rms,...`),
auto-map directly. If not, show a column mapping screen: each row has
a dropdown of CSV headers on the left, signal name on the right.
"Confirm Mapping" button applies and loads. Save confirmed mapping to
`localStorage.setItem('d5-column-map', ...)` for reuse.

**Downsampling large files:**

Test bed CSVs can contain millions of rows (2,880,000 for a full
24-minute run at 0.0005s). Recharts cannot render this many points
and the browser will hang.

After parsing, store the full array as `rawData`. The `chartData`
downsampling in App.tsx (Section 5.0) handles this automatically —
no additional code needed in the import handler. Just set `rawData`
to the parsed result and the `useMemo` derivation produces `chartData`.

Use `chartData` for all Recharts components, playback, and the Gantt
timeline. Use `rawData` for metric calculations in `computeMetrics`
(which iterates all points and handles variable Δt correctly).
The AI sampler also draws from `rawData` (48 evenly spaced points).

**Export:**

```ts
const headers = 'time,wind,pv,vbus_rms,ibus_rms,cl1,cl2,cl3,mains_request,ls1,ls2,ls3,bchg,bdis,soc';
const rows = data.map(d => [d.time,d.wind,d.pv,...].join(','));
const csv = [headers, ...rows].join('\n');
const blob = new Blob([csv], { type: 'text/csv' });
// trigger download via temporary <a> element
```

---

## 6. Design Passes

These override SPEC.md's visual descriptions where they conflict.

### Pass 1: Break the grid (Flow Diagram)

**SVG viewBox:** `"0 0 800 400"`. Responsive: `width="100%"
preserveAspectRatio="xMidYMid meet"`.

**Node positions:**

| Node | x | y |
|------|---|---|
| PV/Solar | 80 | 100 |
| Wind | 80 | 300 |
| Mains | 80 | 200 |
| Battery | 280 | 300 |
| Busbar | 400 | 200 |
| Load 1 | 680 | 100 |
| Load 2 | 680 | 200 |
| Load 3 | 680 | 300 |

**Curved paths:** SVG `<path>` with cubic beziers. Example PV→Busbar:
`M 120 100 C 250 100, 280 200, 360 200`. Gentle arcs, no straight lines.

**Particles:** SVG `<circle r="3">` animated via CSS `offset-path`
and `offset-distance`. 3–6 per path, staggered delay.

```css
@keyframes flowMove {
  0% { offset-distance: 0%; opacity: 0; }
  5% { opacity: 1; }
  95% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
```

**Speed:** 0A = no particles (dashed grey path). 0.1–1A = 4s. 1–3A = 2.5s. 3–5A = 1.5s. 5A+ = 0.8s.

**Stroke width:** 1.5px–4px, linear with `current / maxCapacity`.

**Source scaling:** `scale(0.9 + (current / max) * 0.2)`, clamped
[0.9, 1.1]. `transform-origin: center`. `transition: transform 600ms ease-out`.

**Busbar rings:** 2–3 `<circle>` at r=30, 38, 46. Animate opacity
0.15↔0.4 at 2s, 2.5s, 3s periods. Stroke `#333`, no fill.

**Battery shape:** `<rect width="40" height="60" rx="6">` + terminal cap
`<rect width="16" height="6">`. Fill rect clipped: height =
`(soc / refCapacity) * 56`, `#4ADE80` at 40% opacity, bottom-anchored.

**CALLING displacement:** `translateX(10px)`,
`transition: transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`.

**Grain:** SVG filter on diagram background:
```xml
<filter id="grain">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
  <feColorMatrix type="saturate" values="0" />
</filter>
<rect width="100%" height="100%" filter="url(#grain)" opacity="0.035" />
```

### Pass 2: Kill the uniformity (MetricDisplay)

Tab 1 metric layout — replaces SPEC.md's five uniform cards:

**Row 1 — Hero Renewable %:**
No card. `#000` background. 52px monospace `#4ADE80`. Label "RENEWABLE"
9px `#444` uppercase 0.08em spacing. `py-6` (24px) above/below.

**Row 2 — Three cards:**

| Left | Centre | Right |
|------|--------|-------|
| Total Energy card (#111, 1px #333, 12px radius, 20px pad). 22px mono white. "kWh". | Battery Balance card (same card treatment: #111 bg, 1px #333 border, 12px radius, 20px pad). "BATTERY BALANCE" section label (9px muted uppercase). Two rows: "Charge" label (10px, 60px width) + green bar + green minutes; "Discharge" label + conditional-colour bar + minutes. Charge bar: always `bg-battery`. Discharge bar: `rgba(255,255,255,0.4)` when safe, `#EE0000` when violation. Discharge minutes: `text-text-secondary` when safe, `text-error` when violation. "40% CAP RISK" in red below bars if violation. | Mains Dependency card. 22px mono #888. "%". |

**Row 3 — Unmet Demand inline:**
`flex` row with `gap-1.5`. `AlertTriangle` icon (14px) shown when > 0.
"0.0% unmet" in `#444` when zero. "2.3% unmet" in `#F5A623` when > 0.
15px monospace. No card.

### Pass 3: Controlled imperfection

- Border-radii: charts 14px, cards 12px, chat input 16px, tooltips 16px.
- AI empty state: left-aligned "Ask about the algorithm's performance."
  #888 13px. Prompts below as text links, not pills.
- Tooltip: stacked area chart uses card-style (#171717 bg, #333 border).
  SoC chart uses minimal (no border, `rgba(0,0,0,0.7)` bg, single line).
- Gantt segments: `border-radius: 4px`.
- Settings focus: `box-shadow: 0 0 0 2px rgba(160,200,255,0.4)`.
- Playback bar gradient stops at 0%, 67%, 100%.

# Design Pass 4: AI Insights Tab — Chat-App Layout

This pass overrides CLAUDE.md Section 3's AI Tab UI description and
SPEC.md Section 6's chat interface description for visual treatment only.
Data flow, system prompt, streaming logic, and quick action prompt text
are unchanged.

---

## Two states: Empty and Active

The tab has two entirely different layouts depending on whether
`messages.length === 0`.

---

## Empty State (no messages)

Everything is vertically and horizontally centred in the available
tab space. No content is pinned to the top or bottom — the whole
composition sits in the middle of the viewport.

**Stack (top to bottom, centred):**

1. **Icon + Greeting.** The AI icon (`#0070F3`, 28px) sits inline to
   the left of the text "D5 Algorithm Advisor" in 28–32px, weight 600,
   `text-primary`. Single line, centred. 24px gap below.

2. **Input box.** This is NOT a single-line `<input>`. It is a
   `<textarea>` wrapped in a container div. The container has:
   - Width: `max-w-2xl` (672px max), full width on smaller screens.
   - Background: `#111111`.
   - Border: `1px solid #333333`, `border-radius: 16px`.
   - Padding: 16px 16px 12px 16px.
   - The textarea itself: no border, no background, `text-primary`,
     14px, placeholder "Ask about the data..." in `#666666`.
     `resize: none`, `rows={2}`, auto-grows up to 6 rows.
   - Below the textarea, inside the same container: a bottom row with
     the send button right-aligned. Send button: `#0070F3` background,
     white arrow icon (lucide `Send`), 32px circle, `border-radius: 50%`.
     Disabled (opacity 0.3) when textarea is empty or `isLoading`.
   - 20px gap below the container.

3. **Quick action pills.** Horizontal row, centred, flex-wrap.
   The three existing quick actions (Analyze Performance, Report Summary,
   Battery Analysis) are rendered as pills:
   - Background: transparent.
   - Border: `1px solid #333333`, `border-radius: 9999px`.
   - Padding: 8px 16px.
   - Text: 13px, `text-secondary`, with the emoji icon inline.
   - Hover: background `#111111`, border `#444444`.
   - "Analyze Performance" pill gets `border-color: #0070F3` to mark
     it as the primary action. The others use default `#333333`.
   - Gap between pills: 10px.
   - Clicking a pill populates the textarea and auto-sends (existing
     behaviour, unchanged).
   - 12px gap below.

4. **Suggested prompts.** The five text-link prompts from the existing
   spec are rendered as a second row of pills, same style as quick
   actions but all with default `#333333` borders (none highlighted).
   Clicking populates the textarea but does NOT auto-send (existing
   behaviour, unchanged).

**Nothing else in the empty state.** No Brain icon, no "AI Analysis
Engine" heading, no description paragraph. The greeting + input +
pills replace all of that.

---

## Active State (messages exist)

The layout flips to a standard chat-app structure with three zones.

**Zone 1 — Quick actions (top, sticky).**
The three quick action pills sit in a row at the top of the tab,
horizontally left-aligned, same pill styling as empty state.
`padding: 12px 0`, `border-bottom: 1px solid rgba(255,255,255,0.06)`.
This row is always visible and does not scroll with messages.

**Zone 2 — Messages (middle, scrollable).**
`flex: 1`, `overflow-y: auto`, padding 20px. Max-width `max-w-3xl`
(768px), centred horizontally with `mx-auto`. Messages stack
vertically with 20px gap between each message group.

- **User messages:** Right-aligned (`ml-auto`). Background `#1F1F1F`.
  `border-radius: 20px`. Padding 10px 16px. Max-width 80%.
  Text: 14px, `text-primary`. No icon or avatar.

- **AI messages:** Left-aligned, full-width (no `max-width` constraint
  within the centred container). No background. No bubble. Text: 14px,
  `text-primary`, `white-space: pre-wrap`. Monospace (`font-mono`) for
  any inline data values, timestamps, or metric numbers.
  - **Streaming cursor:** While `isLoading`, append a blinking `|`
    character in `#0070F3` at the end of the streaming text.
    `animation: blink 1s step-end infinite`.

- **AI message action row:** Below each completed AI message (not while
  streaming), show a row of small icon buttons, left-aligned, 8px gap
  between them, 8px above:
  - Copy (lucide `Copy`, 16px, `#666666`, hover `#FAFAFA`)
  - That's the only action needed. Do not add thumbs up/down/retry —
    those are Claude.ai features, not relevant here.

- **Error messages:** Left-aligned, no background. Text: 13px,
  `#EE0000`. Same positioning as AI messages.

- Auto-scroll to bottom when new message content arrives (during
  streaming and on new messages). If the user has scrolled up
  manually, do NOT auto-scroll — only resume auto-scroll when they
  scroll back to within 100px of the bottom.

**Zone 3 — Input (bottom, sticky).**
Pinned to the bottom of the tab. Same textarea container as the empty
state, but:
- Width: matches the message area max-width (`max-w-3xl`, centred).
- `padding: 12px 0 8px 0`.
- Below the input container, centred: a disclaimer line in 11px
  `#444444`: "AI can make mistakes. Verify important information."
  4px below the container.
- Placeholder text changes to "Reply..." when messages exist.

---

## Transitions

- **Empty → Active:** On first message send, the centred composition
  fades out (150ms, opacity) and the three-zone layout fades in
  (200ms, opacity + translateY 8px). No jarring jump.
- **Active → Empty:** When `clearMessages()` is called (if you add a
  "New chat" button or clear action), reverse the transition.

---

## What this replaces

- CLAUDE.md Section 3 "AI Tab UI": the empty state description
  (Brain icon, "AI Analysis Engine", description paragraph, grid of
  prompt pills) is fully replaced by this pass.
- CLAUDE.md Section 3 "Message styling": replaced by the message
  formatting above.
- SPEC.md Section 6.2 "Chat Interface": empty state and message
  styling replaced.

What is NOT replaced: the system prompt construction, the streaming
SSE parser, the `useAI` hook, quick action prompt text, error/loading
logic, and the "Analyze Performance disabled when no data" rule. All
of those remain as specified in CLAUDE.md Section 3.

---

## 7. Notification System

Manages toast notifications per SPEC.md Section 4.3.

**State:** `Notification[]` (type defined in types.ts).

**Six triggers** (checked against the current data point):

| # | Condition | Type | Message |
|---|-----------|------|---------|
| 1 | `clN && !lsN` | warning | "Load N calling — not yet switched on" (all three loads share triggerId 1 — only one fires per debounce window) |
| 2 | `soc < 1 && soc > 0` | error | "Battery below 1 Ah" |
| 3 | `pv > 1.5 && mainsCurrent > 0.5` | info | "High PV available but mains still drawing" |
| 4 | `soc <= 0 && bdis === 1` | error | "Battery fully discharged" |
| 5 | `bchg === 1 && bdis === 1` | error | "ERROR: Simultaneous charge and discharge" |
| 6 | `mainsRequest >= 9.5` | warning | "Mains request at maximum (4A)" |

**When notifications fire:** Only during live serial mode
(`dataSource === 'serial' && serial.isConnected`). Notifications do NOT
fire during simulation review, CSV playback, or Tab 2 scrubbing — the
data is historical and alerting on past events is misleading. The
notification triggers evaluate `rawData[rawData.length - 1]` (the latest
serial packet), not the playback position.

**Debounce:** Do not fire if the same trigger # is visible or was
dismissed within the last 10 seconds. Prevents flood during scrubbing.

**Component:** Fixed top-right. 4px coloured left border (amber/red/blue).
Lucide icon. 12px message. Dismiss X. Auto-dismiss 5s. Enter animation:
`translateX(16px) → 0`, 300ms ease-out. Stack vertically, max 3 visible.

---

## 8. Gantt Timeline (GanttTimeline.tsx)

**Custom component — not Recharts.** Recharts has no Gantt type.

Structure: `<div>` with 4 rows. Each row: label (50px) + bar track (flex:1).

**Bar rendering:** Iterate data, find contiguous spans where signal is
active. Each span becomes an absolutely-positioned `<div>`:
`left: (start/total)*100%`, `width: (length/total)*100%`, `border-radius: 4px`.

**Load rows (3):** Two layers per row:
- Back: amber `rgba(245,166,35,0.3)` where `clN===1`.
- Front: blue `rgba(50,145,255,0.5)` where `lsN===1`.

**Battery row:** Green `rgba(74,222,128,0.4)` where `bchg===1`.
Purple `rgba(168,85,247,0.4)` where `bdis===1`.
Hatched pattern overlay on suspected rejected charge spans per Section 9
(`repeating-linear-gradient(45deg, #4ADE80 0 4px, transparent 4px 8px)`).

**Position marker:** White div, 1px wide, `left: (position/total)*100%`.

**Legend:** Below timeline. Coloured squares + labels.

---

## 9. SoC Drift Detection

Per SPEC.md Section 9.1. At each point where `bchg === 1`:

1. `mainsCurrent = (mainsRequest / 10) * settings.maxMains`.
2. `supply = wind + pv + mainsCurrent`.
3. `demand = (ls1 * load1) + (ls2 * load2) + (ls3 * load3)`.
4. `surplus = supply - demand`.
5. If `surplus < 1.0`: suspected rejected charge.

**Responses:**
- Flow diagram: "CHARGE REJECTED?" in amber below battery node.
- Gantt: hatched pattern on affected charge spans
  (`repeating-linear-gradient(45deg, #4ADE80 0 4px, transparent 4px 8px)`).
- AI prompt: include count of suspected rejections.

---

## 10. Build Sequence

Each step must compile and render before starting the next.

1. **Scaffold + data.** Vite + TS + Tailwind. Use config files from
   Section 2. All types, constants, calculations, simulation. `usePlayback`.
   Stub serial and AI. App.tsx per Section 5.0: state, derived values,
   tab switching, header. Generate simulation on mount. Verify data
   renders in console and tabs switch correctly.

2. **Flow diagram.** Full `FlowDiagram.tsx` per Section 6 Pass 1. All
   SVG, particles, scaling, displacement, rings, battery shape, grain.

3. **Tab 1 — Live Monitor.** FlowDiagram + MetricDisplay (Pass 2) +
   Notifications (Section 7) + time bar.

4. **Tab 2 — Analytics.** Stacked area + donut + GanttTimeline (Section 8)
   + SoC chart + safety panel + collapsible busbar + PlaybackBar.

5. **Tab 4 — Settings.** Config inputs + Bluetooth UI + CSV import/export
   (Section 5.6) + raw data table + regenerate button.

6. **Tab 3 — AI Insights.** Quick actions + chat + streaming (Section 3)
   + `server.js` tested end-to-end.

7. **Web Serial.** Complete `useSerial`. Wire to UI. Hardware required.

---

## 11. Critical Rules

1. **Units are amps, not watts.** Only Total Energy uses watts (current × voltage).
2. **Mains conversion is dashboard-side.** `I = (V / 10) × maxMains`.
3. **SoC is amp-hours, not percentage.** Fill gauge scales to `refCapacity`.
4. **One-way serial.** Never write to port.
5. **Discharge ≤ charge.** Violation = 40% cap. Safety panel must be prominent.
6. **Δt is derived from data.** `24 / data.length` hours. Never hardcode interval.
7. **All source files `.ts`/`.tsx`.** Exception: `server.js`.
8. **Four tabs:** Live Monitor, Analytics, AI Insights, Settings & Data.
9. **No files beyond Section 2.** No extra components, no utils folders. Utility functions go in `calculations.ts` or `simulation.ts`.
10. **No decorative elements.** No gradients, glows, glassmorphism, blurred overlays.
11. **Node ≥ 20.6 required.** The `--env-file` flag in npm scripts requires it.
