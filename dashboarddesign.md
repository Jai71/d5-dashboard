# Energy dashboard design specification from six best-in-class references

**The optimal energy monitoring dashboard synthesizes Tesla's energy flow semantics, Vercel's dark-mode minimalism, Linear's information density and speed, and the AI chat patterns from OpenAI and Anthropic into a cohesive, developer-ready system.** This specification provides exact values — fonts, colors, spacing, components — drawn from reverse-engineering each reference product. Every recommendation below is grounded in specific design decisions made by these companies, adapted for a smart meter dashboard that visualizes real-time energy flow, time-series power data, battery state, and an AI analysis chat panel.

---

## Typography system built on Geist and Inter

**Primary font: Geist Sans** (by Vercel, OFL licensed, variable weight 100–900). This is the strongest choice for a technical energy dashboard — it was designed for developer tools, supports tabular figures for numerical data, and is free. Pair with **Geist Mono** for all numerical readouts, kW/kWh values, and code in the AI chat panel.

| Role | Font | Size | Weight | Line height | Letter spacing |
|------|------|------|--------|-------------|----------------|
| Page title | Geist Sans | 24px | 600 | 32px | -0.02em |
| Section header | Geist Sans | 16px | 600 | 24px | -0.01em |
| Card title | Geist Sans | 14px | 500 | 20px | 0 |
| Body text | Geist Sans | 14px | 400 | 22px | 0 |
| Secondary/meta text | Geist Sans | 13px | 400 | 18px | 0 |
| Tertiary/caption | Geist Sans | 12px | 400 | 16px | 0.01em |
| Power readout (kW) | Geist Mono | 20px | 500 | 28px | 0 |
| Chart axis labels | Geist Mono | 12px | 400 | 16px | 0.02em |
| Battery % display | Geist Mono | 32px | 600 | 40px | -0.02em |
| AI chat message | Geist Sans | 14px | 400 | 1.6 | 0 |
| AI chat code block | Geist Mono | 13px | 400 | 1.5 | 0 |
| Button text | Geist Sans | 14px | 500 | 20px | 0 |
| Label (uppercase) | Geist Sans | 12px | 600 | 16px | 0.08em |

Install via npm (`geist` package) or download from `vercel.com/font`. Use CSS variables `--font-geist-sans` and `--font-geist-mono`. The font stack fallback follows Linear's pattern: `"Geist Sans", "Inter", "SF Pro Display", -apple-system, system-ui, "Segoe UI", Roboto, sans-serif`.

