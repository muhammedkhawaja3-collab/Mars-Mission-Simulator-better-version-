# PLAN — Mars Mission Simulator team upgrade

Branch `team-upgrade`. Baseline: Phase 0 = `a142c84` (stabilise), Phase 1 = `46d50c9`
(JS physics engine in `frontend/src/physics/`, 78 Vitest tests). Inputs: `AUDIT.md`,
`frontend/src/physics/README.md`. Goal: a portfolio piece for a Waterloo Mech Eng
application that is **scientifically honest, polished and fast**.

Audit IDs: A = architecture, B = backend, S = security, X = accessibility,
U = UX. AUDIT §3 Performance items have no IDs, so this plan labels them
**P1** (9 s splash/LCP), **P2** (re-render storm), **P3** (paint-heavy animations),
**P4** (render-blocking fonts), **P5** (three.js bundle weight). **T1** = the tooling
gaps (Prettier, react/jsx-a11y plugins, max-warnings 0, RTL, JSDoc state types).

---

## 1. Scope

### Must-have
| Item | Audit IDs | Phase |
|---|---|---|
| Launch-vehicle catalog (Starship, SLS Block 1, SLS Block 2 *planned*, Falcon Heavy, New Glenn), sourced, estimates flagged | A3, U5 | 2 |
| Separate in-space propulsion: chemical LH2/LOX, NTR "advanced concept (never flown)", Starship integrated + tankers | A3, A4, U1, U6 | 2 |
| Life support from NASA BVAD, crew 2–8 × mission length, recycling closure flagged | B7 | 2 |
| Radiation dose by phase (cruise / surface / return / flare event) | A2, A18 | 2 |
| Seeded RNG (mulberry32) + labelled gameplay events scaled by risk 1–10 | A16, U4 | 2 |
| Success probability + score with per-factor explanation; uncrewed launch failure recoverable | A10, B3 | 2 |
| Fixed window IDs (2026…2035); UI keeps 2027–2035 year labels | A20, B7 | 2 |
| Golden fixtures `shared/golden_cases.json` + Vitest test | A18 | 2 |
| Fix wrong copy: "2× Isp → 4× less propellant" | U2, A4 | 2 |
| Fix electric thrust units (N not kN) | U3 | 2 |
| Remove invented payload/cost formulas; J-2X → RL10 for EUS | U5 | 2 |
| Re-verify all NTR-favouring copy is gone | A4, U1 | 2 |
| Bone loss 0.43 %/month: source from NASA HRP or remove; setup/debrief agree | A7, A20 | 2 |
| Archive `mars-mission-brief.md` → `docs/archive/` | A4 | 2 |
| Python physics mirror + golden pytest (rel 1e-9) + textbook checks | A2, A3, B3, B7, A18 | 3 |
| Strict pydantic `POST /api/mission` (extra=forbid, strict, bounds) | B2, B3, B6 | 3 |
| NaN/Infinity → 422, never 500 | B1 | 3 |
| CORS locked (no wildcard + credentials) | B4, S2 | 3 |
| Vercel function `api/index.py`, rewrites, `/api/health` | B5 | 3 |
| Relative `/api` + Vite proxy; UI never blocks on server | A5, S1 | 3 |
| `npm audit fix`; FastAPI/Starlette upgrade | S3, B8 | 3 |
| Security headers (CSP, HSTS, nosniff, Referrer/Permissions-Policy, COOP) | S4 | 3 |
| Split `App.jsx` into components/state/hooks; derived values via `useMemo` | A12, A13, A17, A9 | 4 |
| Design tokens; remove inline styles/hard-coded hex | A19 | 4 |
| Remove 9 s splash | A11, P1, X8 | 4 |
| rAF flight clock; isolated UTC clock | A12, P2 | 4 |
| a11y foundations: labels, focus-visible, contrast ≥ 4.5:1, ≥ 12 px text, live regions, dialog, landmarks, skip link, SVG titles, reduced motion | X1–X8 | 4 |
| Prettier, eslint-plugin-react, jsx-a11y, `--max-warnings 0`, RTL | T1 | 4 |
| Mission-control layout, responsive 390 px → desktop | U (mobile), A14 | 5 |
| Mission timeline with per-phase Δv/day + playback | U rec 6, A15 | 5 |
| Telemetry charts from physics (impulsive propellant steps) | A15, A10 | 5 |
| "Show the math" panel | U rec 2 | 5 |
| Honest multi-metric debrief ("when each vehicle wins") | U rec 3, A4 | 5 |
| Sources & assumptions page; About/engineering notes (author, GitHub, limitations) | U7, U rec 7, U rec 10 | 5 |
| README rewrite with The Science + sources | U7 | 9 |
| SEO, CI extended, Lighthouse ≥ 90 ×4, WCAG AA | P1–P4, S4, X* | 9 |
| Final review: Reality Checker + UI Finish-Gate | all | D |

