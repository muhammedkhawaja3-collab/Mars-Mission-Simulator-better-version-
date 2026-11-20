# Mars Mission Simulator: design contract

Status: baseline, binding. Developers build from this document. The Finish-Gate reviewer
grades Playwright screenshots at 375, 768 and 1440 px against §13. Tokens live in
`frontend/src/styles/tokens.css` and must match the names and values here exactly. The
visual direction and the open tokens are settled in §0.

## 0. Visual direction (selected)

**Selected: "Flight dynamics console" (direction A) as the base, with two grafts: B's annotated
explanation layer and C's hero scale (without C's glass).** Decided 2026-11-20 by the Finish-Gate
review of the three static mocks. Evidence: `docs/design-mocks/shots/direction-{a,b,c}-home-{375,1440}.png`,
sources in `docs/design-mocks/direction-{a,b,c}/index.html`. Reference bar unchanged: NASA/JPL Eyes
on the Solar System (calm 3D, precise labels), SpaceX mission control (dense but quiet data),
Linear/Vercel (type, spacing, state polish).

**Product lens.** The reviewer (recruiter, engineering lead, admissions) must see in 5 s that this
is a real flight-dynamics tool: an orbit plot with dated, quantified arcs, a headline that states
the thesis, and one obvious action. On `/plan` the first-read object is the selected plan's
outcome ("4 crew to Mars in 198 days · feasible") next to the live trajectory; the primary action
is "Fly mission". The trade-off story ("physics decides") is carried by side-by-side numbers, never
by a winner.

### Scores (1–5, 5 best; risk rows: 5 = lowest risk)

| Criterion | A Console | B Editorial | C Glass | Selected hybrid |
|---|---|---|---|---|
| 5-second impression | 4 | 3 (375: headline below fold) | 5 | 5 |
| Credibility to an engineering reviewer | 5 | 5 | 3 (reads "concept UI") | 5 |
| Clarity / hierarchy / single primary action | 4 | 4 | 3 (nested panels compete) | 5 |
| Data legibility | 5 | 5 (dot plots, annotations) | 3 (lines under translucency) | 5 |
| Mobile quality (375) | 4 | 2 | 4 | 4 |
| Accessibility risk | 4 | 4 | 2 (contrast varies with scene) | 4 |
| Performance risk (Lighthouse ≥ 95) | 5 | 5 | 2 (backdrop-filter over WebGL) | 4 (full-bleed lazy 3D, poster LCP) |
| Feasibility to build to a high standard | 5 | 3 (custom editorial layouts) | 2 | 4 |
| **Total / 40** | **36** | **31** | **24** | **36 + stronger hero and story** |

**Rationale.** A is the only mock that already looks like a tool an aerospace team would ship:
flat 1 px panels, telemetry typography, a real three-column shell, and charts with phase markers.
Its weakness is the risk the designer named: it is conventional, and its hero is a smaller twin of
the plan view. B has the best *explanation*: an annotated figure that turns the orbit into
sentences ("Leave Earth · 6 Dec 2028, one burn of 3.48 km/s"), an outcome headline that names the
binding constraint, a Δv-budget bar, and shape-coded dot plots that make "no winner" visible. But
B is the least app-like and at 375 it pushes the headline and button below the fold. C has the
strongest first impression because the scene is large and the text sits on it, but its glass
panels (`backdrop-filter: blur(14px)` over a live WebGL canvas) are a GPU and Lighthouse risk,
make contrast depend on whatever is behind the panel, and its nested panel-in-panel-in-container
borders read as a concept shot rather than a working console. The hybrid keeps A's shell, takes
C's scale with an opaque scrim instead of glass, and takes B's annotation and comparison
graphics where the trade-off story is told.

### Final values for the open tokens

| Open token | Final | Note |
|---|---|---|
| `--font-display` | **Space Grotesk** 500/600 | Mock A. Strongest aerospace character at 36–56 px. Inter Tight (C) runs letters together in the wordmark; IBM Plex (B) reads editorial. |
| `--font-text` | **Inter** (variable) | Unchanged. |
| `--font-mono` | **JetBrains Mono** 400/500 | Unchanged. |
| `--accent` | **`#F08A4B`** (hover `#F59A60`, soft `rgb(240 138 75 / 0.12)`) | Unchanged baseline. B's `#EA7A4E` and C's `#EE7F45` gain nothing and would need §3 re-verification. 5.34:1 on `--surface-4`. |
| Surface treatment | **Flat fills + 1 px borders + inset top highlight** (§5) | No gradients on surfaces, no translucency, no `backdrop-filter`. The only gradient in the product is the hero text scrim (§11). |

The §3 contrast table needs no changes because no colour token changed.

### Element map: what comes from where

From **A** (base, everything not listed below):
1. App shell, header (wordmark, nav with 2 px accent underline on active item, UTC clock in mono, Share, Mute), and the 360 / fluid / 400 three-column layout at 1440.
2. Config panel: segmented launch window, stage cards with series-colour line swatch + status badge + Isp line, launcher select with secondary line, sliders with mono value + min/max captions, helper text under each control, full-width "Fly mission" at the panel foot.
3. Viz panel: mono readout top-left (`r 1.12 AU · v 29.09 km/s`), mission clock top-right, legend + "1 AU" scale bar bottom-left, 2D/3D + reset bottom-right; timeline with transport controls, scrubber and phase chips (day + Δv).
4. Telemetry small multiples with TMI / MOI phase lines, current-time cursor with value label, and "Show data table" link.
5. Results column: overline plan label with series bar, outcome line, 2×3 stat tiles with overline labels, `est.` badges and `[n]` citations, tabs.
6. Full comparison table with series line-style keys in column headers, units in row labels, numbered source footnotes.
7. Hero fact strip: three flat cells divided by 1 px rules (not three floating cards).