**Why Geist over alternatives:** OpenAI uses Söhne (~$40,000 license) and Anthropic uses custom proprietary faces — neither is practical. **Inter** (Linear's choice) is the fallback if Geist causes issues. Geist's tabular figures and monospace variant make it ideal for data-heavy dashboards where numbers must align in columns.

---

## Color system with energy-semantic palette

The color architecture follows three layers: a **neutral foundation** (derived from Vercel's pure dark mode), an **energy semantic palette** (adapted from Tesla's established conventions), and **UI state colors** (blending Vercel's semantic tokens with Linear's status system).

### Foundation colors (dark mode primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#000000` | Page background (Vercel's pure black) |
| `--bg-surface-1` | `#111111` | Card backgrounds, sidebar |
| `--bg-surface-2` | `#171717` | Elevated surfaces, modals |
| `--bg-surface-3` | `#1F1F1F` | Hover states on surfaces |
| `--border-default` | `#333333` | Card borders, dividers |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Subtle separators (Linear pattern) |
| `--text-primary` | `#FAFAFA` | Headings, primary content |
| `--text-secondary` | `#888888` | Labels, meta text |
| `--text-tertiary` | `#666666` | Disabled, placeholder |
| `--text-muted` | `#444444` | Least important text |

### Foundation colors (light mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#FFFFFF` | Page background |
| `--bg-surface-1` | `#FAFAFA` | Card backgrounds |
| `--bg-surface-2` | `#F5F5F5` | Elevated surfaces |
| `--bg-surface-3` | `#EAEAEA` | Hover states |
| `--border-default` | `#EAEAEA` | Borders |
| `--border-subtle` | `rgba(0,0,0,0.06)` | Subtle separators |
| `--text-primary` | `#171717` | Primary text |
| `--text-secondary` | `#666666` | Secondary text |
| `--text-tertiary` | `#999999` | Tertiary text |

### Energy semantic colors (Tesla-derived, critical for the domain)

Tesla's established color mapping is the industry standard. Users of any energy product will intuitively expect these associations:

| Source | Primary hex | Light variant | Dark variant | RGB glow (for flow lines) |
|--------|------------|---------------|-------------|--------------------------|
| **Solar** | `#F5A623` | `#FFEFCF` | `#AB570A` | `rgba(245, 166, 35, 0.3)` |
| **Wind** | `#50E3C2` | `#AAFFEC` | `#29BC9B` | `rgba(80, 227, 194, 0.3)` |
| **Grid/Mains** | `#888888` | `#EAEAEA` | `#444444` | `rgba(136, 136, 136, 0.3)` |
| **Battery** | `#4ADE80` | `#D1FAE5` | `#16A34A` | `rgba(74, 222, 128, 0.3)` |
| **Home/Load** | `#3291FF` | `#D3E5FF` | `#0761D1` | `rgba(50, 145, 255, 0.3)` |

These exact colors are chosen to work on both dark and light backgrounds. Solar uses Vercel's warning amber (`#F5A623`). Battery uses a green distinct from wind's teal. Grid uses neutral gray. Home/load uses Vercel's success blue (`#3291FF`). Wind uses Vercel's cyan (`#50E3C2`).

### UI state colors (from Vercel's token system)

| State | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#0070F3` | Primary actions, links, focus rings |
| `--success` | `#0070F3` | Successful operations |
| `--error` | `#EE0000` | Errors, critical alerts |
| `--warning` | `#F5A623` | Warnings (shares with solar — use context) |
| `--info` | `#7928CA` | AI insights, analysis highlights |

### Chart visualization palette

For time-series charts showing multiple data series, use the energy semantic colors at **70% opacity** for area fills and **100% for line strokes**. This follows Tesla's approach of semi-transparent fills against dark chart backgrounds.

```css
--chart-solar-fill: rgba(245, 166, 35, 0.15);
--chart-solar-stroke: #F5A623;
--chart-wind-fill: rgba(80, 227, 194, 0.15);
--chart-wind-stroke: #50E3C2;
--chart-grid-fill: rgba(136, 136, 136, 0.15);
--chart-grid-stroke: #888888;
--chart-battery-fill: rgba(74, 222, 128, 0.15);
--chart-battery-stroke: #4ADE80;
--chart-load-fill: rgba(50, 145, 255, 0.15);
--chart-load-stroke: #3291FF;
```

---

## Spacing, layout grid, and responsive breakpoints

### Spacing scale (4px base grid, following Linear and Vercel)

| Token | Value | Common usage |
|-------|-------|-------------|
| `--space-1` | 4px | Inline spacing, icon gaps |
| `--space-2` | 8px | Compact padding, list item gaps |
| `--space-3` | 12px | Button padding, card internal gaps |
| `--space-4` | 16px | Section gaps, standard padding |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Section dividers, modal padding |
| `--space-8` | 32px | Major section spacing |
| `--space-10` | 40px | Page-level vertical spacing |
| `--space-12` | 48px | Hero spacing |
| `--space-16` | 64px | Major layout divisions |

### Layout structure

The dashboard uses a **sidebar + main content** pattern (Linear's inverted-L) with the AI chat panel as a **right-side collapsible panel** (Anthropic's artifacts pattern).

```
┌──────────────────────────────────────────────────────────┐
│  Top bar: Logo + breadcrumbs          Search (Cmd+K)  ⚙  │
├─────────┬──────────────────────────────┬─────────────────┤
│ Sidebar │     Main content area        │  AI Chat Panel  │
│ 240px   │     flex: 1                  │  380px          │
│         │                              │  (collapsible)  │
│ Nav     │  ┌────────────────────────┐  │                 │
│ items   │  │  Energy flow diagram   │  │  Chat messages  │
│         │  │  (hub-and-spoke)       │  │                 │
│         │  └────────────────────────┘  │  AI analysis    │
│         │  ┌────────┐ ┌────────────┐  │                 │
│         │  │Battery │ │  Summary   │  │  Input field    │
│         │  │  SoC   │ │  cards     │  │                 │
│         │  └────────┘ └────────────┘  │                 │
│         │  ┌────────────────────────┐  │                 │
│         │  │  Time-series chart     │  │                 │
│         │  └────────────────────────┘  │                 │
├─────────┴──────────────────────────────┴─────────────────┤
│  Status bar (optional): connection status, last updated   │
└──────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Sidebar width (expanded) | 240px |
| Sidebar width (collapsed) | 48px (icon-only, Linear pattern) |
| AI chat panel width | 380px |
| Main content min-width | 640px |
| Top bar height | 48px |
| Card gap | 16px |
| Page padding | 24px |
| Max content width (within main) | 1200px |
| Chart max height | 320px |
| Energy flow diagram height | 280–360px |

### Responsive breakpoints

| Breakpoint | Width | Layout change |
|-----------|-------|---------------|
| Desktop XL | ≥1440px | Full three-panel layout |
| Desktop | ≥1024px | AI panel collapses to overlay drawer |
| Tablet | ≥768px | Sidebar collapses to icon-only; AI panel is full overlay |
| Mobile | <768px | Bottom tab navigation; single-column; AI panel is full-screen modal |

On mobile, switch to **bottom tab navigation** (Tesla's pattern) with 5 tabs: Overview, Charts, Battery, AI, Settings. The energy flow diagram scales down to a simplified version.

---

## Navigation, sidebar, and multi-view patterns

### Sidebar navigation (desktop)

The sidebar follows Linear's hierarchy pattern — compact, icon + label, collapsible groups:

**Sidebar structure (top to bottom):**
1. **Workspace header** — Site/property name with dropdown (for multi-site setups)
2. **Quick actions** — Search (`Cmd+K`), Notifications
3. **Primary views** — Overview, Energy Flow, Charts & Analytics, Battery, Sources
4. **AI section** — AI Analysis (opens right panel), Insights History
5. **Configuration** — Settings, Devices, Alerts & Thresholds
6. **Footer** — User avatar, theme toggle, help

Each item: 32px height, 12px left padding, 8px icon size, 8px gap to label text. Active state uses `--accent` color with `rgba(0, 112, 243, 0.1)` background. Hover uses `--bg-surface-3`.

### Command palette (Cmd+K)

Following Linear's pattern: centered modal overlay, search input at top, grouped results below. Provides instant access to all views, settings, and actions. This is what makes Linear feel fast — apply the same principle.

### Mobile bottom tabs

Five tab items following Tesla's app pattern: fixed bottom bar at 56px height, icon (24px) above label (10px), active tab highlighted with `--accent` color.

---

## Card and container component specifications

### Card system (Vercel's materials approach adapted)

| Card type | Border radius | Border | Background | Shadow | Padding |
|-----------|--------------|--------|------------|--------|---------|
| Base card | 8px | `1px solid var(--border-default)` | `var(--bg-surface-1)` | none (dark) / `0 1px 2px rgba(0,0,0,0.04)` (light) | 20px |
| Metric card | 8px | `1px solid var(--border-default)` | `var(--bg-surface-1)` | none | 16px |
| Energy source badge | 6px | none | energy color at 10% opacity | none | 8px 12px |
| Chart container | 12px | `1px solid var(--border-default)` | `var(--bg-surface-1)` | none | 20px (header), 16px (chart area) |
| Modal/dialog | 12px | `1px solid var(--border-default)` | `var(--bg-surface-2)` | `0 16px 64px rgba(0,0,0,0.4)` | 24px |
| AI chat panel | 0 (full-height panel) | left border: `1px solid var(--border-default)` | `var(--bg-surface-1)` | none | 16px |

**Key principle from Vercel's dark mode:** replace traditional box-shadows with `0 0 0 1px var(--border-default)` ring shadows. This creates the signature flat, crisp aesthetic. In light mode, use subtle traditional shadows.

### Metric card anatomy

```
┌─────────────────────────────┐
│  ☀ Solar Production         │  ← 12px label, uppercase, --text-secondary
│                             │
│  4.7 kW                    │  ← 20px Geist Mono, --text-primary, energy color
│  ▲ 12% vs yesterday        │  ← 12px, success/error color
│                             │
│  ████████░░  18.2 kWh today │  ← mini progress bar + daily total
└─────────────────────────────┘
```

---

## Energy flow visualization (the hero component)

This is the dashboard's centerpiece, modeled on **Tesla's hub-and-spoke power flow diagram** with animated colored flow lines.

### Layout topology

The home/load node sits at center. Energy sources (solar, wind, grid) radiate from the top and sides. Battery connects below or to the side. Each node is an **icon + power readout + status label**, connected by curved SVG paths.

```
         [Solar ☀]        [Wind 🌀]
          4.7 kW           1.2 kW
            \               /
             \             /
              ─── [Home 🏠] ───── [Grid ⚡]
                  5.1 kW          0.0 kW
                    |
                 [Battery 🔋]
                  68%  -0.8 kW
                  Charging
```

### Animated flow lines specification

Each energy path is an SVG `<path>` with animated particles (small circles or dashes) moving along it. The animation speed correlates with power magnitude — **faster dots mean more power flowing**. This is Tesla's exact approach, post-v4.18.0.

```css
/* Flow particle animation */
@keyframes flowParticle {
  0% { offset-distance: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}

.flow-particle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  offset-path: path('M 100 50 C 200 50 200 150 300 150'); /* source→dest curve */
  animation: flowParticle var(--flow-duration) linear infinite;
  background: var(--source-color);
  box-shadow: 0 0 8px var(--source-glow);
}
```

**`--flow-duration` mapping:** 0 kW = no animation, 0.1–1 kW = 4s, 1–3 kW = 2.5s, 3–5 kW = 1.5s, 5+ kW = 0.8s. Spawn **3–6 particles per path** staggered with `animation-delay`.

Each flow line is colored with the **source's energy color** (solar yellow, wind teal, grid gray, battery green). When multiple sources feed the home simultaneously, all flow paths animate independently — exactly as Tesla implemented.

### Node component specification

Each node in the flow diagram:
- **Icon**: 48px, using a simple line-style SVG icon
- **Power value**: Geist Mono, 20px, weight 500, in the source's energy color
- **Status label**: Geist Sans, 12px, uppercase, `--text-secondary`
- **Node container**: 96px wide, centered text, no visible border (minimal chrome, per Tesla)
- **Battery node special**: includes a fill-level gauge (rounded rect that fills from bottom proportional to SoC %)

### Build recommendation

Use **D3.js** or **React Flow** for the node-and-edge layout. For simpler implementation, use **SVG with CSS offset-path animations** (no library needed). The `tesla-style-solar-power-card` open-source project on GitHub is a direct reference for implementing this visualization pattern.

---

## Time-series charts and data visualization

### Chart library recommendation

Use **Recharts** (React) or **Chart.js** with careful custom styling. For maximum polish, **Tremor** (tremor.so) provides pre-built React chart components designed for dashboards with a Tailwind-based dark mode that closely matches Vercel's aesthetic.

### Chart styling specification

| Property | Value |
|----------|-------|
| Chart background | transparent (inherits card bg) |
| Grid lines | `rgba(255,255,255,0.06)` horizontal only, no vertical |
| Axis label color | `--text-tertiary` (#666) |
| Axis label font | Geist Mono, 12px |
| Tooltip background | `var(--bg-surface-2)` with `1px solid var(--border-default)` |
| Tooltip border-radius | 8px |
| Tooltip shadow | `0 4px 12px rgba(0,0,0,0.3)` |
| Line stroke width | 2px |
| Area fill opacity | 0.15 |
| Cursor/crosshair | `rgba(255,255,255,0.2)` vertical line |
| Animation on load | 400ms ease-out, draws from left to right |

### Stacked area chart (day view, Tesla pattern)

For the daily power view, use a **stacked area chart** with the energy semantic colors. X-axis shows hours (00:00–24:00, labeled every 4h). Y-axis shows kW, auto-scaled. Positive values above baseline represent consumption by source, negative values represent export or battery charging. Tesla uses this exact pattern.

**Scrubber interaction:** On hover/touch-hold, display a vertical crosshair with a tooltip showing exact values for each source at that timestamp plus the aggregate total. This mirrors Tesla's tap-and-scrub UX.

### Bar chart (week/month/year views)

Switch to vertical bars for longer timescales. Each bar is segmented by source color. Include a subtle `border-radius: 3px 3px 0 0` on bar tops (Vercel's chart style).

### Trend line treatment

Apply Vercel's **polynomial regression curve fitting** for smooth trend visualization rather than noisy point-to-point connections. Calculate deltas from the regression curve, not raw endpoints — this produces more meaningful "12% increase" metrics.

---

## AI chat panel specification

The right-side AI analysis panel combines OpenAI's chat interface patterns with Anthropic's artifacts approach.

### Panel layout

| Property | Value |
|----------|-------|
| Panel width | 380px |
| Header height | 48px (title + collapse button) |
| Message area | flex: 1, overflow-y: auto, padding: 16px |
| Input area | bottom-fixed, padding: 12px |
| Input border-radius | 16px (Anthropic's rounded composer) |
| Input background | `var(--bg-surface-2)` |
| Input border | `1px solid var(--border-default)` |
| Max content width | 100% (no max-width constraint inside panel) |

### Message styling

**AI messages:** Left-aligned, no bubble background (OpenAI's current full-width pattern). Use `--text-primary` color. Support markdown rendering with Geist Sans for prose and Geist Mono for code blocks.

**User messages:** Right-aligned with a subtle background pill of `var(--bg-surface-2)`, border-radius 16px, padding 12px 16px. This distinguishes user input from AI responses.

**Code blocks within chat:** Background `var(--bg-base)` (#000), border-radius 8px, padding 16px, with syntax highlighting. Header bar showing language name and copy button.

### Streaming text animation (OpenAI pattern)

Tokens appear word-by-word via Server-Sent Events. A blinking cursor (`#4ADE80` — battery green, tying to the "AI is alive" metaphor) appears at the end of streaming text:

```css
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: #4ADE80;
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}
```

### Suggested prompts

Pre-populate with energy-relevant suggestions: "Why did my energy consumption spike at 6pm?", "Optimize my battery charge schedule", "Compare this week vs last week". Display as pill-shaped buttons: border-radius 20px, border `1px solid var(--border-default)`, padding 8px 16px.

---

## Animation and motion specification

### Global transition defaults

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);  /* Material standard */
  --ease-out: cubic-bezier(0.0, 0, 0.2, 1);       /* Deceleration */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);    /* Standard */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* Slight overshoot */
}
```

### Specific interactions

| Interaction | Duration | Easing | Transform |
|-------------|----------|--------|-----------|
| Button hover | 150ms | ease-default | background-color transition |
| Button press | 100ms | ease-out | `scale(0.98)` (Anthropic's tactile pattern) |
| Card hover | 200ms | ease-default | border-color lightens to `#444` |
| Sidebar collapse | 300ms | ease-out | width transition |
| AI panel open/close | 300ms | ease-out | width + opacity |
| Chart data load | 400ms | ease-out | opacity 0→1 + draw from left |
| Page/view transition | 200ms | ease-default | opacity cross-fade |
| Modal open | 200ms | ease-spring | scale(0.95)→scale(1) + opacity |
| Tooltip appear | 150ms | ease-out | opacity + translateY(-4px) |
| Energy flow particles | variable | linear | offset-distance along SVG path |
| Real-time value update | 300ms | ease-out | number counter animation |
| Loading skeleton | 1.5s | ease-in-out | shimmer gradient sweep |