### Should-have
| Item | Audit IDs | Phase |
|---|---|---|
| Side-by-side comparison of two plans (N-lane safe) | A14 | 6 |
| URL share (fixed window ID + seed) + localStorage saves + presets | U rec 10 | 6 |
| R3F + drei 3D solar system with ephemeris transfer arc, lazy-loaded | U rec 5, P5 | 7 |
| 2D SVG fallback (no WebGL / reduced motion / weak device) | X6, P3 | 7 |
| Guided first-run tutorial; glossary tooltips on every input (Isp, Δv, TRL, mSv, opposition) | U (first-time) | 8 |
| Loading states + friendly errors; defer PWA banner | U (first-time) | 8 |
| Self-host fonts (woff2, `font-display: swap`) | P4 | 9 |
| Replace paint-heavy infinite animations (transform/opacity only, pausable) | P3, X6 | 4/9 |
| Playwright screenshots for README | — | 9 |

### Nice-to-have
| Item | Audit IDs | Phase |
|---|---|---|
| Optional sound + countdown, mute OFF by default | — | 8 |
| Scoring + achievements (Fuel Miser, Perfect Window, …), replayable | — | 8 |
| Hidden "Interstellar mode" easter egg (clearly non-physical) | — | 8 |
| Lambert solver + porkchop plot (optimal transfers) | U rec 4 | after 9 |
| Monte Carlo confidence bands (seed sweep) | — | after 9 |
| Radar trade-off chart | — | after 9 |
| Postgres (Neon) server-side saves | — | after 9 |
| Validation table vs DRA 5.0 in UI with live test count | U rec 7 | 5 (if time) |

---

## 2. Decisions (binding)

1. **Honest trade-off.** Every vehicle flies the same mission; physics decides; no rigged
   numbers, no built-in winner. The JS engine is the source of truth for the UI. Python
   mirrors it for `/api/mission`. `shared/golden_cases.json` prevents drift.
2. **Success heuristic.** A failed *uncrewed* launch (tanker/cargo) is recoverable: re-fly with
   a cost + schedule penalty, not mission loss. Only the crewed launch and in-space events
   (burns, docking, aerocapture, EDL) are mission-critical. Documented in physics README +
   Sources page. This supersedes Phase 1's "every launch must succeed".
3. **Fast transfers are conservative** (tangential-departure family). Say so in the UI.
   Lambert/porkchop is Nice-to-have.
4. **Share links encode a FIXED window ID + seed**, never "next window from today".
   IDs are keyed by departure: `2026-11`, `2028-12`, `2031-01`, `2033-03`, `2035-07`. The UI keeps
   the opposition-year labels 2027 / 2029 / 2031 / 2033 / 2035 and shows the departure month
   ("2027 window, departs Nov 2026"). The 2026 window is already open (today 2026-11-20),
   so the default is `2028-12`.
5. **Bone loss.** 0.43 %/month is removed from the UI unless a NASA HRP primary source supports
   it. If it is kept, use the sourced ~1–1.5 %/month hip BMD range with a citation.
6. **Vehicle cost and dry-mass estimates are flagged** `ESTIMATE` in code and UI. The Reality
   Checker reviews them in Phase D.
7. **Gameplay events are labelled "gameplay model"** (seeded, illustrative odds). They are
   never presented as reliability data.