From **B** (explanation layer):
1. Hero figure annotations: 2–3 callouts with leader lines, each a bold dated title + one plain sentence with a number ("Leave Earth · 6 Dec 2028 / One burn of 3.48 km/s sends the stack off orbit"; "Mid-cruise · day 99"; "Arrive at Mars" with three dated arrivals). Use HTML-positioned labels, not text inside a scaled SVG.
2. Figure caption under the hero scene ("Figure 1. Patched-conic transfers computed by the simulator for 4 crew, risk tolerance 5, seed 42 …" + `[1]`), `--type-caption`, `--text-2`.
3. Outcome headline in the results column: "Feasible, with 0.52 km/s to spare." + second line in `--text-2` naming the binding constraint ("Dose is the binding constraint."). Generated from the engine result, never hand-written.
4. "Where the 7.34 km/s goes": horizontal Δv budget bar with value + plain label under each segment and one sentence of interpretation. Replaces A's legend-list version.
5. "How the three stages compare" dot plots in the results column (one row per metric: transit, mission dose, cost, success), each with series colour **and** marker shape (chemical circle, nuclear diamond, starship square), value labels, axis range and "lower ← / higher →" direction caption.
6. Comparison-section standfirst: "No winner. Each stage leads on something: …" generated from the data.

From **C** (impression):
1. Hero scale: the scene spans the full width behind the text (sun near 62 % x, Mars orbit diameter ≈ 80 % of hero height, min 560 px), not a half-width diagram. Text sits on a solid `--bg` → transparent scrim, never on glass.
2. Header status chip "Engine ready · seed 42" (mono, `--success` dot + word) in place of A's decorative UTC clock at ≥ 1024. Hidden at 375.
3. "Transit by stage" mini bar row with the series line-style rendered as the bar pattern (solid / dashed / dotted). Use in the Overview tab.
4. Optional "Featured transfer" readout card on the hero at ≥ 1440 only, as an **opaque** `--surface-1` panel with 1 px `--border`; drop it if it crowds the annotations.

### Must keep (graded at the finish gate)
- Headline "Plan a crewed mission to Mars. Physics decides." with the second sentence in `--text-2`; one accent "Plan a mission" button + ghost "How it works".
- Hero shows all three transfer arcs with distinct line styles and dated endpoints; the plan view shows only the selected plan. The two must not look like the same diagram twice: hero = comparison with annotations, plan = live playback with clock.
- At 375, headline and primary button inside the first 812 px viewport (scene 4:3 above, as A and C do). B's figure-first order is rejected.
- Mono for every live readout, clock, tick and coordinate; Inter tabular for stat values.
- Series always carry colour + line style (lines) or colour + marker shape (dots/bars) + a direct label.
- NTR card shows "Concept · never flown"; costs and success show `est.`; every sourced figure carries `[n]`.
- Mobile sticky bottom bar "Chemical · 198 d / 2029 window · 4 crew · SLS" + "Fly mission" (all three mocks; keep it).

### Must avoid (seen in the mocks)
1. **No `backdrop-filter`, translucent panels or glass** (C). Contrast must not depend on the scene behind a panel.
2. **Scene bleeding out of its panel** (C 1440: the outer orbit ring runs under the settings panel). The viz is clipped to its panel (`overflow: hidden`).
3. **Panels nested three deep** (C: tile in card in panel in container). Max depth: bg → s-1 panel → s-2 card.
4. **Labels colliding with lines** (A hero: "T+ 99 d · 29.09 km/s", "1.52 AU" and "Earth at arrival" sit on orbit lines). Labels get an 8 px offset, a leader line, or a 2 px `--bg` halo via paint-order stroke (not `text-shadow`).
5. **SVG text that scales with the viewBox** (A/C at 375: orbit labels render well under 12 px). Labels and ticks are fixed-pixel: HTML overlay or counter-scaled, never < 12 px.
6. **Dot-plot label collisions** (B: "1 154" vs "1 159", "85.8" vs "87.2" overlap). Close values stack above/below with a 4 px minimum gap, or merge into one label with a note.
7. **Clipped tabs and chips without an affordance** (A 375: "Show the ma", "Cruise Day 0-"). Horizontal scrollers get an edge fade and keep the active item scrolled into view.
8. **Cramped three-up stage cards** (C: "Concept · never flown" wraps, Isp line squeezed). Stage cards stack vertically in the 360 px panel as in A.
9. **Off-scale type sizes** in all mocks (15, 17, 19, 21, 22 px). Use only §2 tokens.
10. **Second accent button on a region** (A shows "Plan a mission" and "Fly mission" on one page; fine, they are separate regions; never two in one region). "Compare plans" stays secondary.
11. Fact tiles overlapping the bottom of the scene (C crops the orbit with the tiles). The fact strip sits below the hero, full width, separated by a 1 px rule.
12. Google Fonts `<link>` from the mocks. Production self-hosts via `@fontsource` (§2) for Lighthouse.
13. Grey "Physics decides." must stay `--text-2` (9.03:1 on bg), not `--text-3` or lower opacity.

## 1. Principles and voice

