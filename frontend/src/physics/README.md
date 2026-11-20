# Physics engine

A small, dependency-free JavaScript model of a crewed Earth → Mars mission.
Every number the UI shows comes from `simulateMission()`. The modules are pure
functions with no React. They work in SI units (m, s, kg, m/s, Sv, USD) and
convert only for display (`units.js`). The output is plain JSON (dates are ISO
strings), and a Python mirror (`backend/`, next phase) must reproduce
`shared/golden_cases.json` to a relative tolerance of 1e-9.

```js
import { simulateMission } from './physics';

const result = simulateMission({
  vehicle: 'nuclear',                  // in-space stage: 'chemical' | 'nuclear' | 'starship' | custom vehicle object
  launchVehicle: 'sls-block1',         // 'starship' | 'sls-block1' | 'sls-block2' | 'falcon-heavy' | 'new-glenn' (default per stage)
  windowId: '2028-12',                 // fixed window id (default '2028-12'); launchDate / launchYear also accepted
  crewSize: 4,                         // 2–8
  transferChoice: { kind: 'fastest' }, // or { kind: 'hohmann' } or { kind: 'timeOfFlight', timeOfFlight: seconds }
  riskTolerance: 5,                    // 1 (12 % Δv reserve) … 10 (2 % reserve); also scales gameplay event odds
  seed: 42,                            // uint32 for seeded gameplay events; omit/null = nominal flight, no events
});
```

## Modules

| File | What it does |
|---|---|
| `constants.js` | μ, radii, orbits, J2000 orbital elements, parking/capture orbits, radiation dose rates. Every value is sourced. |
| `orbits.js` | Two-body relations, Hohmann transfer, patched-conic departure/capture burns, entry speed, faster tangential-departure transfers, arc length. |
| `ephemeris.js` | Planet positions from mean elements (Kepler's equation), launch-window phasing, conjunction-class surface stay. |
| `windows.js` | Fixed launch-window table (`2026-11`, `2028-12`, `2031-01`, `2033-03`, `2035-07`) computed by the ephemeris, with opposition dates. A test checks table = computation. |
| `rocket.js` | Tsiolkovsky equation, propellant for a Δv, max Δv, launch counting. |
| `launchVehicles.js` | Launch-vehicle catalog (payload to LEO, Isp, thrust, cost, status, reliability class, source) and stage × launcher compatibility. |
| `vehicles.js` | The three in-space stages plus `createCustomVehicle()`. Estimates are flagged `ESTIMATE`. |
| `lifeSupport.js` | Food, water and O₂ per crew-day from NASA BVAD, per mission phase, open-loop and closed-loop. |
| `rng.js` | `mulberry32(seed)` and helpers; bit-exact portable. |
| `events.js` | Seeded in-flight events (gameplay model): solar particle events, engine faults, micrometeoroids, comms blackouts. |
| `success.js` | Success heuristic with an explained `successFactors` list; uncrewed launch failures are recoverable. |
| `scoring.js` | Score 0–1000, letter grade, transparent components, achievements (gameplay layer). |
| `mission.js` | `simulateMission()`, crew payload, Δv margin, crew-health index. |
| `tradeoffs.js` | Picks the best vehicle per metric (neutral UI copy, no built-in winner); `comparisonFraming()` notes; `cheapestCompatibleLauncher()` re-flies a stage on its cheapest launcher. |
| `units.js` | Display conversions. |

## The model

1. **Launch window.** Earth and Mars are placed with JPL mean orbital
   elements (Mars on its real eccentric orbit, 1.38–1.67 AU). The departure
   date is solved so the transfer arrives exactly where Mars will be. The five
   fixed windows depart 4 Nov 2026, 6 Dec 2028, 16 Jan 2031, 30 Mar 2033 and
   8 Jul 2035. The UI labels each by the Mars opposition it leads up to
   ("2029 window", departs Dec 2028); the computed oppositions (19 Feb 2027,
   25 Mar 2029, 4 May 2031, 28 Jun 2033, 15 Sep 2035) match published dates to
   within a day. The 2027 window is already open (Nov 2026), so the default is
   `2028-12`.
2. **Heliocentric transfer.** The ship leaves Earth's orbit tangentially. The
   Hohmann-type transfer is also tangent at Mars' orbit (180°). Faster
   transfers raise the apoapsis, so the ship crosses Mars' orbit early and at
   an angle. That buys time at the cost of higher v∞ at both ends.
3. **Patched conics.** Earth departure is a periapsis burn from a 400 km
   circular LEO to the required v∞. Mars capture is either a periapsis burn
   into the DRA 5.0 250 km × 33,793 km 1-sol ellipse (chemical, NTR), or
   aerocapture (Starship), with v∞ capped by a 7.5 km/s entry-speed limit.
4. **Propellant.** Burnout mass = stage dry mass + common crew payload
   (habitat + crew + closed-loop consumables for the transit and 30
   contingency days). Propellant comes from the rocket equation for the
   planned Δv (required × (1 + risk margin)). A transfer is infeasible if it
   needs more propellant than the tanks hold.
5. **Transfer choice.**
   - `hohmann` and `timeOfFlight`: every vehicle flies the identical trajectory.
   - `fastest`: each vehicle flies the fastest transfer that one full tank
     load (minus the margin) can deliver, found by bisection on transit time.
6. **Launch vehicle, launches and cost.** The in-space stage is lifted by the
   chosen launch vehicle:
   - *Assembled* stages (chemical, NTR, custom) fly on any launcher:
     launches = ceil(mass in LEO / launcher payload to LEO). Splitting the
     stack into pieces of any size is a simplification.
   - The *Starship* stage is the Starship launcher's own upper stage, so it
     only flies on Starship: 1 crewed ship launch + ceil(propellant / 100 t)
     tanker flights. Any other launcher throws `RangeError` with a reason, and
     the UI keeps Starship on its own launcher instead of silently swapping.
   - Default launcher: SLS Block 1 for assembled stages, Starship for Starship.
     (Phase 1 used 105 t, which is SLS Block 1B. Phase 2 uses the correct
     Block 1 figure of 95 t, so chemical/NTR launch counts rose.)
   - Cost = stage hardware + launches × cost per launch + expected re-flight
     cost (below). Development costs are excluded.
7. **Radiation.** Dose = measured rate × time, reported per phase:
   `dose.outbound`, `dose.surface`, `dose.return`, `dose.events` (seeded
   solar particle events), `dose.total`, `dose.careerFraction` of the
   600 mSv NASA career limit, `dose.careerLimit` (0.6 Sv) and
   `dose.exceedsCareerLimit`. Cruise uses 1.84 mSv/day (Curiosity RAD, GCR
   only), the surface 0.64 mSv/day. The return leg mirrors the outbound one,
   and the surface stay is the wait the planets' phasing requires (≈ 454 d for
   Hohmann). **Every conjunction-class mission with MSL-like shielding
   exceeds the 600 mSv limit** (≈ 0.84–1.26 Sv for the reference vehicles);
   the result says so in `framing` (`career-limit`). Cross-check: Hassler et
   al. (2014) estimated ≈ 1.01 Sv for 180 d + 500 d + 180 d; this model gives
   ≈ 0.98 Sv for those durations.
