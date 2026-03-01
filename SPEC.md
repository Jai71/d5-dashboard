# D5 Smart Meter Companion Dashboard — Complete Specification

## Changelog

### Modified
- **Section 4.2 (Key Metrics Cards):** Updated from "five uniform cards" to match implementation: hero renewable %, three-card row (Total Energy, Battery Balance, Mains Dependency), and inline unmet demand. Battery Balance card now shows "Charge"/"Discharge" labels with conditional discharge colour. Unmet demand is 15px with AlertTriangle icon.
- **Section 4.4 (Simulation Time Display):** Updated to reflect that Tab 1 has full playback controls (scrubber, play/pause, speed, LIVE button), not just a time display bar.
- **Section 5.3 (Load Management Timeline):** Added hatched pattern for suspected rejected charge spans.
- **Section 5.6 (Playback Controls):** Removed claim that "playback controls only appear on Tab 2" — Tab 1 also has an independent playback bar.
- **Section 6.2 (Chat Interface):** Updated empty state description — no centred Brain icon; uses left-aligned text and text link prompts (not pill buttons).
- **Section 6.6 (Comparison Mode):** Marked as deferred per CLAUDE.md. Not implemented.
- **Section 10 (Technical Implementation):** Updated to reference Express proxy server for AI integration.
- **Section 12 (Files Required):** Updated "no server" statement to acknowledge Express proxy requirement.

---

## Document Purpose

This specification defines the companion web dashboard for the D5 Smart Electricity Meter, a university engineering project. The dashboard is presented separately from the test bed simulation as a standalone deliverable. It serves two functions: a development tool for iterating the meter's control algorithm, and a presentation piece demonstrating technical depth and data analysis capability to examiners.

---

## 1. Project Context

### 1.1 What the Smart Meter Does

The D5 Smart Meter manages a simulated micro grid. It receives sensor data about available energy sources and load demands, then makes real-time decisions about power allocation. The meter runs on an Il Matto 8-bit microcontroller with a 2.2" TFT display and must operate within a 2W power budget.

The micro grid contains four energy sources and three loads:

**Sources:** Mains (controllable, up to ~4A, always available but treated as last resort), Wind turbine (non-dispatchable, 0–1A, varies with conditions), PV/Solar array (non-dispatchable, 0–2A, follows daylight curve), and Battery discharge (dispatchable, 1A per simulated hour, drawn from stored charge).

**Loads:** Load 1 (0.8A demand), Load 2 (1.8A demand), Load 3 (1.4A demand), and Battery charge (requires 1A surplus current).

The control algorithm's job is to prioritise renewables over mains, serve loads when called, and manage battery cycling without violating the constraint that discharge time must never exceed charge time (violation caps marks at 40%).

### 1.2 What the Dashboard Does

The dashboard is a post-processing and live monitoring tool. It does NOT control the meter. It visualises the meter's inputs, outputs, and decision-making quality. During live Bluetooth connection, the dashboard is a passive wireless display — it receives telemetry from the meter but never sends commands back. This complies with the handbook rule that no external control communication is permitted during testing.

The dashboard accepts data from two sources: real-time streaming via Bluetooth (HC-06 over Web Serial API), and CSV file upload for post-test analysis. When Bluetooth disconnects, the dashboard retains all received data in memory and transitions to analysis mode.

### 1.3 Presentation Context

The dashboard is presented separately from the test bed simulation. Examiners will see it as a standalone piece of work. The typical demo flow is: load a pre-recorded dataset, walk through the analysis capabilities across all tabs, demonstrate the AI analysis with a live query, and optionally show the Bluetooth connection with the Il Matto powered independently.

Once the final scenario is published, the demo narrative should align with its evaluation criteria — lead with whichever metrics the scenario prioritises.

---

## 2. Data Architecture

### 2.1 Smart Meter I/O Signals