### Optimistic UI (Linear's core pattern)

When users toggle settings or change configurations, **update the UI immediately** before server confirmation. Roll back only on error. This eliminates perceived latency and makes the dashboard feel instant. Critical for settings like battery reserve level or charge schedule — the slider should respond with zero delay.

---

## Dark mode implementation

Dark mode should be the **default** (following Linear and Tesla for energy dashboards — dark backgrounds make colored energy flow lines and chart data pop).

### Implementation approach

Use CSS custom properties toggled via a class on `<html>`:

```css
html[data-theme="dark"] {
  --bg-base: #000000;
  --bg-surface-1: #111111;
  --bg-surface-2: #171717;
  --bg-surface-3: #1F1F1F;
  --border-default: #333333;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --text-primary: #FAFAFA;
  --text-secondary: #888888;
  --text-tertiary: #666666;
  --shadow-card: 0 0 0 1px #333333;  /* Vercel's ring shadow */
}

html[data-theme="light"] {
  --bg-base: #FFFFFF;
  --bg-surface-1: #FAFAFA;
  --bg-surface-2: #F5F5F5;
  --bg-surface-3: #EAEAEA;
  --border-default: #EAEAEA;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --text-primary: #171717;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08);
}
```

Support three modes: **Dark** (default), **Light**, and **System** (respects `prefers-color-scheme`). Energy semantic colors remain identical across both themes — the solar yellow, battery green, wind teal, and load blue work on both backgrounds because the color values were specifically selected for dual-background compatibility.