8. **Sharing:** URL + localStorage now; Postgres later. SQLite won't persist on Vercel.
9. **Repo hygiene.** No personal absolute paths in tracked files. Never merge to `main`. Never
   deploy production. Push `team-upgrade` after each phase. Never rewrite history. Never
   delete the remote branch `claude/daily-ops-tracker-pwa-fy5h28`.
10. **Commit identity.**
    `git -c user.name="muhammedkhawaja3-collab" -c user.email="$(git log -1 --format=%ae a142c84)" commit`
    Every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
11. **Units:** SI inside the engine; convert only in `units.js`/display. Same names and values
    in JS and Python.

---

## 3. Definition of done (every phase)

```bash
# frontend (load nvm first in non-interactive shells)
cd frontend && npm run lint && npx vitest run && npm run build
# backend
cd backend && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/ruff format --check .
```
- [ ] All of the above pass, with 0 lint warnings once Phase 4 sets `--max-warnings 0`.
- [ ] Phase acceptance criteria below met; new behaviour has tests.
- [ ] `PROGRESS.md` updated: phase, commit SHA, test counts, open items, next step.
- [ ] No personal absolute paths: `git grep -nE '/home/|/Users/|C:\\\\Users'` returns nothing.
- [ ] One commit per phase (identity per Decision 10), then `git push origin team-upgrade`.
- [ ] QA agent pass on the phase before the next phase starts.

Ruff is added at the start of Phase 2: `backend/requirements-dev.txt` (ruff, pytest, httpx)
and `[tool.ruff]` in `backend/pyproject.toml`. Existing backend code is made ruff-clean so the
DoD holds from Phase 2 onward.

---

## 4. Build phases

### Phase 2 — Physics extension (JS)
Split into commits 2a–2e if large; push at the end.

**2a Vehicles.** `physics/launchVehicles.js` (new), `physics/propulsion.js` (new),
`physics/vehicles.js` (compose launch vehicle × in-space stage), `mission.js`.
- Launch catalog: `starship`, `sls-block1`, `sls-block2` (`status: 'planned'`), `falcon-heavy`,
  `new-glenn`. Fields: `payloadLeoKg`, `ispVacS`, `thrustN`, `costPerLaunchUsd`, `reusable`,
  `status`, `source`. Every value gets a source comment, and estimates are flagged `ESTIMATE`.
  Starting values to verify: Starship 100–150 t (SpaceX), SLS B1 95 t / B2 130 t (NASA),
  FH 63.8 t expendable (SpaceX), New Glenn 45 t (Blue Origin). SLS ≈ $2.2 B (NASA OIG
  IG-22-003). **Phase 1 used 105 t for SLS, which is Block 1B. Correct it.**
- In-space: `chemical-lh2lox` (RL10-class, 460 s), `ntr` (900 s, label
  `"advanced concept (never flown)"`), `starship-integrated` (380 s, tanker refuelling).
- Launch count = ceil(stack mass in LEO / payloadLeo). Starship-integrated requires the
  Starship launcher. Invalid combinations throw `RangeError`, and the UI disables them.
- Accept: tests cover launch count vs payload, monotonicity (more payload → fewer launches),
  the invalid-combo error, and that each catalog entry has `source`.

**2b Life support + radiation.** `physics/lifeSupport.js` (new), `mission.js`, `constants.js`.
- Food, water and O₂ in kg/person/day from NASA BVAD (NASA/TP-2015-218570/REV2, table refs in
  comments). Scale with crew 2–8 × (transit + surface + return + 30 d contingency). Recycling
  closure (water, O₂) is an explicit parameter flagged `ASSUMPTION` (ISS ECLSS-class). Use it to
  replace the 5 kg/crew-day lump.
- Dose breakdown {cruiseOut, surface, cruiseBack, flareEvents} in Sv; career fraction vs 600 mSv.
- Accept: linear-in-crew test; closure 0 → open-loop mass; crew outside 2–8 → `RangeError`;
  dose sum equals total.