The meter reads 7 input signals and produces 6 functional outputs (1 analogue mains request measured as a differential voltage, and 5 digital switches). The analogue output uses two pins (#1_1 and #1_2) but represents a single controllable value. Every functional signal in this list is visualised by the dashboard.

**Inputs (Test Bed → Smart Meter):**

| Signal | Port | Pin | Type | Range | Meaning |
|--------|------|-----|------|-------|---------|
| Busbar Voltage | 2 | 3 (#2_1) | Analogue, 50Hz AC | ±4V | Grid bus voltage, V_bus ≈ 100 × V_signal |
| Busbar Current | 2 | 6 (#2_2) | Analogue, 50Hz AC | ±10V | Total busbar current, 1V ≈ 1A |
| Wind Capacity | 2 | 1 (#2_3) | Analogue, DC | 0–5V | Available wind power, 1V ≈ 1A rms |
| PV Capacity | 2 | 4 (#2_4) | Analogue, DC | 0–5V | Available solar power, 1V ≈ 1A rms |
| Call for Load 1 | 4 | 3 (#4_1) | Digital, TTL 5V | HIGH/LOW | Test bed requests Load 1 |
| Call for Load 2 | 4 | 6 (#4_2) | Digital, TTL 5V | HIGH/LOW | Test bed requests Load 2 |
| Call for Load 3 | 4 | 1 (#4_3) | Digital, TTL 5V | HIGH/LOW | Test bed requests Load 3 |

*Ground reference pins required for physical wiring but carrying no data for the dashboard: #2_5 Pin 5 (analogue ground for Port 2) and #4_4 Pin 4 (digital ground for Port 4). All test bed ground connections are internally common. Pin numbers follow the T568B wiring standard for RJ45 cables.*

**Outputs (Smart Meter → Test Bed):**

| Signal | Port | Pin | Type | Range | Meaning |
|--------|------|-----|------|-------|---------|
| Mains Request | 1 | 3 (#1_1) | Analogue, DC | 0–10V | I_mains,rms = (V_#1_1 − V_#1_2) / 10 × I_mains,rms_max. 0V = no mains, 10V = full mains. This is a DC control signal that sets the RMS current the test bed delivers on the AC busbar. |
| Mains Ground Ref | 1 | 6 (#1_2) | Analogue, DC | Reference | Ground reference for mains capacity differential measurement |
| Charge Battery | 3 | 3 (#3_1) | Digital, TTL 5V | HIGH/LOW | Start/stop battery charging |
| Discharge Battery | 3 | 6 (#3_2) | Digital, TTL 5V | HIGH/LOW | Start/stop battery discharging |
| Load 1 Switch | 3 | 1 (#3_3) | Digital, TTL 5V | HIGH/LOW | Connect/disconnect Load 1 |
| Load 2 Switch | 3 | 4 (#3_4) | Digital, TTL 5V | HIGH/LOW | Connect/disconnect Load 2 |
| Load 3 Switch | 3 | 5 (#3_5) | Digital, TTL 5V | HIGH/LOW | Connect/disconnect Load 3 |

*Ground reference pin required for physical wiring but carrying no data for the dashboard: #3_6 Pin 2 (digital ground for Port 3). Note: #1_2 listed above also serves as the analogue ground reference for the mains capacity measurement. Pin numbers follow T568B.*

**Derived values computed by the Il Matto (not from test bed):** Battery state of charge (SoC) in amp-hours, computed by tracking cumulative charge and discharge time at the 1A rate. Total energy consumed, computed from busbar current and voltage integration. These derived values are transmitted over Bluetooth alongside the raw I/O signals.

### 2.2 Bluetooth Data Path (Live Mode)

The Il Matto transmits telemetry over UART to an HC-06 classic Bluetooth module. The HC-06 pairs with the laptop, creating a virtual COM port. The dashboard connects to this COM port using the Web Serial API (not Web Bluetooth, which only supports BLE).

**Connection sequence:** User pairs HC-06 with laptop OS → opens dashboard → clicks "Connect" → Web Serial API port picker appears → user selects the HC-06 COM port → dashboard begins parsing incoming data.

**Packet format at 9600 baud:** The Il Matto sends a comma-separated ASCII string terminated by newline at a regular interval (recommended 500ms):

```
$,<wind>,<pv>,<vbus_rms>,<ibus_rms>,<cl1>,<cl2>,<cl3>,<mains_request>,<ls1>,<ls2>,<ls3>,<bchg>,<bdis>,<soc>\n
```

| Position | Field | Type | Unit |
|----------|-------|------|------|
| 0 | Header | `$` | Start marker |
| 1 | Wind capacity | Float | Amps |
| 2 | PV capacity | Float | Amps |
| 3 | Busbar voltage RMS | Float | Volts |
| 4 | Busbar current RMS | Float | Amps |
| 5 | Call for Load 1 | 0 or 1 | Boolean |
| 6 | Call for Load 2 | 0 or 1 | Boolean |
| 7 | Call for Load 3 | 0 or 1 | Boolean |
| 8 | Mains request voltage | Float | 0–10V |
| 9 | Load 1 switch | 0 or 1 | Boolean |
| 10 | Load 2 switch | 0 or 1 | Boolean |
| 11 | Load 3 switch | 0 or 1 | Boolean |
| 12 | Battery charge | 0 or 1 | Boolean |
| 13 | Battery discharge | 0 or 1 | Boolean |
| 14 | Battery SoC | Float | Amp-hours (Ah) |

The dashboard parses each line, splits by comma, and maps by fixed position. Both sender (Il Matto firmware) and receiver (dashboard parser) are written by the same team, so there is zero ambiguity in the protocol.

**Mains value conversion:** The Bluetooth packet transmits the mains request as a raw DC voltage (0–10V, position 8), but the dashboard displays mains as RMS current in amps. The conversion happens dashboard-side using the formula: `I_mains,rms = (V_packet / 10) × I_mains,rms_max`, where `I_mains,rms_max` is the Max Mains Capacity value from the Settings tab (default 4.0A). If the settings value is changed, the displayed mains current scales accordingly.

**Il Matto firmware addition required:** A UART transmit function (~20–30 lines of C) that packages all current ADC readings and digital pin states into the packet format above. This is a telemetry reporter bolted onto the existing control algorithm — it does not modify the control logic itself.

**One-way communication only.** The dashboard must never send data back to the meter. The wiring is: Il Matto UART TX → HC-06 RX (the HC-06 receives serial data from the meter and transmits it wirelessly to the laptop). The return path — HC-06 TX → Il Matto RX — should be left disconnected or ignored in firmware to ensure no data flows back to the meter. This satisfies the handbook requirement that no external control communication is permitted during testing.

### 2.3 CSV Data Path (Analysis Mode)

The LabVIEW test bed produces a .tdms file containing 10 data channels. The handbook's example output (Figure 13) shows a file with 729,600 rows at a 0.0005s sampling interval — this corresponds to approximately 6 minutes of recording, likely a shorter development profile rather than the full final review. The final review runs for 24 minutes; at 0.0005s intervals this would produce approximately 2,880,000 rows. The actual row count and interval of the final review file should be confirmed from a real test run. The dashboard does NOT parse .tdms files directly. The user exports to CSV via Excel, then uploads to the dashboard.

**Pipeline:** LabVIEW test → .tdms file → open in Excel → save as CSV → upload to dashboard.

**Column mapping challenge:** The .tdms channel names are generic (DC, DC 1, DC 2, DC (), etc.), but the file's Description metadata field does contain signal names — the handbook's Figure 13 visibly shows entries beginning with "Wind Capacity (A rms)" and "PV Ca..." (truncated in the screenshot). These descriptions should resolve most or all of the mapping when the file is opened in Excel. As a fallback, the dashboard also provides a manual column assignment screen during upload: it displays all CSV column headers and lets the user assign each to a signal. Once a mapping is confirmed from a real test file, it can be saved as the default for future uploads.

**Simulated data for development/demo:** Before real test bed data is available, the dashboard generates a realistic 24-hour simulation profile with PV following a daylight bell curve (0A at night, peaking ~2A at noon), wind varying semi-randomly (0–1A), load calls following time-of-day patterns, and a simple algorithm simulation making source allocation decisions. This allows dashboard development and demo without requiring test bed access.

### 2.4 Simulated Time Mapping

The test bed runs 24 minutes = 24 simulated hours. Each real minute equals one simulated hour. The dashboard converts data position to simulated time and displays it in HH:MM format with the label "Simulated Time." During live Bluetooth mode, simulated time is derived from the packet count and known transmission interval. During CSV playback, it maps directly to the scrubber position.

---

## 3. Navigation Structure

The dashboard uses a four-tab layout. Each tab has a single clear purpose with no functional overlap.

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | Live Monitor | Real-time operational view during Bluetooth streaming |
| 2 | Analytics | Deep time-series analysis with playback controls |
| 3 | AI Insights | Algorithm advisor, natural language queries, report generation |
| 4 | Settings & Data | Configuration, Bluetooth management, CSV import/export, raw data |

A fixed header sits above the tabs containing the team name/logo, a live/offline status badge (glowing green dot with "LIVE" when streaming, grey with "OFFLINE" when disconnected), and a Bluetooth connect/disconnect button.

---

## 4. Tab 1 — Live Monitor

This is the operational view. Everything a user needs when the meter is running and streaming via Bluetooth. When Bluetooth is disconnected, this tab shows the last received state frozen with an "OFFLINE" indicator.

### 4.1 Energy Flow Diagram (Hero Component)

A hub-and-spoke SVG diagram occupying the top of the tab. This is the visual centrepiece of the entire dashboard and the first thing shown during a presentation.

**Layout topology:**

Sources sit on the left side: PV/Solar at top-left, Wind at bottom-left, Mains at lower priority positioning (not dominant top-centre). Battery sits between sources and the central busbar. The busbar is represented as a central circle — the physical distribution point where all power converges. Loads sit on the right side: Load 1 top-right, Load 2 middle-right, Load 3 bottom-right.

**Animated flow particles:** Small circles (6px diameter) travel along curved SVG paths between nodes. Each path is coloured with the source's semantic colour. Particle speed encodes power magnitude: more current = faster particles. This is the single most impactful visual element — it communicates power flow at a glance without requiring the viewer to read numbers.

**Speed mapping:** 0A = no animation (path shown as dashed grey line). 0.1–1A = 4s particle travel time. 1–3A = 2.5s. 3–5A = 1.5s. 5A+ = 0.8s. Spawn 3–6 particles per path, staggered with animation delay.

**Flow direction:** Particles always flow from source toward busbar (energy being supplied) or from busbar toward loads (energy being consumed). Battery charging: particles flow busbar → battery. Battery discharging: particles flow battery → busbar. The direction reversal on the battery path is meaningful and must be correct.

**Node components:** Each node displays an icon (from lucide-react), a power reading in monospace font with the source's semantic colour, and a status label in uppercase secondary text. The battery node additionally has a fill-level gauge (a small vertical rectangle that fills proportionally to SoC relative to the reference battery capacity configured in Settings, coloured green above 20% of reference, red below 20%) and a numeric Ah value displayed alongside.

**Busbar centre node:** Displays two values — busbar voltage RMS and busbar current RMS. These come directly from port 2 readings. The busbar is shown as a circle, not a rectangle, to differentiate it from source/load nodes.

**Load node states (four possible):**

| Call Signal | Switch Signal | Visual Treatment | Label |
|-------------|--------------|------------------|-------|
| LOW | LOW | Grey fill, grey border, no particles | OFF |
| HIGH | HIGH | Blue-tinted fill, blue border, active blue particles | ON |
| HIGH | LOW | No fill, yellow dashed border (2px, 4-2 dasharray), no particles | CALLING |
| LOW | HIGH | Should not occur — flag as error if detected | ERROR |

The "CALLING" state is visually urgent: the dashed yellow border draws attention to the fact that demand exists but is unmet. This is one of the most important states to surface because unmet demand directly affects the algorithm's evaluation score.

### 4.2 Key Metrics Display

Below the energy flow diagram, the metrics are arranged in three rows
with visual hierarchy, not five uniform cards. See CLAUDE.md Section 6
Pass 2 for authoritative visual treatment.

**Row 1 — Hero Renewable %:** Full-width, no card. 52px monospace green
value with "RENEWABLE" label.

**Row 2 — Three-card grid:**

| Card | Value Source | Colour | Notes |
|------|-------------|--------|-------|
| Total Energy (Load) | Sum of active load currents × busbar voltage over time (kWh) | White | Handbook requires energy consumption measurement in kWh. |
| Battery Balance | Charge minutes vs discharge minutes | Green bar (charge), conditional discharge bar: white 40% opacity when safe, red when violation | "Charge"/"Discharge" labels, minute counts, "40% CAP RISK" if violation. |
| Mains Dependency | mains / (wind + PV + mains) × 100 | Mains grey | Inverse of renewable %. |

**Row 3 — Unmet Demand inline:** 15px monospace with `AlertTriangle`
icon when > 0. Amber when unmet demand exists, muted when zero. No card.

When the final scenario is published, these metrics may be swapped in the code to match the evaluation criteria (e.g., replacing Renewable % with Total Cost for a cost minimisation scenario). See Section 7.1.

### 4.3 Notification Alerts

Toast notifications appear for significant events during live monitoring. Each notification has a coloured left accent, an icon, message text, and a dismiss button. Notifications auto-dismiss after 5 seconds.

**Notification triggers:**

| Event | Type | Message |
|-------|------|---------|
| Load calling but not switched on | Warning (amber) | "Load N calling — not yet switched on" |
| Battery SoC below 1 Ah | Error (red) | "Battery below 1 Ah" |
| High PV available but mains active | Info (blue) | "High PV available but mains still drawing" |
| Battery fully discharged | Error (red) | "Battery fully discharged" |
| Charge and discharge both HIGH | Error (red) | "ERROR: Simultaneous charge and discharge" |
| Mains request at maximum | Warning (amber) | "Mains request at maximum (4A)" |

**Important context for notifications:** The handbook prohibits external control during testing. The user cannot act on notifications during a live test bed run. These alerts are useful during informal bench testing (Il Matto powered independently, not on test bed), and during presentations to show the dashboard's monitoring intelligence.

### 4.4 Tab 1 Playback Bar

A sticky bar at the bottom of Tab 1 containing full playback controls:
skip-to-start, play/pause (circular blue button), skip-to-end, timeline
scrubber (0–24h), HH:MM time display (monospace), speed selector
(1x/2x/5x/10x), a LIVE button that re-pins to the latest data point
(green pulsing dot when active), and a data point count.

Tab 1's playback bar is independent of Tab 2's — each tab has its own
`usePlayback` instance. When in LIVE mode, the scrubber pins to the
end; interacting with playback controls exits LIVE mode.

---

## 5. Tab 2 — Analytics

This is the deep analysis tab. All time-series charts, detailed breakdowns, and the playback scrubber live here. This tab is used when reviewing a completed test run, scrubbing through the 24-hour simulation, and understanding what happened at specific moments.

### 5.1 Source Breakdown — Stacked Area Chart

A full-width stacked area chart showing the entire simulation timeline. X-axis: simulated time (HH:MM, labelled every 2–4 hours). Y-axis: current in amps, auto-scaled. Three stacked areas in source-semantic colours:

| Layer (bottom to top) | Colour | Represents |
|-----------------------|--------|------------|
| Mains | Grey (#888888 stroke, 15% opacity fill) | Current drawn from mains |
| Wind | Teal (#50E3C2 stroke, 15% opacity fill) | Current available from wind |
| Solar/PV | Amber (#F5A623 stroke, 15% opacity fill) | Current available from PV |

A dashed white line overlaid shows total load demand at each point, allowing direct visual comparison of supply versus demand. Where the stacked area exceeds the demand line, there is surplus (potential battery charging). Where demand exceeds supply, the gap is deficit (requiring mains or battery discharge).

**Interaction:** Hovering shows a vertical crosshair with a tooltip displaying exact values for each source and total demand at that timestamp.

### 5.2 Source Breakdown — Donut Chart

Adjacent to or below the stacked area chart, a donut chart shows cumulative energy contribution from each source across the entire dataset as percentages. The centre of the donut displays total energy in kWh (consistent with the Total Energy metric card). This chart updates as the playback position advances in scrubbing mode.

### 5.3 Load Management Timeline

A horizontal Gantt-style chart with four rows:

| Row | Colour (Call Signal) | Colour (Switch Signal) | What It Shows |
|-----|---------------------|----------------------|---------------|
| Load 1 (0.8A) | Amber 30% opacity | Blue 50% opacity | Call vs switch timing |
| Load 2 (1.8A) | Amber 30% opacity | Blue 50% opacity | Call vs switch timing |
| Load 3 (1.4A) | Amber 30% opacity | Blue 50% opacity | Call vs switch timing |
| Battery | Green 40% opacity (charging) | Purple 40% opacity (discharging) | Charge/discharge activity |

Suspected rejected charge spans (see Section 9.1) are overlaid on the
battery row with a hatched pattern
(`repeating-linear-gradient(45deg, #4ADE80 0 4px, transparent 4px 8px)`).

A white vertical line tracks the current playback position. The gap between an amber segment starting and a blue segment starting is the algorithm's response delay. Amber segments without overlapping blue indicate unmet demand — the test bed called for a load but the algorithm didn't serve it.

**Legend:** Positioned below the timeline with coloured indicators for each state.

### 5.4 Battery Monitor

Two components side by side.

**Battery SoC Timeline (left, larger):** An area chart showing state of charge in amp-hours over the full simulation. Y-axis auto-scales to the data range (typically 0–10 Ah for a well-managed run). The line rises during charge periods and falls during discharge. Green fill at 15% opacity. A horizontal dashed line marks the configured reference battery capacity for visual context. This directly shows battery cycling patterns and whether the algorithm is accumulating or depleting charge over time.

**Safety Check Panel (right, 200px wide):** A prominent pass/fail indicator for the charge-versus-discharge rule.

If charge time ≥ discharge time: green CheckCircle icon (32px), "BALANCE OK" text in green, and the ratio displayed below ("Xm chg / Ym dis"). Border is default.

If discharge time > charge time: red AlertTriangle icon (32px), "DISCHARGE > CHARGE" text in red, "40% mark cap risk" subtext. Border turns red. This is the single most important safety indicator in the entire dashboard.

### 5.5 Busbar Health

A collapsible panel (using HTML `<details>`, starts collapsed). Expanding reveals a dual-axis line chart:

Left Y-axis: Busbar voltage RMS (pink #F472B6 line). Right Y-axis: Busbar current RMS (indigo #818CF8 line). X-axis: simulated time.

This panel is intentionally downgraded from a full section to a collapsible because busbar values in the controlled test bed simulation are relatively stable — this is a sanity-check tool, not a primary analysis view. However, it exists and can be expanded during a presentation if an examiner asks about busbar monitoring.

### 5.6 Playback Controls

A sticky bar at the bottom of Tab 2 containing:

| Control | Function |
|---------|----------|
| Skip-to-start button | Jump to time 00:00 |
| Play/Pause button | Circular blue button, toggles playback |
| Skip-to-end button | Jump to time 24:00 |
| Timeline scrubber | Range input spanning full dataset, draggable |
| Time display | Current position in HH:MM monospace |
| Speed selector | Four buttons: 1x, 2x, 5x, 10x playback speed |

All charts, the energy flow diagram (if visible), and the white position markers on the load timeline synchronise to the scrubber position. At 10x speed, the 24-minute recording plays through in approximately 2.4 minutes.

Both Tab 1 and Tab 2 have independent playback bars. Tab 1's playback
bar additionally includes a LIVE button to re-pin to the latest data
point. Each tab's playback is independent and does not affect the other.

---

## 6. Tab 3 — AI Insights

This tab contains all AI-powered analysis features. It is a separate tab because AI analysis is a distinct workflow — the user triggers an analysis, reads results, and asks follow-up questions. Mixing this into the chart views would create visual noise.

### 6.1 Quick Action Buttons

A row of pill-shaped buttons at the top of the tab for common AI tasks:

| Button | Label | What It Does |
|--------|-------|-------------|
| Primary (purple accent) | 🔍 Analyze Performance | Sends full dataset to AI for comprehensive algorithm assessment |
| Secondary | 📄 Report Summary | Requests a concise technical paragraph for the final project report |
| Secondary | ⚡ Battery Analysis | Focuses AI analysis on charge/discharge patterns and safety |

Clicking a quick action button populates the input field with a detailed prompt and can auto-send.

### 6.2 Chat Interface

A full-height scrollable message area with the standard chat pattern:

**User messages:** Right-aligned, pill-shaped background (surface-2 colour), 14px rounded corners, 9–14px padding.

**AI messages:** Left-aligned, no background (full-width text), monospace for any data values, markdown rendering for structure. Pre-wrap whitespace for formatted AI output.

**Empty state:** When no messages exist, the chat area shows left-aligned
text: "Ask about the algorithm's performance." in `#888888` 13px.
Below, five suggested prompts as text links (not pills, not centred):

- "What was peak mains draw and when?"
- "How many times was load 2 not served?"
- "Compare renewable usage day vs night"
- "Was battery cycling efficient?"
- "Where could the algorithm improve?"

Clicking a prompt populates the input field (does not auto-send).
See CLAUDE.md Section 3 for authoritative empty state styling.

### 6.3 AI System Prompt and Data Context

Each AI request sends the following context to the LLM:

**System prompt contents:** The system identity ("AI engine for D5 Smart Meter dashboard"), all system configuration values (max capacities, load demands, battery rate), the key rules (discharge must not exceed charge, serve loads when called), a plain-text description of the active scenario and its evaluation criteria (updated once when the final scenario is published — see Section 7.1), current session metrics (total energy, renewable %, mains dependency, battery balance, unmet demand), and sampled data points (48 evenly spaced points across the dataset, each containing hour, PV, wind, mains, SoC, all load calls and switches, battery charge/discharge state).

The scenario description in the system prompt is what makes the AI evaluate against the right target. Under renewable optimisation it advises "prioritise renewables over mains." Under cost minimisation it advises "use the cheapest source at each time step." This is a string in the code, not a UI element.

**Conversation history:** The last 6 messages are included for context continuity.

**Model:** Defined in CLAUDE.md. Max tokens: 1000 per response.

### 6.4 AI Analysis Output Format

The AI is instructed to be concise, technical, and specific. It references exact timestamps and values. It evaluates the algorithm against the active scenario's optimisation target as described in the system prompt. For a full performance analysis, the expected output structure is:

- Overall assessment (1–2 sentences)
- Key strengths identified in the algorithm
- Specific issues with timestamps (e.g., "Between 08:00–10:00, PV averaged 1.8A but mains request remained above 2A — renewable energy was underutilised")
- Concrete recommendations for algorithm improvement
- Battery safety assessment

### 6.5 AI Report Generator

When triggered, generates a technical paragraph suitable for the group's final 5,000-word report. This is a starting point for report writing, not a replacement. The output describes the test run factually: what scenario was run, key metrics achieved, notable events, and areas where the algorithm performed well or poorly.

### 6.6 Comparison Mode (Deferred)

**Status: Not implemented.** Per CLAUDE.md, comparison mode is deferred.
Build for a single dataset only. No second data slot or comparison UI
has been implemented.

Original design: When two datasets are loaded (two CSV uploads or a
live session plus a CSV), the AI could compare them. May be revisited
in a future milestone.

---

## 7. Tab 4 — Settings & Data

All configuration, data management, and plumbing that supports the other tabs.

### 7.1 Scenario Configuration

The final review evaluates the smart meter against a specific scenario published in advance — possible targets include cost minimisation, factory profitability, customer satisfaction, or renewable optimisation. The scenario defines what "good performance" means and how meters are competitively ranked.

The dashboard handles this with a simple text-based configuration block where the team enters the scenario parameters once they are published. This is not a dynamic UI with dropdowns and sliders — it is a one-time update before the final review.

**What gets updated when the scenario is published:**

- The metric cards on Tab 1 are adjusted to show the metrics relevant to the scenario (e.g., Total Cost and Cost/kWh for a cost scenario instead of Renewable % and Mains Dependency). This is a code change, not a runtime toggle.
- The AI system prompt (Section 6.3) is updated with a plain-text description of the scenario, any cost rates or revenue values, and the evaluation criteria. The AI then evaluates the algorithm against the correct target.
- The metrics calculation (Section 11) is extended with whatever formulas the scenario requires (e.g., energy cost = mains current × voltage × time × cost rate).

**What does NOT need to change:** The energy flow diagram, load timeline, battery monitor, playback controls, Bluetooth connection, CSV import/export, and raw data table are all scenario-agnostic. They show what happened — the scenario only affects how the dashboard interprets whether what happened was good or bad.

### 7.2 System Configuration

A grid of number input fields for system parameters. These values feed into metric calculations and AI context. Defaults match the handbook's test values. Note: the handbook warns that these values are starting points for testing and may vary in the final review — the algorithm (and therefore the dashboard configuration) must respond to actual values, not assume defaults.

| Parameter | Default | Unit | Range |
|-----------|---------|------|-------|
| Max Wind Capacity | 1.0 | A | 0–5 |
| Max PV Capacity | 2.0 | A | 0–5 |
| Max Mains Capacity | 4.0 | A | 0–10 |
| Battery Charge/Discharge Rate | 1.0 | A | 0–5 |
| Reference Battery Capacity | 10.0 | Ah | 1–50 |
| Load 1 Demand | 0.8 | A | 0–5 |
| Load 2 Demand | 1.8 | A | 0–5 |
| Load 3 Demand | 1.4 | A | 0–5 |

Note: Reference Battery Capacity is a dashboard display convention, not a hardware parameter. The handbook's battery has unlimited capacity. This value sets the fill gauge's visual scale and the threshold colours on the SoC chart. A default of 10 Ah is reasonable for a 24-hour simulation where the battery realistically charges for 8–12 hours total.

### 7.3 Data Import

A drag-and-drop zone for CSV upload. On upload, the dashboard either auto-maps columns (if the format matches a known template) or presents a column assignment interface where the user maps each CSV header to a signal name.

### 7.4 Data Export

A button that exports the current session's data (whether from live Bluetooth capture or simulated profile) as a CSV file. Column headers match the Bluetooth packet format for consistency.

### 7.5 Bluetooth Connection Management

Displays the expected packet format as a monospace code block for reference. Shows a Connect/Disconnect button. Includes a brief instruction: "Pair the HC-06 with your laptop first. Click Connect to open the Web Serial port selector. Expected format: 9600 baud, comma-separated ASCII."

### 7.6 Raw Data Table

A collapsible table (HTML `<details>`, starts collapsed) showing the underlying data values for the region around the current playback position. Columns for all 15 data fields (time, PV, wind, mains, busbar V, busbar I, 3× call, 3× switch, charge, discharge, SoC). Values are colour-coded with their semantic colours. Shows approximately 15–20 rows centred on the current position.

---

## 8. Design System

### 8.1 Colour Tokens

**Foundation (dark mode, default):**

| Token | Hex | Usage |
|-------|-----|-------|
| Background base | #000000 | Page background |
| Surface 1 | #111111 | Card backgrounds |
| Surface 2 | #171717 | Elevated surfaces, input fields |
| Surface 3 | #1F1F1F | Hover states |
| Border default | #333333 | Card borders, dividers |
| Border subtle | rgba(255,255,255,0.06) | Row separators |
| Text primary | #FAFAFA | Headings, values |
| Text secondary | #888888 | Labels, meta text |
| Text tertiary | #666666 | Disabled, placeholders |
| Text muted | #444444 | Inactive elements |

**Energy semantic colours (consistent across light/dark):**

| Source | Stroke | Fill (15% opacity) | Glow (30% opacity) |
|--------|--------|-------------------|-------------------|
| Solar/PV | #F5A623 (amber) | rgba(245,166,35,0.15) | rgba(245,166,35,0.3) |
| Wind | #50E3C2 (teal) | rgba(80,227,194,0.15) | rgba(80,227,194,0.3) |
| Mains/Grid | #888888 (grey) | rgba(136,136,136,0.15) | rgba(136,136,136,0.3) |
| Battery | #4ADE80 (green) | rgba(74,222,128,0.15) | rgba(74,222,128,0.3) |
| Loads | #3291FF (blue) | rgba(50,145,255,0.15) | rgba(50,145,255,0.3) |

The grey colour for mains is intentional — it visually communicates that mains is the least desirable source compared to the vibrant colours of renewables.

**UI state colours:**

| State | Hex | Usage |
|-------|-----|-------|
| Accent | #0070F3 | Primary actions, focus rings, active tab |
| Error | #EE0000 | Errors, safety warnings |
| Warning | #F5A623 | Warnings (shares with solar, distinguished by context) |
| Info/AI | #7928CA | AI insights, analysis highlights |

### 8.2 Typography

Primary font: Inter (Google Fonts, variable weight). Fallback stack: -apple-system, system-ui, sans-serif.

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title | 14–15px | 600 | Dashboard header |
| Section label | 10–11px | 600 | Uppercase, 0.08em letter spacing |
| Card value | 20–24px | 600 | Monospace, energy semantic colour |
| Body text | 13px | 400 | Descriptions, explanations |
| Chart axis | 10–11px | 400 | Monospace |
| Notification text | 12px | 400 | Alert messages |
| Button text | 12–13px | 500 | Tab labels, actions |

All numerical values (power readings, percentages, timestamps) use monospace rendering for column alignment.

### 8.3 Card System

All content panels use the same card treatment: #111111 background, 1px solid #333333 border, 12px border radius, 20px padding. No box shadows in dark mode — borders replace shadows (Vercel's dark mode pattern). This creates a flat, crisp, premium aesthetic.

Section labels within cards: 10px, uppercase, 0.08em letter spacing, secondary text colour, 14–16px bottom margin.

### 8.4 Animation Timing

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Tab switch content | 300ms | ease-out (fadeIn + translateY 6px) |
| Button hover | 150ms | ease |
| Chart data load | 400ms | ease-out |
| Notification enter | 300ms | ease-out (slideIn translateX 16px) |
| Notification auto-dismiss | 5000ms | — |
| Flow particle travel | 0.8s–4s | linear (speed maps to power magnitude) |
| Live status pulse | 2s | ease-in-out infinite |
| Number value update | 300ms | ease-out |
| Playback scrubber | Immediate | — |

### 8.5 Scrollbar

Custom webkit scrollbar: 5px width, background matches page, thumb uses border colour (#333333), 3px border radius.

---

## 9. State Management

### 9.1 Battery States

The battery has three mutually exclusive states. Charge and discharge must never be asserted simultaneously.

| State | Charge Signal | Discharge Signal | Node Colour | Particles | Label | Fill Gauge |
|-------|--------------|-----------------|-------------|-----------|-------|------------|
| Idle | LOW | LOW | Dimmed green | None | "Idle" | Static at current SoC |
| Charging | HIGH | LOW | Active green | Busbar → Battery | "Charging" | Visually increasing |
| Discharging | LOW | HIGH | Active green | Battery → Busbar | "Discharging" | Visually decreasing |
| ERROR | HIGH | HIGH | Red | None | "ERROR" | — |

SoC calculation: battery starts at 0 Ah. Charges at 1A per simulated hour (+1 Ah per hour). Discharges at 1A per simulated hour (−1 Ah per hour). 100% efficient. The handbook explicitly states "no limit on the battery capacity" — there is no natural "full" state, so SoC is tracked in absolute amp-hours rather than percentage. The Il Matto computes `SoC_Ah = cumulative_charge_hours − cumulative_discharge_hours` and transmits this value over Bluetooth. The dashboard displays it as Ah. The fill gauge on Tab 1 scales relative to a configurable reference capacity in Settings (default 10 Ah) — this is a display convention for visual scaling, not a hardware limit.

**SoC accuracy limitation:** The handbook specifies that the battery can only be charged if there is 1A of excess current available on the busbar. However, the test bed provides no feedback signal confirming whether a charge command was accepted or silently ignored. If the meter asserts charge but surplus supply is less than 1A, the test bed does not charge the battery — but the Il Matto has no way to know this. It increments its SoC counter regardless, causing the estimated SoC to drift above the test bed's actual battery state. Over a 24-hour simulation this drift can become significant.

The dashboard must account for this. When the charge signal is HIGH, the dashboard should check whether total supply (wind + PV + mains) minus total active load demand is at least 1A. If not, the dashboard should:

- Display a warning indicator on the battery node (e.g., "CHARGE REJECTED?" in amber)
- Flag these moments in the load management timeline
- Include a caveat on the SoC gauge: "Estimated — may drift if charge commands were rejected by the test bed"
- Report suspected drift events to the AI advisor so it can factor them into its analysis

This is not a dashboard bug — it is a fundamental limitation of the test bed interface design. The dashboard's role is to surface the problem clearly so the team can adjust their algorithm to only assert charge when surplus is genuinely available.

### 9.2 Load States

Each of the three loads has four possible states based on the combination of call signal (input) and switch signal (output):

| Call | Switch | Meaning | Dashboard Treatment |
|------|--------|---------|-------------------|
| 0 | 0 | Inactive, not needed | Grey node, no particles, label "OFF" |
| 1 | 1 | Active, demand met | Blue node, active particles, label "ON" |
| 1 | 0 | Demand unmet | Yellow dashed border, no particles, label "CALLING" — visually urgent |
| 0 | 1 | Powered without demand | Should not occur — flag as anomaly |

Three loads exist because the test bed hardware defines exactly three, with deliberately different current demands (0.8A, 1.8A, 1.4A) to create algorithmic complexity. When total renewable supply is limited, the algorithm must make tradeoff decisions about which loads to serve.

### 9.3 Mains/Grid State

Mains is not binary on/off — it is a continuous variable (0–10V analogue output mapping to 0–4A). The dashboard represents mains at different levels:

| Request Level | Visual Treatment |
|---------------|-----------------|
| 0A (0V) | Node dimmed, no particles, grey — ideal state |
| Low (0.1–1A) | Node slightly active, slow particles — supplementing renewables |
| Medium (1–3A) | Node active, moderate particles — significant mains draw |
| High (3–4A) | Node fully active, fast particles — mains carrying most load |

### 9.4 Data Persistence

During a live Bluetooth session, all received packets accumulate in a JavaScript array (React state). When Bluetooth disconnects, the array is retained. Tab 1 freezes at the last received state. Tab 2 allows full playback of the captured data. The user can export the captured session as CSV.

The dashboard uses localStorage to store the most recent session so it survives page reload. On opening with no live connection, the dashboard offers to load the stored session, upload a CSV, or start fresh with simulated data.

---

## 10. Technical Implementation

This section describes the functional requirements for the dashboard's technology choices. The concrete stack, project structure, and build configuration are defined in CLAUDE.md, which is the authoritative source for all implementation decisions.

### 10.1 Stack

The dashboard is a React application styled with Tailwind CSS.

| Dependency | Purpose |
|------------|---------|
| React | UI framework |
| Recharts | Area charts, line charts, bar charts, donut charts |
| Lucide React (0.263.1) | Icon library |
| Tailwind CSS | Styling via utility classes |
| PapaParse | CSV file parsing |

### 10.2 AI Integration

The dashboard includes an AI analysis engine accessed via OpenAI's
`gpt-4o` model. Requests are proxied through a local Express server
(`server.js` on port 3001) to avoid exposing the API key to the
browser. Data sent with each request is sampled (48 points across the
dataset) rather than the full dataset, to stay within context limits
while providing representative coverage. The full transport details
(SSE streaming, system prompt construction) are defined in CLAUDE.md
Section 3.

### 10.3 Web Serial API Usage

```javascript
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 9600 });
const reader = port.readable.getReader();
// Read and parse incoming bytes as UTF-8 lines
```

Requires HTTPS or localhost. Chrome 89+ required. The user must grant port access through the browser's permission dialog on each session.

---

## 11. Metrics Calculation Reference

All metrics are computed from the accumulated data points (live or CSV).

| Metric | Formula | Notes |
|--------|---------|-------|
| Total Energy (Load) | Σ ((ls1 × L1_demand + ls2 × L2_demand + ls3 × L3_demand) × V_bus × Δt) / 1000 | Energy consumed by the three loads only, in kWh. Uses load switch states and configured demand values. This is the primary energy metric because it represents actual consumption — what the handbook requires the meter to measure. |
| System Throughput | Σ (I_bus × V_bus × Δt) / 1000 | Total energy drawn from all sources including battery charging, in kWh. Available in the raw data table but not a headline metric, because it conflates consumption with storage. |
| Renewable % | Σ(wind + PV) / Σ(wind + PV + mains) × 100 | Ratio of renewable supply to total supply |
| Mains Dependency | Σ(mains) / Σ(wind + PV + mains) × 100 | Inverse perspective of renewable % |
| Battery Balance | Count of charge-active minutes vs discharge-active minutes | Direct comparison, violation if discharge > charge |
| Unmet Demand | Count of (any load calling AND not switched on) / total data points × 100 | Percentage of time any demand went unserved |

Note: the mains value used in Renewable % and Mains Dependency is the converted RMS current (`V_packet / 10 × I_mains,rms_max`), not the raw DC voltage.

When the final scenario is published, additional metrics may be added to the code (e.g., total energy cost, net profit, satisfaction score). These follow straightforward formulas based on whatever cost rates, revenue values, or penalty weights the scenario defines. The core metrics above remain useful across all scenarios.

---

## 12. Files Required from the Team

To fully deploy the dashboard with real data, the following are needed:

| Item | Status | Notes |
|------|--------|-------|
| Il Matto UART transmit code | To be written | ~20–30 lines of C added to existing firmware |
| HC-06 wiring to Il Matto UART | To be wired | TX/RX/VCC/GND, standard connection |
| HC-06 pairing with laptop | One-time setup | Standard Bluetooth pairing, creates virtual COM port |
| Sample .tdms export as CSV | Needed for column mapping confirmation | One test run exported via Excel |
| Final scenario publication | Released before final review | Defines the optimisation target and evaluation criteria. Update the AI system prompt, metric cards, and any new metric formulas in the code to match. |

The dashboard requires a lightweight Express proxy server (`server.js`)
for AI integration (proxies OpenAI API requests). No database is needed.
The frontend runs as a single-page application; in production, the
Express server serves the built static files and handles `/api/chat`
requests. See CLAUDE.md Section 3 for server details.