**Principles**
1. Physics decides. The UI never crowns a winner; it shows trade-offs and lets the numbers speak.
2. Every number has a unit, a precision rule and a source.
3. One primary action per screen. Everything else is secondary or ghost.
4. Quiet chrome, loud data. Decoration never competes with values.
5. Honest about uncertainty. Estimates, assumptions and gameplay layers are always labelled.
6. Accessible by construction: keyboard, screen reader, reduced motion, colour-blind safe.
7. Same system everywhere: one type scale, one spacing scale, one set of components.

**Voice and copy rules**
- Sentence case for everything: headings, buttons, tabs, labels ("Launch vehicle", not "LAUNCH VEHICLE"). The only uppercase is the `overline` style (§2).
- Units always, with a thin space: `259 d`, `3.57 km/s`, `412 t`.
- No hype or game-show words: never "epic", "dominates", "crushes", "ultimate", "!". No emoji.
- Estimates carry an `est.` badge or suffix. Gameplay items carry a "Gameplay model" tag.
- Nuclear thermal is always described as "advanced concept, never flown".
- Buttons are verbs: "Plan a mission", "Run simulation", "Compare plans", "Copy link".
- Errors say what happened and what to do: "This stage can't carry enough propellant for a 150-day transfer. Pick a longer transfer or another stage."
- Numbers in copy use the same formatter as data (§9).

## 2. Typography

Fonts are self-hosted via `@fontsource` (latin subset, `font-display: swap`), imported once in
`styles/fonts.css`. Remove `@fontsource/orbitron` and `@fontsource/share-tech-mono`.

| Role | Font | Package / weights | Why |
|---|---|---|---|
| Display | Space Grotesk | `@fontsource/space-grotesk` 500, 600 | Engineered, slightly technical geometry; reads "aerospace" without sci-fi pastiche. Used ≥ 20 px only. |
| Text / UI | Inter | `@fontsource-variable/inter` | Best screen legibility at 12–16 px, true tabular figures (`tnum`), `ss01`/`cv11` disambiguation. |
| Mono / telemetry | JetBrains Mono | `@fontsource/jetbrains-mono` 400, 500 | Clear 0/O and 1/l, even width for live counters, equations and the mission clock. |

```css
--font-display: 'Space Grotesk', 'Inter', system-ui, sans-serif;
--font-text: 'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
```

Type scale (1 rem = 16 px). Minimum size anywhere: 12 px.

| Token | Size | Line height | Weight | Tracking | Font | Use |
|---|---|---|---|---|---|---|
| `--type-display` | 56 px / 3.5 rem (36 px < 768) | 1.05 | 600 | −0.02 em | display | Hero headline only |
| `--type-h1` | 36 px / 2.25 rem (28 px < 768) | 1.15 | 600 | −0.015 em | display | Page title |
| `--type-h2` | 24 px / 1.5 rem | 1.25 | 600 | −0.01 em | display | Section title |
| `--type-h3` | 18 px / 1.125 rem | 1.35 | 600 | −0.005 em | text | Card title |
| `--type-body-lg` | 18 px / 1.125 rem | 1.6 | 400 | 0 | text | Lead paragraph |
| `--type-body` | 16 px / 1 rem | 1.6 | 400 | 0 | text | Prose (max 68 ch) |
| `--type-ui` | 14 px / 0.875 rem | 1.45 | 500 | 0 | text | Controls, table cells, labels |
| `--type-caption` | 13 px / 0.8125 rem | 1.45 | 400 | 0.005 em | text | Helper text, axis labels |
| `--type-overline` | 12 px / 0.75 rem | 1.35 | 600 | 0.08 em, uppercase | text | Group labels over panels |
| `--type-stat` | 32 px / 2 rem (28 px < 768) | 1.1 | 500 | −0.01 em | text, `tnum` | Stat tile value |
| `--type-stat-sm` | 20 px / 1.25 rem | 1.2 | 500 | 0 | text, `tnum` | Compact tiles, table emphasis |
| `--type-mono` | 14 px / 0.875 rem | 1.5 | 400 | 0 | mono | Clock, equations, telemetry readouts |
| `--type-mono-sm` | 12 px / 0.75 rem | 1.4 | 400 | 0 | mono | Chart ticks, coordinates |

Rules: every numeric element uses `font-variant-numeric: tabular-nums` (class `.num`). Units are
set in `--text-2` at the same size (stat tiles: unit at 60 % of value size). Headings are tight;
body text is never below 1.5 line height. No italics except for variables in equations (`v∞`).

## 3. Colour

Dark only (`color-scheme: dark`). Contrast ratios are WCAG 2.1, computed from the hex values.

```css
/* surfaces */
--bg: #0A0C10;          /* space, page background */
--surface-1: #11151A;   /* panels, header */
--surface-2: #171C23;   /* cards, inputs */
--surface-3: #1F252E;   /* hover, selected row, popovers */
--surface-4: #29303B;   /* pressed, tooltip, active segment */
--overlay: rgb(5 6 9 / 0.72);
/* lines */
--border-subtle: #222831;  /* dividers inside a surface (decorative) */
--border: #2E3540;         /* card and panel edges (decorative) */
--border-strong: #717B8B;  /* control boundaries: inputs, slider track, checkbox (≥ 3:1) */
/* text */
--text-1: #ECEFF3;  --text-2: #A8B1BD;  --text-3: #949DA9;
/* accents */
--accent: #F08A4B;  --accent-hover: #F59A60;  --accent-soft: rgb(240 138 75 / 0.12);
--on-accent: #0A0C10;
--data: #4FD1C5;    --data-soft: rgb(79 209 197 / 0.12);   /* links, selection, chart cursor */
/* semantic */
--success: #4CC38A;  --warning: #E9B949;  --danger: #F2705F;  --info: #7DA8F5;
--danger-solid: #C9372C;   /* danger button fill, white label */
/* series (Okabe–Ito, tuned for dark) */
--series-chemical: #56B4E9;  --series-nuclear: #D58AC0;
--series-starship: #F0E442;  --series-custom: #C9D1DB;
/* scene */
--sun: #F5D27A;  --earth: #4F8FE0;  --mars: #C1532A;  --orbit: #3A4250;
--focus: #4FD1C5;
```