**2c RNG + events + success/score.** `physics/rng.js`, `physics/events.js`,
`physics/success.js` (new).
- `mulberry32(seed)` with a uint32 seed, written so it ports to Python bit-exactly (`Math.imul`,
  `>>> 0`).
- Events: solar flare (adds dose), engine fault (Δv penalty / abort), micrometeoroid,
  comms blackout. Per-day odds = base × f(risk 1–10). Each event carries
  `model: 'gameplay'`.
- Success = product of factors per Decision 2. Uncrewed launch failure → `{recovered: true,
  costPenaltyUsd, delayDays}`. Score 0–100 is returned with `factors[]: {id, value, effect,
  explanation}`.
- Accept: the same seed gives an identical event list (snapshot); first 5 mulberry32 outputs for
  seed 42 are pinned; higher risk → more events on average over 1,000 seeds; a crewed launch
  failure ends the mission and a tanker failure does not.

**2d Windows + golden.** `ephemeris.js`, `frontend/scripts/gen-golden.mjs` (new),
`shared/golden_cases.json` (new), `__tests__/golden.test.js`, `package.json` (`"golden"` script).
- `WINDOWS` table with fixed IDs (Decision 4); `simulateMission({ windowId, seed, … })`.
  `launchDate` is still accepted.
- Golden: ≥ 20 cases (each vehicle combo × hohmann/fastest × crew 2/4/8 × risk 1/5/10 × 2 seeds),
  storing full outputs.
- Accept: `npm run golden` is deterministic (re-run gives no git diff); the Vitest golden test
  passes; the window tests still match the published months.

**2e Copy fixes + archive.** `App.jsx` copy, `physics/README.md`, `docs/archive/`.
- U2: use the Tsiolkovsky ratio from the engine (≈ 2.7× at 4.5 km/s), not "4×". U3: VASIMR
  ≈ 5.7 N, NEXT-C 0.236 N. U5: delete invented payload/cost formulas; EUS = RL10. A4/U1:
  remove NTR-favouring copy. A7/A20: bone loss per Decision 5. A9/A10: debrief uses
  raced vehicles, the `success` metric exists, and `crewHealth` is computed or removed.
- `git mv mars-mission-brief.md docs/archive/` + `docs/archive/README.md` with the one-line
  note: "Original brief; its comparison was biased toward nuclear thermal. Superseded by PLAN.md."
- Accept: `git grep -nE "4× less|4x less|5\.7 kN|J-2X|0\.43"` → no hits outside `docs/archive`;
  physics README updated (vehicles, life support, events, success model).

### Phase 3 — Backend mirror, API, deploy plumbing
Files: `backend/app/physics/{constants,orbits,ephemeris,rocket,launch_vehicles,propulsion,
life_support,rng,events,success,mission}.py`, `backend/app/main.py`, `backend/app/schemas.py`,
`backend/tests/`, `api/index.py`, `vercel.json`, `requirements.txt`, `.python-version`,
`frontend/vite.config.js`, `frontend/src/api.js`.
- Mirror the JS 1:1 (same names in snake_case, same constants). Delete the old rigged fleet.
- `MissionRequest` (`ConfigDict(extra="forbid", strict=True)`): crew 2–8, risk 1–10, `launchVehicle`
  and `propulsion` enums, `windowId` enum, `seed` uint32, `transfer` enum. `response_model` set.
  No UI fields (B6).
- A custom `RequestValidationError` handler strips non-finite inputs; uniform `{error, detail[]}`.
- `GET /api/health`. CORS: an explicit origin list (localhost dev + preview domain via env), no
  credentials.