9. **Framing.** `framing` is a list of `{id, text}` notes the UI shows next
   to the numbers: `launcher-cost` (costs are shown with the chosen
   launcher, which changes them), `capture-method` (engine-burn capture vs
   aerocapture is an architecture choice; DRA 5.0 also studied aerocapture
   for the chemical option) and, when exceeded, `career-limit`.
   `comparisonFraming(missions)` adds comparison-level notes, and
   `cheapestCompatibleLauncher(params)` flies a stage on every compatible
   launcher and returns the lowest-cost feasible result.
8. **Life support.** Per crew-day: O₂ 0.895 kg, water 3.2 kg in transit and
   4.48 kg on the surface, food 2.39 kg (packaged). Closed-loop mass = food +
   water × (1 − 0.93) + O₂ × (1 − 0.50). Outputs both open-loop and
   closed-loop masses for the outbound (+30 d contingency), surface and return
   phases. Only the outbound closed-loop mass rides on the outbound stage; the
   rest is assumed pre-deployed with the return vehicle (DRA 5.0). This
   replaces Phase 1's 5 kg/crew-day lump (closed-loop ≈ 3.06 kg/crew-day in
   transit; the recycling hardware and spares are in the habitat allowance).

### Heuristics and gameplay (simplified, not rigorous)