Contrast on each surface (text needs ≥ 4.5, UI/graphics ≥ 3.0):

| Foreground | bg | s‑1 | s‑2 | s‑3 | s‑4 |
|---|---|---|---|---|---|
| `--text-1` | 16.97 | 15.89 | 14.84 | 13.36 | 11.52 |
| `--text-2` | 9.03 | 8.45 | 7.90 | 7.11 | 6.13 |
| `--text-3` | 7.13 | 6.68 | 6.24 | 5.62 | 4.84 |
| `--accent` | 7.87 | 7.37 | 6.88 | 6.20 | 5.34 |
| `--data` / `--focus` | 10.49 | 9.82 | 9.18 | 8.26 | 7.12 |
| `--success` | 8.84 | 8.27 | 7.73 | 6.96 | 6.00 |
| `--warning` | 10.72 | 10.04 | 9.37 | 8.44 | 7.28 |
| `--danger` | 6.76 | 6.33 | 5.92 | 5.33 | 4.59 |
| `--info` | 8.19 | 7.67 | 7.17 | 6.45 | 5.56 |
| `--series-chemical` | 8.48 | 7.94 | 7.42 | 6.68 | 5.76 |
| `--series-nuclear` | 7.67 | 7.18 | 6.71 | 6.04 | 5.21 |
| `--series-starship` | 14.80 | 13.86 | 12.95 | 11.66 | 10.05 |
| `--series-custom` | 12.70 | 11.89 | 11.11 | 10.00 | 8.62 |
| `--border-strong` (UI) | 4.57 | 4.28 | 4.00 | 3.60 | 3.11 |
| `--earth` (graphic) | 5.91 | 5.53 | 5.17 | 4.65 | 4.01 |
| `--mars` (graphic) | 4.23 | 3.96 | 3.70 | 3.33 | 2.87 (do not draw on s‑4) |
| `--sun` (graphic) | 13.40 | 12.55 | 11.72 | 10.56 | 9.10 |

Fills: `--on-accent` on `--accent` 7.87; on `--accent-hover` 9.02. White on `--danger-solid` 5.16.
`--border`/`--border-subtle` (1.2–1.6) are decorative only; any control edge uses `--border-strong`.
`--orbit` (1.93 on bg) is a decorative guide; meaning is never carried by orbit lines alone.

Rules: the accent appears on the primary button, the active nav item, the active timeline phase
and Mars. Never as large background fills. Colour never carries meaning alone: series also get a
direct label and line style (chemical solid, nuclear dashed 6‑4, starship dotted 2‑3, custom
dash-dot); status also gets an icon and a word.

## 4. Spacing, grid, layout

Spacing scale (4 px base): `--space-0-5: 2px; --space-1: 4px; --space-2: 8px; --space-3: 12px;
--space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
--space-12: 48px; --space-16: 64px; --space-24: 96px`. No other values in component CSS.

Usage: inside controls 8–12; between label and control 8; between controls in a group 16;
card padding 16 (< 768) / 20 (≥ 768); between cards 16; between page sections 48 (< 768) / 64.

Breakpoints (min-width): `sm 375` (base), `md 768`, `lg 1024`, `xl 1440`. Page gutters 16 / 24 /
32 / 40. Grid: 4 columns < 768, 8 columns 768–1023, 12 columns ≥ 1024, gutter 16 / 24 / 24.
Max widths: app shell 1600 px; prose pages (Sources, About) 760 px text column inside 1200 px.

**App shell** (header 56 px, `--surface-1`, bottom `--border`, sticky):

```
≥1440  | Logo  Plan · Compare · Sources · About            [Share] [Mute] |
       | Config 360 | Visualization (fluid, min 640)  | Results 400       |
       |  panel     | 3D/2D view, timeline under it   | stat tiles, tabs  |
1024   | Config 320 | Visualization (fluid)                               |
       |            | Results row under viz (2-col tiles)                 |
768    | Header with nav; config is a collapsible card on top (2-col form) |
       | Visualization 16:10 → timeline → results (stacked, full width)    |
375    | Header: logo + menu button (nav in a sheet)                       |
       | Visualization 4:3 → mission summary tiles (2×2) → timeline        |
       | Config in a bottom sheet: peek bar 64 px "Mission settings · edit" |
       | Results tabs stacked below; sticky bottom action bar 64 px         |
```

At ≥ 1024 the config panel and results column scroll independently (`overflow:auto`, height
`calc(100dvh - 56px)`); the visualization stays fixed. No horizontal page scroll at any width.

## 5. Radius, borders, elevation, z-index

Radius: `--radius-sm: 4px` (badges, tooltips), `--radius-md: 6px` (buttons, inputs),
`--radius-lg: 10px` (cards, panels, dialogs), `--radius-full: 999px` (pills, slider thumb).
Borders: always 1 px. Cards: `--surface-2` + 1 px `--border`. Inputs: 1 px `--border-strong`.
Layered surface = fill one step lighter than the parent + 1 px border + inner top highlight
`inset 0 1px 0 rgb(255 255 255 / 0.03)`.

