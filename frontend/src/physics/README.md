# Physics engine

A small, dependency-free JavaScript model of a crewed Earth → Mars transfer.
Every number the UI shows comes from `simulateMission()`. The modules are pure
functions with no React. They work in SI units (m, s, kg, m/s, Sv, USD) and
convert only for display (`units.js`).

```js
import { simulateMission, launchWindows } from './physics';

const [next] = launchWindows({ after: new Date(), count: 1 });
const result = simulateMission({
  vehicle: 'nuclear',                // 'chemical' | 'nuclear' | 'starship' | custom vehicle object
  crewSize: 4,
  launchDate: next.departureDate,    // any date near the window you want
  transferChoice: { kind: 'fastest' }, // or { kind: 'hohmann' } or { kind: 'timeOfFlight', timeOfFlight: seconds }
  riskTolerance: 5,                  // 1 (12 % Δv reserve) … 10 (2 % reserve)
});
```

## Modules

| File | What it does |
|---|---|
| `constants.js` | μ, radii, orbits, J2000 orbital elements, parking/capture orbits, radiation dose rates. Every value is sourced. |
| `orbits.js` | Two-body relations, Hohmann transfer, patched-conic departure/capture burns, entry speed, faster tangential-departure transfers, arc length. |
| `ephemeris.js` | Planet positions from mean elements (Kepler's equation), launch-window phasing, conjunction-class surface stay. |
| `rocket.js` | Tsiolkovsky equation, propellant for a Δv, max Δv, launch counting. |
| `vehicles.js` | The three reference vehicles plus `createCustomVehicle()`. Estimates are flagged `ESTIMATE` in comments. |
| `mission.js` | `simulateMission()`, crew payload, Δv margin, and the two heuristics (success, crew health). |
| `tradeoffs.js` | Picks the best vehicle per metric. Used to generate neutral UI copy with no built-in winner. |
| `units.js` | Display conversions. |

## The model

1. **Launch window.** Earth and Mars are placed with JPL mean orbital
   elements (Mars on its real eccentric orbit, 1.38–1.67 AU). The departure
   date is solved so the transfer arrives exactly where Mars will be. The
   computed windows (Nov 2026, Dec 2028, Jan 2031, Mar 2033, Jul 2035) match
   the published ones.
2. **Heliocentric transfer.** The ship leaves Earth's orbit tangentially. At
   one extreme, the Hohmann-type transfer is also tangent at Mars' orbit
   (180°). Faster transfers raise the apoapsis, so the ship crosses Mars'
   orbit early and at an angle. That buys time at the cost of higher v∞ at
   both ends.
3. **Patched conics.** Earth departure is a periapsis burn from a 400 km
   circular LEO to the required v∞. Mars capture is either a periapsis burn
   into the DRA 5.0 250 km × 33,793 km 1-sol ellipse (chemical, NTR), or
   aerocapture (Starship), with v∞ capped by a 7.5 km/s entry-speed limit.
4. **Propellant.** Burnout mass = vehicle stage dry mass + common crew
   payload (habitat + crew + consumables for the transit and 30 contingency
   days). Propellant comes from the rocket equation for the planned Δv
   (required × (1 + risk margin)). A transfer is infeasible if it needs more
   propellant than the tanks hold.
5. **Transfer choice.**
   - `hohmann` and `timeOfFlight`: every vehicle flies the identical trajectory.
   - `fastest`: each vehicle flies the fastest transfer that one full tank
     load (minus the margin) can deliver, found by bisection on transit time.
     This is how higher performance turns into a shorter trip.
6. **Launches and cost.** Chemical and NTR stacks are assembled in LEO from
   SLS-class launches (105 t, about $2.2 B each). Starship counts 1 ship
   launch + tanker flights (150 t of propellant each, estimated). Cost =
   propulsion hardware + launches. Development costs are excluded.
7. **Radiation.** Dose = measured rate × time. Cruise uses 1.84 mSv/day
   (Curiosity RAD), the surface 0.64 mSv/day. The round trip is
   conjunction-class: the return leg mirrors the outbound one, and the surface
   stay is whatever wait the planets' phasing requires (≈ 454 d for Hohmann).
   Career fraction is measured against NASA's 600 mSv limit.

### Heuristics (simplified, not rigorous)

- **Success probability** = p_launch^N × p_dock^(N−1) × p_burn^burns × p_aerocapture × p_margin,
  with p_margin = 1 − 0.10·e^(−margin/0.04). The per-event reliabilities
  (0.95–0.995) are assumptions chosen to reflect flight heritage, not data.
  The model assumes every launch must succeed (no spares), which penalises
  many-launch architectures.
- **Crew-health index** = 100 − 25 × (mission dose / 600 mSv) − 1 per month
  weightless. This is purely illustrative and shows the direction of two real
  effects.

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

Monotonicity tests: more crew → more mass, faster transfer → more Δv and
less transit dose, higher Isp → less propellant (and, at equal stage mass, a
shorter "fastest" transit). Invalid input throws `TypeError`/`RangeError`.

## Assumptions and simplifications

- **Coplanar orbits.** Inclination is ignored (Mars is 1.85° off the
  ecliptic). The reference Hohmann numbers use circular orbits. The window
  model uses eccentric orbits with mean elements (valid 1800–2050).
- **One-parameter fast-transfer family.** Tangential departure isn't
  Δv-optimal for a given time. A full Lambert/porkchop search would do
  somewhat better, especially at Mars arrival, so fast-transfer Δv here is
  conservative (high). On eccentric Mars, the 180° Hohmann-type transfer is
  not always the cheapest. In some windows (e.g. 2035) a slightly faster
  transfer that meets Mars nearer perihelion costs less.
- **Impulsive burns.** Gravity losses and finite burn time are ignored.
  Electric propulsion can't be represented and is rejected.
- **Outbound propulsion only.** The return leg affects duration and dose,
  but its propellant is assumed pre-deployed or made on Mars (as in DRA 5.0).
- **Shielding.** All vehicles use the RAD (MSL cruise-stage) dose rate,
  shielding factor 1. Solar-cycle modulation and solar particle events are
  not modelled.
- **No boil-off.** Long-duration cryogenic storage losses (LH₂ especially)
  are ignored. This flatters chemical and NTR.

## Sources

| Quantity | Value | Source |
|---|---|---|
| AU, μ_sun | 1.495978707e11 m, 1.32712440018e20 m³/s² | IAU 2012 B2; IAU 2015 B3 / JPL DE430 |
| μ, radius: Earth / Mars | 3.986004418e14, 6378.137 km / 4.282837e13, 3396.2 km | WGS84; NASA NSSDC Mars fact sheet |
| Orbit radii, periods | 149.598 / 227.956 × 10⁶ km; 365.256 / 686.98 d | NASA NSSDC fact sheets |
| Planet positions | J2000 mean elements + rates | Standish, JPL SSD "Keplerian Elements for Approximate Positions of the Major Planets" |
| Mars capture orbit | 250 × 33,793 km (1 sol) | NASA DRA 5.0, NASA-SP-2009-566 |
| Cruise dose rate | 1.84 mSv/day | Zeitlin et al., Science 340, 1080 (2013) |
| Surface dose rate | 0.64 mSv/day | Hassler et al., Science 343 (2014) |
| Career limit | 600 mSv | NASA-STD-3001 Vol. 1 (2022+) |
| Chemical Isp | 460 s | Aerojet Rocketdyne RL10 (B-2: 465.5 s; C-3 ≈ 460 s) |
| NTR Isp | 900 s (≈ 850 s demonstrated) | DRA 5.0 design value; Rover/NERVA ground tests |
| Starship Isp, tanks | 380 s, 1,200 t | SpaceX Starship published figures |
| SLS capacity / cost | 105 t LEO / ≈ $2.2 B | NASA SLS reference; NASA OIG IG-22-003 (2022) |
| Consumables | 5 kg/crew-day (planning value) | Derived from NASA BVAD, NASA/TP-2015-218570 |

### Estimates that move the results (open questions)

| Parameter | Value used | Why it matters |
|---|---|---|
| Chemical / NTR stage dry mass | 30 t / 70 t (both 300 t wet) | Sets each vehicle's Δv capacity in "fastest" mode |
| Starship dry mass | 120 t | Unpublished. Public estimates span 100–150 t. |
| Starship entry-speed limit | 7.5 km/s | Caps Starship's fastest transit |
| Starship tanker load / launch cost | 150 t / $150 M | Drives Starship launch count and cost |
| Hardware costs | $1.0 B / $3.0 B / $0.2 B | Development excluded. NTR development would add several $B. |
| Habitat mass | 15 t + 4.5 t per crew | Same for all vehicles, scaled from the DRA 5.0 transit habitat |
| Reliability figures | 0.95–0.995 per event | Heuristic only |