**Vercel's key insight applied here:** In dark mode, replace all `box-shadow` with `0 0 0 1px var(--border-default)` ring-style borders. This creates the flat, crisp, premium dark aesthetic. In light mode, use traditional subtle shadows.

---

## Putting it all together: the complete dashboard view

### Overview page (default landing)

The Overview page is the primary view. It shows at a glance: current energy flow (the animated hub-and-spoke diagram), battery state, summary metrics, and a mini time-series chart.

**Top section (hero):** Energy flow diagram, full width, 280–360px tall. Shows all sources flowing to/from home with animated colored particles. Each node displays real-time kW. Battery node shows SoC percentage with fill gauge.

**Middle section (metrics row):** 4 metric cards in a horizontal grid (`grid-template-columns: repeat(4, 1fr)`, gap 16px). Cards for: Solar Production (today kWh), Wind Generation (today kWh), Grid Import/Export (net kWh), Battery Cycles. Each card uses the relevant energy color for the primary number, with a delta comparison to yesterday.

**Bottom section (charts):** Full-width stacked area chart showing the last 24 hours. Timescale selector tabs (Day / Week / Month / Year) in the card header, right-aligned. Chart height 280px. Below the chart, an "Energy Flow" breakdown section (Tesla pattern) showing percentages: "72% Solar, 18% Wind, 10% Grid" as horizontal stacked bars.

