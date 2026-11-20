# Audit — Mars Mission Simulator (team-upgrade)

Date: 2026-11-20. Read-only audit run in parallel by four specialist reviewers
against commit a142c84 (Phase 0) while the Phase 1 physics engine
(`frontend/src/physics/`, commit 46d50c9) was being written. Items already
fixed by Phase 1 are marked **[fixed in Phase 1]**.

Severity: **C** critical · **H** high · **M** medium · **L** low.

---

## 1. Architecture & code quality (Software Architect + Code Reviewer)

`npm run lint`: 0 errors / 3 warnings. Only a smoke test existed before Phase 1.
Good hygiene already present: timer cleanup, `launchId` guard, wrapped localStorage, CI.

| # | Sev | Finding | Where |
|---|---|---|---|
| A1 | C | Transit time came from a curve fitted to 3 hand-picked points (`742·e^(−0.249·ΔV)`), not orbital mechanics. **[fixed in Phase 1]** | App.jsx:99,191 |
| A2 | C | Transit and radiation scaled with *opposition distance*; a transfer arc is not the closest-approach distance (Hohmann ≈ 259 d regardless). `avgVelocity = distance/transit` meaningless. **[fixed in Phase 1 for UI; backend still wrong]** | App.jsx:256-276, main.py:181-196 |
| A3 | C | Hard-coded rigged fleet values: propellant, payload, cost, launches not derived; NTR got 7.2 km/s ΔV vs 4.5 chemical (different missions); NTR-only 0.93 shield factor; Starship "288 days because low Isp" (false). **[UI fixed in Phase 1; backend still has them]** | App.jsx:120-180, main.py:46-124 |
| A4 | C | Narrative rigging: "WHY NUCLEAR THERMAL DOMINATES" panel, NTR-only builder, NTR default, "4× less propellant" (wrong — mass ratio goes as e^(ΔV/2Ve), not ¼). **[mostly fixed in Phase 1 — re-verify copy]** | App.jsx:728-835,1593-1599,2552-2618 |
| A5 | H | Backend response discarded; frontend POSTs to hard-coded `http://localhost:8000`, adds up to 3 s latency, always fails in prod. | App.jsx:1210 |
| A6 | H | `risk` slider had no effect. **[fixed in Phase 1: sets Δv margin]** | App.jsx:1420,921 |
| A7 | H | Centrifuge bone-loss rate overwritten; setup card and debrief disagree. | App.jsx:204,282,935 |
| A8 | H | Player rocket scaled twice; mass not conserved. **[fixed in Phase 1]** | App.jsx:270 |
| A9 | H | Cockpit shows `rockets[]` not `racedRockets[]`; flare multiplier only in telemetry, never debrief. | App.jsx:2322,2342 |
| A10 | H | Debrief `'success'` chart key missing from METRICS (silently null); `crewHealth` never computed. | App.jsx:2525,2367 |
| A11 | H | Black screen ~3.5–9 s on load: CSS fades loader at 3.5 s, JS keeps `.app` hidden until forced 9 s progress. | App.css:81, App.jsx:1013 |
| A12 | M | Race loop `setRaceProgress` every 50 ms re-renders the entire 2,600-line component + 300 SVG stars. | App.jsx:1108 |
| A13 | M | Mutating ref objects (`h.applied = true`); effect deps lint warning in CockpitView. | App.jsx:1117,444 |
| A14 | M | Lane layout hard-coded for 3–4 rockets; breaks for comparisons. | App.jsx:1254 |
| A15 | M | "Fuel left" decreases linearly with distance (burns are impulsive). | App.jsx:2344 |
| A16 | M | Hazards use `Math.random` with invented magnitudes; not reproducible, not labelled as gameplay. | App.jsx:1164-1192 |
| A17 | M | Dead code (`failRate`, `healthMod`, `crf`, `pl`, `src` prop, `dodgeOffsets`); components defined inside render (`Row`, `Sep`). | various |
| A18 | M | Duplicated logic: scaling formula ×3, DISTANCES in both stacks, dose rate 1.3 vs 1.84 mSv/day between stacks. | App.jsx, main.py |
| A19 | M | CSS: 143 inline style objects, ~59 hard-coded hex colours, 10 duplicated selectors, 3,479 lines, no spacing/type tokens. | App.css |
| A20 | L | Opposition distances/dates in `DISTANCES` are wrong (launch windows precede opposition). Career limit 600 mSv correct but backend docstring says 1,000. Bone-loss 0.43 %/month is low-end (1–1.5 %/month commonly cited). | main.py, App.jsx |