- Vercel: `api/index.py` exports the app; `vercel.json` has `functions`, a `/api/(.*)` rewrite,
  an SPA fallback and security headers (CSP `default-src 'self'; script-src 'self'`, HSTS,
  `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, COOP).
- Frontend: relative `/api`, Vite proxy → `:8000`. An optional cross-check badge ("server
  agrees") has a timeout, never blocks and stays silent offline (A5, S1).
- `npm audit fix`; pin `fastapi`/`starlette` to current patched versions.
- Accept:
  - pytest golden: every case in `shared/golden_cases.json` within `rel=1e-9`.
  - Textbook: Hohmann 258.9 ± 0.5 d; v∞ 2.94/2.65 ± 0.01 km/s; TMI 3.6 ± 0.05 km/s;
    synodic 780 ± 1 d; mulberry32 seed 42 matches JS.
  - API tests: `NaN`/`Infinity`/`"8"`/`2033.0`/`true`/unknown field → 422 (never 500);
    an evil-origin preflight gets no `Access-Control-Allow-Origin`; `/api/health` → 200.
  - `npm audit --omit=dev` → 0; `vercel.json` valid JSON; `npm run build` has no
    `localhost:8000` in `dist` (`grep -r localhost:8000 frontend/dist` empty).

### Phase 4 — Refactor, design system, a11y foundations
Files: `frontend/src/{state,hooks,model,components/{layout,setup,flight,debrief,ui}}/`,
`styles/tokens.css`, `App.css` (shrinks), `.prettierrc`, `.editorconfig`, `eslint.config.js`.
- `App.jsx` ≤ 200 lines; `useReducer` state; derived results via `useMemo(simulateMission)`;
  no components defined in render; dead code removed (A17); no ref mutation (A13).
- Tokens: colour, spacing, type scale, radius, motion. Contrast ≥ 4.5:1 text and 3:1 UI. Min
  font 12 px. Inline styles → classes (A19).
- Splash removed: the app renders immediately (A11, P1, X8). A `useRafClock` hook drives flight;
  the UTC clock is an isolated component (A12, P2). SMIL stars → one static/CSS layer with a
  pause control that respects `prefers-reduced-motion` (X6, P3).
- a11y: `<main>`, skip link, `htmlFor`/`id`, `:focus-visible`, `aria-pressed`/tabs, a real
  `<button>` for CTAs, labelled swatches, `aria-live` for countdown/events/results, an accessible
  dialog (role, Esc, focus trap + return), SVG `role="img"` + `<title>`.
- Tooling: Prettier, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `--max-warnings 0`,
  `@testing-library/react` + jsdom, JSDoc types for state (T1).
- Accept: `npx prettier --check .` passes; lint 0 warnings; RTL tests (setup form labels, dialog
  Esc/focus return, live-region announces result, reduced motion disables animation);
  `wc -l src/App.jsx` ≤ 200; `grep -c 'style={{' -r src` cut ≥ 80 %.

### Phase 5 — Core experience
Files: `components/layout/MissionControl.jsx`, `flight/Timeline.jsx`, `flight/Telemetry.jsx`,
`debrief/ShowTheMath.jsx`, `debrief/SuccessExplainer.jsx`, `pages/{Sources,About}.jsx`,
`physics/timeline.js` (phase list + time series).
- Responsive grid 390 / 768 / 1280; no horizontal scroll at 390 px; works for 1–N vehicles (A14).
- Timeline: launch(es) → LEO assembly → TMI → cruise (TCMs) → MOI/aerocapture → EDL, with day + Δv
  per phase; play/pause/scrub/speed; keyboard operable.
- Telemetry charts (velocity, propellant remaining as steps at burns, distance from Earth/Mars)
  come from `physics/timeline.js` (A15).
- Show the math: equation → inputs with units → intermediates (v∞ → C3 → Δv_TMI → m₀/m_f →
  propellant → launches → cost → dose). The numbers are the engine's own.
- Debrief: multi-metric table, "when each option is the better choice", no winner star.
- Sources & assumptions page (confidence labels, ESTIMATE/ASSUMPTION/gameplay tags); About page
  (author, GitHub, method, limitations, test count).
- Accept: RTL tests (math panel values equal engine output; timeline phase sum = transit days);
  a unit test that the telemetry series ends at 0 distance-to-Mars; Playwright smoke at
  390 × 844 and 1440 × 900 with no overflow (`scrollWidth <= innerWidth`).

### Phase 6 — Compare + share
Files: `model/share.js`, `model/storage.js`, `model/presets.js`, `components/compare/`.
- Two plans side by side, with a delta column and colour + text (not colour alone).
- URL `?w=2028-12&s=12345&lv=…&p=…&c=4&r=5&t=fastest` round-trips. Bad params → safe defaults +
  a toast. localStorage saves (versioned, try/catch). Presets: "DRA 5.0-like", "Starship
  aerocapture", "Fastest NTR", "Budget".
- Accept: round-trip property test (encode→decode identity over random valid configs); the same
  URL gives an identical result on reload; corrupt localStorage doesn't crash.

### Phase 7 — 3D
Files: `components/viz/SolarSystem3D.jsx` (R3F + drei), `viz/Trajectory2D.jsx`,
`viz/useWebGLSupport.js`.
- Earth/Mars positions + transfer arc sampled from `ephemeris.js`/`orbits.js`; animation synced to
  the flight clock. `React.lazy` + Suspense. The 2D SVG fallback is used for no WebGL,
  `prefers-reduced-motion`, or `deviceMemory ≤ 2` / low `hardwareConcurrency`.
- Accept: three.js is in a separate chunk and the initial JS gzip grows ≤ 10 kB vs Phase 6
  (`npm run build` output); a test where the arc endpoints = Earth at departure / Mars at arrival
  (≤ 1e-6 AU); an RTL test that the fallback renders when WebGL is mocked absent.

### Phase 8 — Delight
Files: `components/tutorial/`, `components/ui/{Tooltip,Toast,Spinner}.jsx`, `model/achievements.js`,
`model/sound.js`.
- First-run tutorial (skippable, replayable, stored flag); a tooltip/glossary on every input;
  loading/empty/error states with friendly copy; the PWA banner is deferred until after the first
  mission.
- Sound + countdown: mute **off by default** (no audio until opted in); respects reduced motion.
- Achievements (Fuel Miser, Perfect Window, Radiation Wise, Heavy Lifter, …): deterministic from
  the result and replayable.
- Interstellar mode: keyboard easter egg, clearly labelled "not physics".
- Accept: RTL tests (tutorial skip/replay, tooltip has an accessible name, no `AudioContext` before
  opt-in, achievement rules unit-tested).

### Phase 9 — Launch quality
Files: `frontend/index.html`, `public/{og.png,favicon.svg,robots.txt}`, `README.md`,
`.github/workflows/ci.yml`, `scripts/screenshots.mjs`, `public/fonts/`.
- SEO: title, description, canonical, OG/Twitter image, favicon, theme colour.
- README: pitch, features, **The Science** (Hohmann, vis-viva, patched conics, Tsiolkovsky, BVAD,
  dose, with formulas + sources), assumptions/limits, setup, stack, tests, screenshots
  (Playwright).
- CI: prettier check, eslint, vitest, build, ruff check + format check, pytest.
- Self-hosted fonts (P4); animations transform/opacity only (P3).
- Accept: Lighthouse (Playwright Chromium against `npm run preview`) ≥ 90 in Performance,
  Accessibility, Best Practices and SEO, on mobile and desktop; axe-core 0 serious/critical;
  CI green on the pushed branch.

### Phase D — Final review
- Reality Checker: every number/claim vs source; vehicle ESTIMATEs (Decision 6); bone-loss
  status; no rigged copy (`git grep -i "dominat"`).
- UI Finish-Gate: 390/768/1440 screenshots, keyboard-only run, reduced motion, no-WebGL path,
  empty/error states.
- Fix all must-fix items, then run the full DoD + Lighthouse again. Update `PROGRESS.md` with the
  final state, then push `team-upgrade`. No merge to `main`, no production deploy.

---

## 5. Risks
| Risk | Mitigation |
|---|---|
| JS/Python float drift breaks golden tests at 1e-9 | Same operation order; avoid platform-dependent `Math.*` paths; compare with `rel` not `abs`; document any field with a looser tolerance |
| Vehicle numbers disputed | Source comments, ESTIMATE flags, Sources page, Reality Checker |
| three.js weight hurts Lighthouse | Lazy chunk, 2D default on mobile/weak devices |
| CSP blocks R3F/workers or fonts | Self-host assets; test CSP under `vite preview` with the headers applied |
| Scope creep | Nice-to-haves only after Phase 9 is green |