Elevation (soft, neutral, never coloured; no glow, no `text-shadow`):
`--shadow-1: 0 1px 2px rgb(0 0 0 / 0.30)` cards on hover; `--shadow-2: 0 4px 12px rgb(0 0 0 /
0.35)` popovers, menus; `--shadow-3: 0 16px 40px rgb(0 0 0 / 0.45)` dialogs, sheets.

Z-index: `--z-base 0; --z-sticky 10; --z-header 20; --z-dropdown 30; --z-sheet 40;
--z-overlay 50; --z-dialog 60; --z-toast 70; --z-tooltip 80; --z-skip 90`.

## 6. Motion

Tokens: `--dur-instant: 80ms; --dur-fast: 140ms; --dur-base: 220ms; --dur-slow: 360ms;
--dur-chart: 600ms; --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1); --ease-in-out:
cubic-bezier(0.4, 0, 0.2, 1); --ease-linear: linear`.

| What | How |
|---|---|
| Hover/press colour, border | `--dur-fast` `--ease-out` |
| Press | `transform: scale(0.98)` `--dur-instant` |
| Popover, tooltip | opacity + 4 px translate, `--dur-fast` |
| Dialog, sheet | opacity + 8 px / 100 % translate, `--dur-base` in, `--dur-fast` out |
| Number change (stat tiles) | count from old to new value over `--dur-slow`, `--ease-out`; final value rendered immediately for screen readers |
| Chart reveal | line drawn via `stroke-dashoffset` over `--dur-chart` on first view only |
| Spacecraft / playback | tied to the flight clock (`useRafClock`), linear time |
| Hero scene | slow camera drift ≤ 0.5°/s, planets on real relative rates |

Never animated: layout (width/height/top/left), text reflow, page background, borders pulsing,
blinking, scanlines, shimmer on data, auto-playing sound. Only `transform` and `opacity`.
`prefers-reduced-motion: reduce`: all durations become 0 except opacity fades (≤ 80 ms); number
transitions jump; chart reveals are off; the hero shows the static poster; playback does not
auto-start and the spacecraft moves only on scrub/step; the 3D view uses the 2D SVG.

## 7. Iconography

`lucide-react` only. Sizes: 16 px in controls and table cells, 20 px in nav and buttons ≥ 40 px,
24 px in empty states. Stroke 1.75 (16 px uses 2). Colour `currentColor`. Icons appear only when
they carry function: action buttons, status (with text), nav, playback controls, external-link,
info/glossary trigger. Icon-only buttons require `aria-label` and a tooltip. No decorative icons
in headings, no rockets beside titles, no emoji anywhere.

## 8. Components

All interactive targets ≥ 44 × 44 px on touch (≥ 32 px high visual on desktop with padded hit
area). Focus: `outline: 2px solid var(--focus); outline-offset: 2px` on `:focus-visible` only.
Disabled: 40 % opacity of the label, no pointer events, reason in a tooltip.

- **Buttons.** Sizes `sm` 32 px (padding 0 12, `--type-ui`), `md` 40 px (0 16), `lg` 48 px (0 20,
  16 px text). Primary: `--accent` fill, `--on-accent` label, hover `--accent-hover`. Secondary:
  `--surface-3` fill, 1 px `--border-strong`, `--text-1`. Ghost: transparent, `--text-2`, hover
  `--surface-3` + `--text-1`. Danger: `--danger-solid`, white label (only for delete saved
  mission). Exactly one primary button visible per screen region; on mobile it lives in the
  sticky bottom bar.
- **Slider.** Label left, live value + unit right in `--type-mono` (`180 d`), track 4 px
  `--border-strong`, filled part `--accent`, thumb 16 px `--text-1` with 1 px `--bg` ring, hit
  area 44 px. Min/max captions below in `--type-caption`. Arrow keys step, PgUp/PgDn ×10,
  `aria-valuetext` includes the unit.
- **Segmented control** (window, transfer choice, 2D/3D): `--surface-1` track, 2 px inset; active
  segment `--surface-4` + `--text-1` + `--shadow-1`; inactive `--text-2`. `role="radiogroup"`.
  ≤ 5 options; more → select.
- **Select.** 40 px, `--surface-2`, 1 px `--border-strong`, chevron-down 16 px. Options show name
  + secondary line (e.g. "Falcon Heavy" / "63.8 t to LEO · operational"). Native `<select>` on
  touch; listbox popover ≥ 768.
- **Stage/launcher card** (selectable): `--surface-2`, 1 px `--border`; selected: 1 px `--accent`
  border + `--accent-soft` fill + check icon; shows name, status badge, 2 key specs (Isp,
  payload). Incompatible launcher: disabled with reason ("Starship stage flies only on Starship").
- **Card.** `--surface-2`, `--radius-lg`, padding per §4, header row = `--type-h3` + optional
  ghost action right.
- **Stat tile.** Overline label (top), value `--type-stat` + unit, optional delta row
  (`▲ 12 d vs plan A` in `--text-2` with arrow-up/down icon; colour only when "better/worse" is
  unambiguous), optional `est.` badge right of label, optional source superscript. Min width
  148 px; grid of 2 (375), 3 (768), 2 (results column at 1440), 4 (debrief).
- **Table.** `--type-ui`, row 40 px, header `--type-overline` on `--surface-1`, sticky header,
  1 px `--border-subtle` row dividers, no zebra. Numbers right-aligned, tabular, units in the
  header ("Transit (d)") not in cells. Text left. Best value per row is not highlighted with
  colour; comparisons use the delta column. On < 768 the first column is sticky and the table
  scrolls inside its own container (`overflow-x:auto`, visible scroll shadow).