Tooling gaps: no Prettier/.editorconfig; ESLint lacks `eslint-plugin-react`
and `jsx-a11y`; no `--max-warnings 0`; no React Testing Library; no JSDoc
types for state shape.

Proposed structure: `physics/` (engine) · `model/` (hazards RNG, share/URL,
scoring) · `state/` (reducer + rAF clock hooks) · `components/{layout,setup,
flight,debrief,tutorial,ui}` · `styles/tokens.css`. Derived values via
`useMemo(simulateMission)`, never stored in state.

## 2. Backend & API (Backend Architect + API Tester)

10/10 pytest pass (Python 3.12, FastAPI 0.111.1, pydantic 2.9.0).

| # | Sev | Finding |
|---|---|---|
| B1 | C | `NaN`/`Infinity` in JSON body → **HTTP 500** (pydantic rejects, then the 422 body echoing `input: nan` fails JSON serialisation). Needs a custom `RequestValidationError` handler. |
| B2 | H | Loose coercion: `"8"`, `2033.0`, `true` accepted; unknown fields (`"vehicle":"warp"`) silently ignored. Use `extra="forbid"`, strict ints. |
| B3 | H | `risk` accepted but unused (identical output for 1 and 10); no vehicle choice, seed, events, or success probability — does not mirror the JS engine. |
| B4 | H | CORS `allow_origins=["*"]` + `allow_credentials=True`: arbitrary origin echoed with credentials (verified with preflight). |
| B5 | H | Not deployable as configured: `vercel.json` ships only `frontend/dist`; no `api/` function; `/health` outside `/api`. |
| B6 | M | Inconsistent error shapes; no `response_model`; UI fields (`color`, `label`) leak through. |
| B7 | M | Physics: transit scales with opposition distance; propellant linear in distance (should be exponential in Δv); opposition dates/distances wrong; g0 9.8066; `abortDv = ΔV − 3.5` arbitrary; crew size doesn't affect life support. |
| B8 | L | Unpinned Starlette resolves to 0.37.2 (CVE-2024-47874, CVE-2025-54121 — multipart; low impact for JSON API). |

Recommendations adopted in PLAN.md: mirror JS modules 1:1 under
`backend/app/physics/`; `shared/golden_cases.json` consumed by Vitest and
pytest; mulberry32 RNG ported bit-exactly; strict pydantic schema; Vercel
`api/index.py` + rewrites + root `requirements.txt`; Vite dev proxy for
`/api`; ruff (lint + format) in CI.

## 3. Security, accessibility, performance

### Security (Application Security Engineer)
| # | Sev | Finding |
|---|---|---|
| S1 | H | Frontend calls visitor's own `localhost:8000` from an https page (mixed content / Private Network Access). |
| S2 | H | CORS wildcard with credentials (= B4). |
| S3 | H | `npm audit --omit=dev`: 3 vulns (axios, form-data, follow-redirects) — `npm audit fix` resolves. Full audit incl. dev: 17 (esbuild ≤0.24.2 needs Vite 6+). |
| S4 | M | No security headers in vercel.json (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP). Built index.html has no inline scripts → `script-src 'self'` feasible. |
| S5 | ✓ | No secrets or personal paths in tracked files; no `dangerouslySetInnerHTML`/`eval`. |

### Accessibility (WCAG 2.1 AA — code review, no screen-reader test)
| # | Sev | Finding |
|---|---|---|
| X1 | C | Zero `aria-*` attributes. Builder modal: no `role="dialog"`, no Esc, no focus trap/return. `.build-cta` is a clickable `<div>`. Empty colour-swatch buttons. Toggles lack `aria-pressed`/tab roles. |
| X2 | S | Form labels not associated (`htmlFor`/`id`) for crew, window, risk, name, colour. |
| X3 | S | No `:focus-visible` styles; `outline: none` on range/select/input. |
| X4 | S | Contrast: `--muted #7a5040` = 2.89:1 (used 29×) fails; several others 1.2–3.6:1 fail; white-on-accent 3.38:1. Text as small as 8.8 px. |
| X5 | S | No live regions for countdown, hazards, results. |
| X6 | M | `prefers-reduced-motion` can't stop 39 SMIL `<animate>` (300 twinkling stars) or JS motion; no pause control. |
| X7 | M | No `<main>`, no skip link, SVGs lack `role="img"`/`<title>`, glyph-only buttons. |
| X8 | M | Forced 9 s loading screen ignores reduced motion. |