- **Success probability** (`success.js`): product of mission-critical factors
  only, each returned in `successFactors` as `{id, label, probability, explanation}`:
  crewed launch (by the launcher's reliability class: proven 0.99 for
  Falcon Heavy, limited history 0.97 for SLS Block 1 and New Glenn,
  planned/never flown 0.96 for SLS Block 2, flight test 0.95 for Starship;
  the explanation names the class and why), dockings/transfers involving the crewed vehicle
  (assembled: 1 docking if N > 1; Starship: each of the N − 1 tanker transfers
  docks with the crewed ship), propulsive burns (vehicle `burnReliability`
  per burn), aerocapture (Starship only), Mars EDL (0.98, same for all), and a
  Δv-margin term 1 − 0.10·e^(−margin/0.04).
  **A failed uncrewed launch is recoverable**: the element is re-flown. With
  per-element success q (launcher reliability × docking for assembled
  elements, launcher reliability only for tankers) and U uncrewed launches, expected extra launches =
  U(1 − q)/q (negative binomial). That adds `cost.reflightReserve` = extra ×
  cost per launch and `launchPlan.reflightDelayDays` = extra × 30 days
  (ASSUMPTION), not mission loss. The schedule penalty is reported but does
  not move the departure date. All reliabilities are heuristics chosen to
  reflect flight heritage, not data.
- **Events** (`events.js`, gameplay model, only with a `seed`): mulberry32
  drives a fixed draw order (see the file header). Per-day odds × risk factor
  (0.5 at risk 1 … 2.0 at risk 10). Solar particle events (cruise only):
  +1.2–19.5 mSv each, the range RAD measured per event behind MSL shielding.
  Engine faults (per burn): 1–5 % of that burn's Δv; if the total exceeds the
  carried reserve (planned − required Δv), `eventSummary.abort` is true.
  Micrometeoroids: 10–100 kg of consumables lost. Comms blackouts: 1–14 days
  (solar-conjunction moratoria last ≈ 2 weeks). Event odds are illustrative.
  The physics (trajectory, propellant) never depends on the seed.
- **Score** (`scoring.js`, gameplay): 300 × success probability (0 if aborted)
  + 200 × radiation (≤ 0.8 Sv full, ≥ 1.4 Sv zero, linear; the old
  "fraction of 600 mSv" scale scored every mission 0 because every
  conjunction-class mission exceeds the limit) + 150 × (Hohmann propellant / propellant used) +
  150 × log-scaled cost ($1 B → full, $30 B → 0) + 200 × transit
  (≤ 120 d full, ≥ 330 d zero). Grades: A+ ≥ 900, A ≥ 800, B ≥ 650, C ≥ 500,
  D ≥ 350, else F. Achievements: Fuel Miser, Perfect Window (cheapest fixed
  window, currently `2033-03`), Radiation Rookie (mission dose < 0.9 Sv),
  Shielded, Heavy Lifter, Speed Demon, Full Crew, Risk Taker Survives. A test
  pins one input that earns each achievement, so none can become unreachable.