- **Tabs.** 40 px, `--text-2`, active `--text-1` + 2 px `--accent` bottom bar; `role="tablist"`,
  arrow keys move. On 375 tabs scroll horizontally inside their bar.
- **Tooltip / glossary popover.** Tooltip: `--surface-4`, `--type-caption`, max 280 px, delay
  400 ms, on hover and focus. Glossary: triggered by a dotted-underline term or `info` 16 px
  button; popover `--surface-3`, `--shadow-2`, title + 1–3 sentences + "Source" link; Esc closes,
  focus returns.
- **Dialog / sheet.** Dialog max 560 px, `--surface-2`, `--radius-lg`, `--shadow-3`, overlay
  `--overlay`; focus trap, Esc, focus return. Mobile: same content as bottom sheet, top radius
  10 px, drag handle 32×4 px, max 90 dvh.
- **Toast.** Bottom-right (≥ 768) / above bottom bar (375); `--surface-3`, 1 px `--border`, icon
  + one line + optional action; auto-dismiss 5 s (not for errors); `role="status"`.
- **Badges.** 20 px high, `--radius-sm`, `--type-overline` at 11→12 px, soft fill + coloured text +
  leading dot: Operational (`--success`), Flight test (`--info`), Planned (`--warning`),
  Concept (`--text-2` on `--surface-3`, used for NTR: "Concept · never flown"). `est.` badge:
  `--text-2`, 1 px `--border-strong`, lowercase. "Gameplay model" tag: `--data` text on
  `--data-soft`.
- **States.** Loading: skeleton blocks in `--surface-3` with matching dimensions (no shimmer when
  reduced motion; else a 1.5 s opacity pulse 0.6→1). 3D view loading shows the poster frame +
  caption "Loading 3D view". Empty: 24 px icon, one-line title, one-line help, one action.
  Error: `--danger` icon + message + recovery action; infeasible plans render the
  `infeasibleReason` in an inline warning card, never a blank panel.
- **Source citation.** Numbers with a source get a superscript index `[3]` in `--data`,
  `--type-mono-sm`, linking to the Sources panel row (opens as sheet on mobile, side drawer
  ≥ 1024, focus to that row). Cards with many values use one "Sources" ghost link in the header.

## 9. Number formatting

One module (`model/format.js`) formats every number; components never call `toFixed`.

| Quantity | Rule | Example |
|---|---|---|
| Duration | days, 0 dp | `259 d`; > 999 d → `1 189 d` |
| Dates | `6 Dec 2028` (UTC) | mission clock `T+ 142 d 06:12` mono |
| Velocity, Δv | km/s, 2 dp | `3.57 km/s` |
| Mass | tonnes, 3 s.f.; < 1 t → kg, 3 s.f. | `412 t`, `38.2 t`, `895 kg` |
| Cost | USD billions, 1 dp | `$4.2 B`; < $1 B → `$850 M` |
| Dose | mSv, 0 dp; career fraction % 0 dp | `662 mSv` · `110 % of career limit` |
| Probability | %, 1 dp; ≥ 99.95 → `> 99.9 %` | `91.4 %` |
| Percent margins | %, 1 dp | `6.0 %` |
| Distance | AU 2 dp (heliocentric), million km 1 dp | `1.52 AU`, `78.3 M km` |
| Isp | s, 0 dp | `900 s` |
| Counts | integer | `7 launches` |
| Score | integer / 1000 + grade | `742 / 1000 · B` |

Rules: thin space (U+2009) between value and unit and as the thousands separator (`1 189 d`);
`%` also takes a thin space. Ranges use an en dash without spaces: `1.2–19.5 mSv`. Negative
numbers use a true minus (U+2212): `−12 d`. Deltas always signed: `+3.1 t`, `−12 d`, `±0`.
Estimates: append the `est.` badge in UI, `(est.)` in plain text and tables. Null/infeasible →
`—` (em dash) with a tooltip giving the reason. Screen-reader text spells units
(`aria-label="259 days"`).

## 10. Data visualisation

**Chart chrome** (SVG, own components, no default library styling): background transparent on
`--surface-2`; plot inset 8 px; gridlines horizontal only, 1 px `--border-subtle`; axis lines
none except the baseline (1 px `--border`); ticks `--type-mono-sm` `--text-3`, 4–6 ticks, nice
numbers; axis title `--type-caption` `--text-2` with unit ("Velocity (km/s)"); line width 2 px
(1.5 px at < 768); no area fills except propellant (step chart, 12 % fill of series colour);
no 3D, no gradients, no drop shadows. Legend only when > 1 series, otherwise direct label at the
line end. Phase boundaries (TMI, MOI/aerocapture, EDL) as vertical 1 px dashed `--border-strong`
lines with a `--type-caption` label at top. Current-time cursor: 1 px `--data` line + 6 px dot.