### Performance (Performance Benchmarker)
- Build: JS 268.70 kB (86.58 kB gzip) single chunk; CSS 49.32 kB (9.87 kB gzip). three.js will add ~150 kB+ gzip → must be lazy-loaded.
- **H** Artificial 9 s splash (state update every 30 ms) pushes LCP/TTI ≥ 9 s.
- **H** Re-render storm: UTC clock re-renders whole tree each second; race loop at 20 Hz.
- **M** Paint-heavy infinite animations (box-shadow, background-position, `left`, 300 SMIL).
- **M** Render-blocking Google Fonts (3 Orbitron weights + Share Tech Mono) — self-host woff2.
- Lighthouse **could not be run** during the audit (no Linux Chromium). Playwright Chromium is being installed for Phase D.

## 4. UX & persona walkthroughs (UX Researcher + Persona Walkthrough)

Method: code read of App.jsx/App.css/physics + dev server check. Screenshots
could not be captured (Chromium download not finished), so mobile notes are
from CSS only. Parts of this review read App.jsx *before* Phase 1 wired the
engine in; items fixed by 46d50c9 are marked.

**Credibility killers for a Waterloo Mech Eng reviewer**
| # | Sev | Finding |
|---|---|---|
| U1 | C | UI ran on fitted curves/hand-typed ΔV, not the engine; NTR panel, NTR-only builder, custom rocket "NOT COMPARED". **[largely fixed in Phase 1 — re-verify all copy]** |
| U2 | C | "2× Isp → 4× less propellant" (×3 places) is wrong; at 4.5 km/s Tsiolkovsky gives ≈2.7×. |
| U3 | H | Electric thrust units off by 1000× (VASIMR "5.7 kN" should be ≈5.7 N; NEXT-C 0.236 N). |
| U4 | H | Race order randomised (±12 % transit, random hazards) — "physics decides" was false. **[variance removed in Phase 1; hazards still Math.random]** |
| U5 | H | Invented formulas next to real citations (payload = dryMass·(MR−1)·0.08; cost formula). J-2X mis-attributed as SLS upper-stage engine (EUS uses RL10). |
| U6 | H | Starship short-changed (3.8 km/s, no aerocapture credit); NTR given unearned GCR shield bonus. **[fixed in Phase 1]** |
| U7 | M | No author, GitHub link, method, assumptions or "how it works" page. |

**First-time user (high-school level)**
- Fake loading screen + PWA install banner compete for attention immediately.
- Jargon header ("REV 7.0 · REAL COMPONENTS…"), no stated goal; Isp, ΔV, TRL, mSv, opposition never explained.
- 8 px overlay/chart text; dense run-on insight paragraphs.
- No guidance on what to change or why it matters; "Can fail or explode" without a mechanism.

**Mobile (CSS review only)**
- 15+ overlapping `@media` blocks; 137 inline styles override them.
- Inline grids (`1fr 220px`, `repeat(N,1fr)`) won't collapse; debrief table needs horizontal scroll; race lanes tiny at 390 px.

**Top recommendations (by reviewer impact)**
1. One shared mission for every vehicle, all numbers from the engine; seeded, labelled randomness only.
2. "Show the math" drawer: equation → inputs with units → intermediates (v∞ → C3 → ΔV_TMI → m₀/m_f → propellant).
3. Honest trade-off debrief (multi-metric, no single winner star; "when each vehicle is the better choice").
4. Porkchop plot (departure × arrival, C3/ΔV) — strongest rigor signal.
5. 2D/3D heliocentric trajectory from the ephemeris instead of a side-scrolling race.
6. Mission timeline (TMI, coast, TCM, MOI/aerocapture) with ΔV and day per phase.
7. Sources & assumptions page with confidence labels; validation table vs DRA 5.0; show test count.
8. Fix factual errors (U2, U3, U5, bone loss, localhost POST).
9. Onboarding: one-line goal, glossary tooltips, ≥12 px text, defer PWA banner.
10. Reviewer path: About/Engineering notes (author, GitHub, method, limitations), one-click URL presets.