- **Crew-health index** = 100 − 25 × (mission dose / 600 mSv) − 1 per month
  weightless. Illustrative only. The UI does not show a bone-loss percentage
  (Phase 1's unsourced per-month figure was removed).

## Output shape (`simulateMission`, schemaVersion 3)

Feasible result keys:

```
schemaVersion, inputs{vehicleId, launchVehicleId, crewSize, riskTolerance, windowId, seed,
  transferChoice, habitatMass, closure{water, oxygen}},
vehicleId, launchVehicleId, windowId,
vehicle{id, name, isp, stageDryMass, propellantCapacity, marsCapture, gcrShieldingFactor, launchMode, trl, hardwareCost},
launchVehicle{id, name, payloadLeoKg, costPerLaunchUsd, status, reliabilityClass, launchReliability},
feasible, infeasibleReason, transferChoice, departureDate, arrivalDate (ISO strings),
transitTime, hohmannTransitTime, transferAngle, pathLength, averageSpeed, vInfDeparture, vInfArrival,
deltaV{departure, capture, total, planned, capability, reserve, margin, hohmannTotal},
mass{habitat, crew, consumables, payload, stageDry, dry, propellant, initialMassInLEO, hohmannPropellant},
launches, launchPlan{launchVehicleId, capacityPerLaunch, crewedLaunches, uncrewedLaunches,
  expectedReflights, expectedLaunches, reflightDelayDays},
cost{hardware, launches, reflightReserve, total},
duration{outbound, surfaceStay, return, total},
dose{outbound, surface, return, events, total, careerFraction, careerLimit, exceedsCareerLimit},
lifeSupport{crewSize, closure, contingencyDays, ratesPerCrewDay{transit, surface},
  outbound, surface, return (each {days, crewDays, food, water, oxygen, openLoop, closedLoop}),
  total{food, water, oxygen, openLoop, closedLoop}},
success{probability, recoverable{uncrewedLaunches, elementReliability, expectedReflights,
  costPenaltyUsd, delayDays, explanation}},
successFactors[{id, label, probability, explanation}],
crewHealthIndex,
events[{id, type, label, phase, burn, day, model, effects{extraDose, deltaVPenalty,
  consumablesLossKg, commsOutageDays}, description}],
eventSummary{count, byType, extraDose, deltaVPenalty, consumablesLossKg, commsOutageDays,
  deltaVReserveAfter, abort, abortReason},
framing[{id, text}]   (ids: launcher-cost, capture-method, career-limit),
score{total, max, grade, components[{id, label, max, value, points, explanation}],
  achievements[{id, label, description}]}
```

An infeasible result has `schemaVersion, inputs, vehicleId, launchVehicleId,
windowId, vehicle, launchVehicle, feasible: false, infeasibleReason,
transferChoice, departureDate, arrivalDate, transitTime: null,
hohmannTransitTime, deltaV` (partial or null), `successFactors: [],
events: []` and `score` (0, 'F').

## Validation (see `__tests__/`)

| Check | Model | Reference |
|---|---|---|
| Hohmann Earth→Mars time of flight (circular) | 258.9 d | ≈ 259 d (textbook) |
| Departure / arrival v∞ (circular) | 2.945 / 2.649 km/s | 2.94 / 2.65 km/s |
| TMI Δv from 400 km LEO | 3.57 km/s | ≈ 3.6 km/s |
| Mars capture into 1-sol ellipse | 0.90 km/s | ≈ 0.9–1.0 km/s (DRA 5.0 class) |
| Phase angle at departure | 44.3° | ≈ 44° |
| Synodic period | 779.9 d | 780 d |
| Hohmann conjunction stay | 454 d | ≈ 450–460 d |
| Launch-window dates 2026–2035 | within the published months | NASA/JPL window lists |
| Mars opposition dates 2027–2035 | within 1 day | published opposition dates |
| mulberry32(42) first five outputs | pinned | reference implementation |
| Golden fixtures (23 cases) | rel. 1e-9 | `shared/golden_cases.json` (`npm run golden`) |

Monotonicity tests: more crew → more mass, faster transfer → more Δv and
less transit dose, higher Isp → less propellant, more payload per launch →
no more launches, higher risk → more events on average (1,000 seeds). Invalid
input throws `TypeError`/`RangeError`.

## Assumptions and simplifications

- **Coplanar orbits.** Inclination is ignored (Mars is 1.85° off the
  ecliptic). The window model uses eccentric orbits with mean elements
  (valid 1800–2050).
- **One-parameter fast-transfer family.** Tangential departure isn't
  Δv-optimal for a given time. A Lambert/porkchop search would do somewhat
  better, so fast-transfer Δv here is conservative (high).
- **Impulsive burns.** Gravity losses and finite burn time are ignored.
  Electric propulsion can't be represented and is rejected.
- **Outbound propulsion only.** The return leg affects duration, dose and
  life support, but its propellant is assumed pre-deployed or made on Mars.
- **Launch packing.** Assembled stacks are divided by launcher payload as if
  any split were possible; real stack elements are not arbitrarily divisible.
- **Shielding.** All reference vehicles use the RAD (MSL cruise-stage) dose
  rate, shielding factor 1. Solar-cycle modulation is not modelled.
- **No boil-off.** Long-duration cryogenic storage losses (LH₂ especially)
  are ignored. This flatters chemical and NTR.

## Sources

Every constant, vehicle figure, rate, limit, date, cost and heuristic is
listed with its primary source and status in [`docs/FACT_CHECK.md`](../../../docs/FACT_CHECK.md).

| Quantity | Value | Source |
|---|---|---|
| AU, μ_sun | 1.495978707e11 m, 1.32712440018e20 m³/s² | IAU 2012 B2; IAU 2015 B3 / JPL DE430 |
| μ, radius: Earth / Mars | 3.986004418e14, 6378.137 km / 4.282837e13, 3396.2 km | WGS84; NASA NSSDC Mars fact sheet |
| Orbit radii, periods | 149.598 / 227.956 × 10⁶ km; 365.256 / 686.98 d | NASA NSSDC fact sheets |
| Planet positions | J2000 mean elements + rates | Standish, JPL SSD "Keplerian Elements for Approximate Positions of the Major Planets" |
| Mars capture orbit | 250 × 33,793 km (1 sol) | NASA DRA 5.0, NASA-SP-2009-566 |
| Cruise dose rate (GCR) | 1.84 mSv/day | Zeitlin et al., Science 340, 1080 (2013) |
| Surface dose rate | 0.64 mSv/day | Hassler et al., Science 343 (2014) |
| SPE dose per event | 1.2–19.5 mSv | RAD cruise SPEs, Hassler, NOAA Space Weather Workshop 2016 |
| Career limit | 600 mSv | NASA-STD-3001 Vol. 1 (2022+); every conjunction-class mission exceeds it |
| Chemical Isp | 460 s | Aerojet Rocketdyne RL10 (B-2: 465.5 s; C-3 ≈ 460 s) |
| NTR Isp | 900 s (875 s best ground test, Pewee 1, 1968) | DRA 5.0 design value; National Academies (2021) Table 2.1 |
| Starship ship Isp, tanks | 380 s, 1,200 t | ESTIMATE: commonly reported (secondary sources); SpaceX publishes no Raptor Isp, and its page lists 1,500–1,600 t for upgraded ships |
| Starship launcher | 100–150 t LEO (100 t used), 7,590 tf | SpaceX Starship page (later revisions: 8,240 tf); Starship Users Guide Rev 1.0 (2020) |
| SLS Block 1 | 95 t LEO, 8.8 Mlbf, ≈ $2.2 B | NASA SLS reference; NASA OIG IG-22-003 |
| SLS Block 2 (planned) | 130 t LEO, 9.5 Mlbf | NASA SLS fact sheets (2015, 2023); JANNAF 2024 |
| RS-25 Isp | 366 s SL / 452 s vac | Aerojet Rocketdyne / L3Harris RS-25 spec sheet |
| Falcon Heavy (expendable) | 63.8 t LEO, 22,819 kN | SpaceX Falcon Heavy page |
| New Glenn | 45 t LEO, 7 × 2,450 kN BE-4 | Blue Origin New Glenn and BE-4 pages (7×2 baseline; Nov 2025 BE-4 upgrade to 4.5 Mlbf and 9×4 variant not modelled) |
| O₂ | 0.895 kg/crew-day | NASA BVAD Rev2 (NASA/TP-2015-218570/REV2), Table 3-31 |
| Water | 3.2 (transit) / 4.48 (surface) kg/crew-day | NASA BVAD Rev2, Table 4-20 |
| Food | 2.39 kg/crew-day incl. packaging | NASA BVAD Rev2 text under Table 3-31 (Table 4-47, Ewert et al. 2019) |
| Water recovery | 93 % used (93–94 % pre-BPA, 98 % demonstrated 2023) | NASA, "NASA Achieves Water Recovery Milestone on ISS" (2023) |
| O₂ recovery | 50 % used | NASA Exploration ECLSS (Sabatier limit ≈ 50 %), ICES-2021-384 |
| Comms blackout length | up to ≈ 14 days | NASA/JPL solar-conjunction command moratoria |

### Estimates that move the results (open questions)

| Parameter | Value used | Why it matters |
|---|---|---|
| Chemical / NTR stage dry mass | 30 t / 70 t (both 300 t wet) | Sets each vehicle's Δv capacity in "fastest" mode |
| Starship dry mass | 120 t | Unpublished. Public estimates span 100–150 t. |
| Starship entry-speed limit | 7.5 km/s | Caps Starship's fastest transit |
| Starship / Falcon Heavy (expendable) / New Glenn cost per launch | $150 M / $150 M / $110 M | No published prices for these configurations |
| SLS Block 2 cost per launch | $2.5 B | NASA OIG IG-24-001 (Oct 2023): Block 1B "at least $2.5 billion" to produce, used as a floor |
| Raptor Isp (327 / 350 s), Merlin 1D Isp (282 / 311 s) | display only | Not published by SpaceX; commonly cited figures. BE-4 Isp is unpublished and shown as null. |
| Hardware costs | $1.0 B / $3.0 B / $0.2 B | Development excluded. NTR development would add several $B. |
| Habitat mass | 15 t + 4.5 t per crew | Same for all vehicles, scaled from the DRA 5.0 transit habitat |
| Recycling closure | water 93 %, O₂ 50 % | ASSUMPTION; adjustable via `closure` |
| Reliability figures | 0.95–0.995 per event; launches 0.95–0.99 by launcher class; EDL 0.98 | Heuristic only |
| Radiation score scale | full at 0.8 Sv, zero at 1.4 Sv | Design choice spanning the doses conjunction-class missions reach |
| Re-flight delay | 30 days per re-flight | ASSUMPTION |
| Event odds | see `events.js` | Gameplay model |