**Tooltip**: `--surface-4`, `--shadow-2`, mono values, shows day + all series at that x; follows
keyboard focus (left/right arrows step by data point). **Accessibility**: every chart has
`role="img"`, a `<title>` and one-sentence `<desc>` summary ("Propellant falls from 412 t to 0 t
in three burns"), plus a "Show data table" toggle rendering the same series as a §8 table.

**Comparison graphics** (§0, from mock B): *Δv budget bar*: one 12 px horizontal bar split into
TMI / capture / spare segments (`--series-*` of the plan, 100 % / 60 % / `--text-3`), 2 px gaps,
each segment labelled below with value (`--type-ui`, mono) + plain label (`--type-caption`).
*Dot plot*: one row per metric, 1 px `--border-strong` axis, markers 8 px in series colour and
shape (chemical circle, nuclear diamond, starship square), value labels above (or below when
within 24 px of a neighbour), axis range and direction ("lower ←") in `--type-caption` right.
*Transit by stage*: 6 px bars using the series line style as the fill pattern.

**Telemetry set**: Velocity (heliocentric, km/s), Propellant remaining (t, steps at burns),
Distance from Earth and to Mars (M km, two lines). Small multiples stacked, shared x-axis (days).

**Trajectory view** (3D R3F lazy chunk; 2D SVG fallback with identical styling, top-down
ecliptic): background `--bg`, no skybox texture, ≤ 400 static points of stars at 20–40 %
opacity (none in 2D). Sun: `--sun` disc, no bloom. Orbits: 1 px `--orbit` lines; Mars orbit
true ellipse. Labels, ticks and readouts are fixed-pixel (HTML overlay or counter-scaled), never scaled with the
SVG viewBox, never < 12 px; labels never sit on a line (offset, leader, or `paint-order` halo in
`--bg`). The viz is clipped to its panel. Earth: `--earth` sphere/dot 8 px; Mars: `--mars` 7 px. Transfer arc: 2 px in the
active vehicle series colour, flown part solid, remaining part 40 % opacity dashed. Spacecraft:
6 px `--text-1` diamond with 1 px `--bg` outline. Labels: `--type-caption` `--text-2`, offset
8 px, leader line when crowded; departure/arrival points labelled with date. Scale bar
("1 AU") bottom-left, mono. Controls (2D/3D segmented, reset view, play) bottom-right, ghost
`sm` buttons on `--surface-1` at 90 % opacity. Camera: orbit controls clamped, no auto-rotate
after user interaction.

## 11. Screen inventory

**Landing / hero** (route `/`, above the setup):
```
1440  | Header                                                                |
      | [ Earth→Mars 3D scene, full-bleed, height 72 vh, min 560; all three  ] |
      | [ arcs; sun ≈ 62 % x; 2–3 annotation callouts with leader lines (§0) ] |
      |   left column (5/12, vertically centred, 40 px gutter):               |
      |   overline "Earth → Mars mission simulator"                           |
      |   Display: "Plan a crewed mission to Mars. Physics decides."          |
      |   body-lg (max 52 ch): stages, launchers, same mission, real numbers  |
      |   [Plan a mission] (primary lg)   [How it works] (ghost lg)           |
      |   caption: "Ephemeris: JPL mean elements · 5 launch windows 2026–2035"|
      |   figure caption under scene (caption, --text-2, with [1])            |
      | Fact strip below the hero, 3 flat cells split by 1 px rules (stat-sm): |
      |   259 d Hohmann · 3.57 km/s TMI · 600 mSv                             |
375   | Header (logo + menu)                                                  |
      | Scene/poster 4:3, full width                                          |
      | overline, Display 36 px (3 lines max), body (3 lines), primary button |
      | full width 48 px; ghost link below; fact tiles 1 column               |
      | Headline + primary button must sit inside the first 812 px            |
      | Annotations collapse to dated endpoint labels only at 375             |
```
Scene: lazy R3F, Earth and Mars on real orbits, transfer arc drawing over 6 s then idle drift.
Fallback and LCP element: a pre-rendered poster (`public/hero-poster.avif` + `.webp`, 1600×900
and 800×600, ≤ 120 kB) of the same frame. Poster shows for no WebGL, reduced motion,
`deviceMemory ≤ 2`, and until the scene's first frame. A gradient scrim on the text side (solid
`--bg` to 34 %, fading to transparent by 54 % of the width, as in mock A) keeps text ≥ 4.5:1. This
is the only gradient in the product. No glass, no `backdrop-filter`, no particles, no lens flare.

**Setup / plan** (`/plan`): config panel sections in order: Launch window (segmented by
opposition year), In-space stage (3 cards + custom), Launch vehicle (select; incompatible
disabled with reason), Crew (slider 2–8), Transfer (segmented Fastest/Hohmann/Set time + slider
120–330 d), Risk tolerance (slider 1–10 with "Δv reserve 2–12 %" caption), Seed (advanced,
collapsed). Results column updates live (debounced 150 ms). Primary: "Fly mission".

**Flight / playback** (`/plan` playback state): visualization dominant; under it the timeline:
```
| [◀◀][▶ Play][▶▶] 1×▾   T+ 142 d 06:12            Day 142 / 259     |
| Launch ▸ LEO assembly ▸ TMI ▸ Cruise ─────────────── ▸ MOI ▸ EDL   |
|  phase chips: day + Δv;  scrubber 44 px hit area, ticks at burns  |
```
Phase chips use `--surface-3`, active `--accent-soft` + accent text. Events appear as markers on
the scrubber and as toasts with "Gameplay model" tag; `aria-live="polite"`. Countdown (opt-in
sound, muted by default) is a mono `T− 10` overlay, skippable. 375: viz 4:3, controls row,
horizontal-scroll phase chips, telemetry charts stacked below.

**Results column** (`/plan`, ≥ 1024): overline plan label → outcome headline from the engine
("Feasible, with 0.52 km/s to spare." + `--text-2` line naming the binding constraint) → status
line → stat tiles → tabs. Overview tab: Δv budget bar, "How the three stages compare" dot plots,
transit-by-stage bars, "When each stage is the better choice" list (§10).