### How each reference company contributes

The final design is not any single company's UI — it's a deliberate synthesis. **Vercel** provides the dark mode foundation, color token system, typography (Geist), and card/material system. **Linear** provides the sidebar navigation pattern, information density approach, keyboard-first interactions (Cmd+K), and animation timing. **Tesla** provides the energy flow visualization, color semantics for energy sources, progressive disclosure of data, and the stacked area chart pattern. **OpenAI** provides the streaming chat interface, markdown rendering in AI messages, and the message-list UX. **Anthropic** provides the side-panel pattern for the AI chat (analogous to their artifacts panel), the rounded input composer, warm interaction feedback (`scale(0.98)` on press), and the concept of the AI panel as a companion rather than a tool. **Cluely** reinforces the modern SaaS conventions — teal accent, bold geometric type, Tailwind-based architecture, and generous whitespace.

---

## Conclusion: from specification to implementation

This specification gives a developer everything needed to build. **Start with Tailwind CSS** (every referenced company uses it) configured with the custom color tokens and spacing scale above. Install Geist via npm. Set dark mode as default. Build the energy flow diagram first — it's the hero component that defines the product's identity. Use SVG with CSS `offset-path` animations for the flow particles. Implement the AI chat panel as a collapsible right panel with streaming text support.

Three non-obvious insights emerged from this research. First, **avoid pure black text on white or pure white text on black** — every premium product uses off-values (#FAFAFA on #000 in dark, #171717 on #FFF in light) to reduce eye strain. Second, **borders replace shadows in dark mode** — Vercel's `0 0 0 1px #333` pattern is the defining technique that makes dark dashboards look premium rather than muddy. Third, **animation speed encodes data** — Tesla's variable-speed flow particles that move faster for higher power draw is a genuinely brilliant way to convey magnitude at a glance without requiring users to read numbers. Implementing that single interaction will make this dashboard feel more intelligent than any amount of visual polish.