**Debrief / results**: header row: outcome sentence ("Mission feasible · 91.4 % est. success")
+ score `742 / 1000 · B`. 4-up stat tiles (Transit, Total Δv, Propellant, Cost), then tiles
(Launches, Dose, Life support closed-loop mass, Δv margin). Tabs: Overview · Δv · Mass ·
Radiation · Life support · Success factors · Events · Show the math. Achievements as a quiet
row of outline badges with tooltips. "When each option is the better choice" list, no winner
star. Primary: "Compare with another plan". 375: 2×2 tiles, tabs scroll, sections stacked.

**Compare** (`/compare`): two plan columns (A, B) + delta column; each column header has a
series-colour 4 px top bar + name + config summary + "Edit". Table rows = metrics; delta signed,
with arrow icon and word ("12 d shorter"). Overlaid charts below using both series colours and
line styles. 375: plan switcher (segmented A/B/Δ) over a single column table; charts stacked.

**Show the math** (tab and full-width drawer): ordered steps, each a card:
`equation (mono, KaTeX-free, plain HTML with sub/sup) → inputs table (symbol, value, unit,
source) → result`. Chain: v∞ → C3 → Δv_TMI → Δv_capture → m₀/m_f → propellant → launches →
cost → dose. Values come from the engine result; copy button per step. 375: steps stacked,
inputs table full width.

**Sources & assumptions** (`/sources`): prose column 760 px; filter chips (All · Sourced ·
Estimate · Assumption · Gameplay); table: item, value, confidence badge, source link (external
icon), note. Row anchors for citations. 375: rows become stacked definition cards.

**About / engineering notes** (`/about`): prose column; author, GitHub link, method summary,
validation table (model vs reference), limitations, test count. No marketing tiles.

**Interstellar mode**: hidden keyboard sequence; a persistent banner "Interstellar mode — not
physics" in `--warning` soft style with an exit button; all data panels show "Not physics".

## 12. Craft details (graded)

Headings tight (tracking per §2), body comfortable (1.6). All numbers tabular and aligned on a
shared baseline in tile rows. Layered surfaces: bg → s‑1 panel → s‑2 card → s‑3 hover, each with
1 px border. Every interactive element has distinct hover, focus-visible and pressed states.
Stat values animate between results; charts reveal once. Edges align to the 8 px grid; card
edges in a row share top and bottom lines; labels and values share a left edge in forms.

## 13. Finish-gate checklist

Reviewer checks each item on screenshots at 375 × 812, 768 × 1024 and 1440 × 900, plus a
keyboard-only run and a reduced-motion run.

1. [ ] No horizontal scroll at 375, 768, 1440 (`scrollWidth <= innerWidth`).
2. [ ] Only Space Grotesk, Inter, JetBrains Mono load (or the §0 winner); no Orbitron/Share Tech.
3. [ ] No glow, neon, text-shadow, scanlines, CRT effects, glass/`backdrop-filter` or emoji anywhere.
4. [ ] All colours come from tokens; no hex literals in component CSS/JSX.
5. [ ] Text sizes are only scale tokens; nothing under 12 px.
6. [ ] Every heading, button, tab and label is sentence case (overlines excepted).
7. [ ] Exactly one primary (accent) button per screen region; on 375 it sits in the bottom bar.
8. [ ] Every displayed number has a unit and follows §9 precision (spot-check 10 values).
9. [ ] Numbers use tabular figures; stat tile rows align on a baseline.
10. [ ] Estimates show `est.`; NTR shows "Concept · never flown"; gameplay items show the tag.
11. [ ] No "winner" star, trophy or "best" highlight in debrief or compare.
12. [ ] Vehicle series use the four series colours plus direct labels and distinct line styles.
13. [ ] Hero: headline, one primary "Plan a mission", 3D scene or poster; text ≥ 4.5:1 over it.
14. [ ] Hero poster renders with WebGL disabled and with reduced motion.
15. [ ] Shell matches §4 at each breakpoint (3 columns at 1440, stacked at 768, bottom sheet at 375).
16. [ ] Cards use 1 px borders and `--radius-lg`; shadows are soft and neutral.
17. [ ] Spacing values are from the 4 px scale; card gaps are equal within a row.
18. [ ] Focus ring visible (2 px teal, 2 px offset) on every control in a Tab walk; order is logical.
19. [ ] Skip link appears on first Tab; dialogs trap focus and return it on Esc.
20. [ ] Touch targets ≥ 44 px at 375 (sliders, chips, playback controls, tabs).
21. [ ] Charts: horizontal gridlines only, axis titles with units, phase markers, data-table toggle.
22. [ ] Trajectory view: sun, orbits, Earth, Mars, arc (flown solid / remaining dashed), craft marker, dated endpoints, scale bar; no label on a line, no label < 12 px at 375, scene clipped to its panel.
23. [ ] Timeline shows all phases with day + Δv, and play/pause/scrub/speed work by keyboard.
24. [ ] Loading shows skeletons of matching size; empty and error states have message + action.
25. [ ] Infeasible plan shows the engine's reason in a warning card, never a blank panel.
26. [ ] Citations open the Sources panel at the right row.
27. [ ] Sound is off by default; no audio before opt-in.
28. [ ] Reduced motion: no number tweening, chart reveal, auto-playback or 3D drift.
29. [ ] Icons are lucide, consistent size/stroke, and none is purely decorative.
30. [ ] Debrief, compare, math, sources and about pages each match their §11 wireframe.
31. [ ] §0 must-avoid list: none of the 13 pitfalls is visible at 375, 768 or 1440.
