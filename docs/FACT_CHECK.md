# Fact check: physics engine

**Date checked:** 2026-11-20. **Scope:** every physical constant, vehicle and
launcher figure, life-support rate, dose rate and limit, launch-window date,
cost and heuristic used by the physics engine (`frontend/src/physics/`, which
is the source of truth, and its Python mirror `backend/app/physics/`, which
matches it bit for bit through `shared/golden_cases.json`).

**Status key**

| Status | Meaning |
|---|---|
| Verified | Matches the primary source named. |
| Estimate (flagged) | Not published by the operator or program. It is the author's estimate within the range of public reporting, marked `ESTIMATE` in the code and listed in the physics README. |
| Heuristic (flagged) | A modelling or gameplay choice, not data. Marked `HEURISTIC`, `GAMEPLAY` or `ASSUMPTION` in the code. |
| Removed | A claim or value the engine used to make and no longer does (kept here so the change is traceable). |

**How checked:** "fetched" means the source was opened and the figure read on
2026-11-20 during this pass. "cited" means the code cites the primary source
for this value and it was not re-fetched in this pass (the value is a
standard, widely reproduced figure). "computed" means the engine computes the
value and a test compares it with the reference.

## 1. Physical constants and orbits (`constants.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| Standard gravity g₀ | 9.80665 m/s² | CGPM 1901 (exact by definition), [BIPM SI Brochure](https://www.bipm.org/en/publications/si-brochure) | Verified | cited |
| Astronomical unit | 1.495978707 × 10¹¹ m (exact) | [IAU 2012 Resolution B2](https://www.iau.org/static/resolutions/IAU2012_English.pdf) | Verified | cited |
| Day / Julian year | 86,400 s / 365.25 d | SI / IAU definition | Verified | cited |
| μ Sun | 1.32712440018 × 10²⁰ m³/s² | [IAU 2015 Resolution B3](https://www.iau.org/static/resolutions/IAU2015_English.pdf); JPL DE430 | Verified | cited |
| μ Earth | 3.986004418 × 10¹⁴ m³/s² | WGS84, NGA TR8350.2 (Department of Defense World Geodetic System 1984) | Verified | cited |
| μ Mars | 4.282837 × 10¹³ m³/s² (42,828.37 km³/s²) | [NASA NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) (0.042828 × 10⁶ km³/s²) | Verified | fetched |
| Earth equatorial radius | 6,378.137 km | WGS84 | Verified | cited |
| Mars equatorial radius | 3,396.2 km | [NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Verified | fetched |
| Earth semi-major axis | 149.598 × 10⁶ km | [NSSDC Earth fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) | Verified | cited |
| Mars semi-major axis | 227.956 × 10⁶ km | [NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Verified | fetched |
| Earth sidereal period | 365.256 d | [NSSDC Earth fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) | Verified | cited |
| Mars sidereal period | 686.980 d | [NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Verified | fetched |
| J2000 mean elements and rates (Earth–Moon barycentre, Mars) | a, e, L, ϖ and rates as in `constants.js` (Mars e = 0.0933941) | E. M. Standish, [JPL SSD "Approximate Positions of the Planets"](https://ssd.jpl.nasa.gov/planets/approx_pos.html), Table 1 (1800–2050) | Verified | cited (Mars e agrees with NSSDC 0.0935, fetched) |
| Inclination ignored | Mars 1.85° to the ecliptic | [NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Heuristic (flagged) | simplification, README |
| Departure parking orbit | 400 km circular LEO | ISS-like altitude; no source | Heuristic (flagged) | `ASSUMPTION` in code |
| Mars capture orbit | 250 km × 33,793 km (1-sol ellipse) | NASA DRA 5.0, [NASA-SP-2009-566](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf) | Verified | cited |
| Mars entry interface | 125 km | Common convention | Heuristic (flagged) | code comment |

## 2. Radiation (`constants.js`, `mission.js`, `events.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| Deep-space GCR dose-equivalent rate (behind MSL cruise shielding) | 1.84 mSv/day | Zeitlin et al., Science 340, 1080 (2013), [doi:10.1126/science.1235989](https://doi.org/10.1126/science.1235989): 1.84 ± 0.33 mSv/day | Verified | cited; JPL/SwRI releases (fetched) round it to 1.8 mSv/day |
| Mars surface dose-equivalent rate | 0.64 mSv/day | Hassler et al., Science 343 (2014), [doi:10.1126/science.1244797](https://doi.org/10.1126/science.1244797): 0.64 ± 0.12 mSv/day | Verified | cited |
| Career effective-dose limit | 600 mSv, all astronauts | NASA-STD-3001 Vol. 1; [NASA OCHMO radiation technical brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) (universal 600 mSv, 3 % REID basis); recommended by [NASEM 2021](https://www.nationalacademies.org/read/26155/chapter/5) | Verified | fetched |
| **Every conjunction-class mission exceeds the 600 mSv limit** | Model: 0.84–1.26 Sv for the reference vehicles across all five windows (unshielded); the engine sets `dose.exceedsCareerLimit` and adds a `career-limit` framing note | Rates above × durations; cross-check: Hassler et al. 2014 estimate ≈ 1.01 Sv for 180 d + 500 d + 180 d, the model gives ≈ 0.98 Sv for those durations; SwRI/EGU 2014: ≈ 0.66 Sv for the round-trip cruise alone | Verified | computed (test `radiation score is live`) |
| Solar particle event dose per event | 1.2–19.5 mSv | RAD cruise SPEs, Hassler, NOAA Space Weather Workshop 2016; Zeitlin et al. 2013 | Verified | cited |
| SPE odds | 0.01 per cruise day | Grounded on 5 SPEs in ≈ 221 cruise days near solar max (Zeitlin et al. 2013), halved for a cycle average | Heuristic (flagged) | `GAMEPLAY ODDS` in code |
| Shielding factor 1 for all reference vehicles | MSL cruise-stage shielding | Modelling choice | Heuristic (flagged) | README |
| Radiation score scale | full at ≤ 0.8 Sv, zero at ≥ 1.4 Sv | Design choice spanning reachable doses (see §7) | Heuristic (flagged) | test |

## 3. In-space stages (`vehicles.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| Chemical stage Isp | 460 s | L3Harris/Aerojet Rocketdyne RL10 data: RL10B-2 465.5 s, RL10C-3 ≈ 460 s (L3Harris RL10 data sheets) | Verified | cited |
| Chemical stage dry mass | 30 t on a 300 t wet stage | Centaur-class inert fractions ≈ 8–10 % plus engines and cryo insulation | Estimate (flagged) | `ESTIMATE` |
| Chemical / NTR wet mass | both 300 t | Fairness rule (same tank size) | Heuristic (flagged) | code header |
| NTR Isp | 900 s | NASA DRA 5.0 design value, [NASA-SP-2009-566-ADD](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf) | Verified | cited |
| Best NTR ground test | Pewee 1 (1968): 875 s ideal vacuum Isp; Rover/NERVA tests ≈ 810–875 s | [National Academies, Space Nuclear Propulsion for Human Mars Exploration (2021), Table 2.1](https://www.nationalacademies.org/read/25977/chapter/4) | Verified | fetched. The requested "Pewee 845 s (LANL report)" figure could not be confirmed: the LANL PDFs (LA-10062-H, Durham et al.) are scanned and unreadable here, and other sources give 838–875 s depending on definition, so the NASEM table value is cited. |
| No NTR has flown | — | NASEM 2021 (above) | Verified | fetched |
| NTR dry mass | 70 t | Three ≈ 3.5 t engines, shields, heavy LH₂ tankage | Estimate (flagged) | `ESTIMATE` |
| Starship ship Isp (Raptor Vacuum) | 380 s | Not published by SpaceX; commonly reported in secondary sources | Estimate (flagged) | was cited to SpaceX; corrected this pass |
| Starship ship propellant | 1,200 t | Block 1 figure from secondary sources. SpaceX's vehicle page lists 1,500 t (later ≈ 1,600 t) for upgraded ships; the lower figure is kept as the conservative choice | Estimate (flagged) | corrected this pass |
| Starship dry mass | 120 t | Unpublished; public estimates ≈ 100–150 t | Estimate (flagged) | `ESTIMATE` |
| Starship Mars entry-speed limit | 7.5 km/s | SpaceX public statements; not demonstrated | Estimate (flagged) | `ESTIMATE` |
| Hardware cost: chemical / NTR / Starship / custom | $1.0 B / $3.0 B / $0.2 B / $2.0 B | No published figures; development excluded | Estimate (flagged) | `ESTIMATE` |
| TRL: chemical / NTR / Starship | 9 / 5 / 7 | Author's assessment | Heuristic (flagged) | code |
| Burn reliability: chemical / NTR / Starship | 0.99 / 0.95 / 0.97 per burn | Flight heritage ranking | Heuristic (flagged) | `heuristic` |
| Docking / propellant-transfer reliability | 0.995 (assembled), 0.99 (Starship transfer) | ISS docking heritage; ship-to-ship transfer at scale undemonstrated | Heuristic (flagged) | `heuristic` |
| Aerocapture reliability | 0.97 | Crewed-scale Mars aerocapture never attempted | Heuristic (flagged) | `heuristic` |
| Custom burn reliability default | 0.99 − 0.01 × (9 − TRL) | TRL-based rule of thumb | Heuristic (flagged) | code |
| Capture method: propulsive (chemical, NTR) vs aerocapture (Starship) | — | Architecture choice: DRA 5.0 also studied a "Chemical/Aerocapture" crew option and kept chemical/aerobrake as backup to NTR ([SP-2009-566](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf), [DRA 5.0 executive summary](https://www.nasa.gov/pdf/373669main_2008-12-04_Mars_DRA5_Executive_Summary-Presentation.pdf)). The engine now says so in `framing` (`capture-method`) | Heuristic (flagged) | search result excerpts of both documents |

## 4. Launch vehicles (`launchVehicles.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| Starship payload to LEO | 100 t used (SpaceX lists 100–150 t) | [SpaceX Starship page](https://www.spacex.com/vehicles/starship/); Starship Users Guide Rev 1.0 (March 2020): "100+" t | Verified | search excerpts (page is a JavaScript app and could not be fetched as text) |
| Super Heavy thrust | 7,590 tf (display only) | SpaceX Starship page (older revision); later revision lists 8,240 tf | Verified | search excerpts |
| Raptor sea-level / vacuum-nozzle Isp | 327 / 350 s (display only) | Not published by SpaceX | Estimate (flagged) | `ESTIMATE` |
| Starship cost per launch | $150 M | No published price | Estimate (flagged) | `ESTIMATE` |
| SLS Block 1 payload to LEO | 95 t | NASA SLS reference guide / fact sheets ("more than 95 t") | Verified | cited |
| SLS Block 1 thrust | 8.8 Mlbf | NASA SLS fact sheet | Verified | cited |
| RS-25 Isp | 366 s SL / 452 s vac | L3Harris RS-25 data sheet | Verified | cited |
| SLS Block 1 cost per launch | ≈ $2.2 B | [NASA OIG IG-22-003](https://oig.nasa.gov/docs/IG-22-003.pdf) (15 Nov 2021) | Verified | fetched (IG-24-001 footnote 20 confirms: "IG-22-003 … projected a $2.2 billion cost per SLS rocket") |
| SLS Block 1B production cost | at least $2.5 B | [NASA OIG IG-24-001](https://oig.nasa.gov/docs/IG-24-001.pdf) (12 Oct 2023): "a single SLS Block 1B will cost at least $2.5 billion to produce" | Verified | fetched. Previously mis-cited to IG-22-003; corrected. |
| SLS Block 2 cost per launch | $2.5 B | No published Block 2 figure; IG-24-001 Block 1B cost used as a floor | Estimate (flagged) | `ESTIMATE` |
| SLS Block 2 payload / thrust | 130 t / 9.5 Mlbf | NASA SLS fact sheets (2015, June 2023); JANNAF 2024 | Verified | cited |
| SLS flight record | Artemis I (Nov 2022), Artemis II crewed (1 Apr 2026), both successful | [NASA Artemis II launch release](https://www.nasa.gov/news-release/liftoff-nasa-launches-astronauts-on-historic-artemis-moon-mission/) | Verified | search |
| Falcon Heavy (expendable) payload / thrust | 63.8 t / 22,819 kN | [SpaceX Falcon Heavy page](https://www.spacex.com/vehicles/falcon-heavy/) | Verified | cited (page could not be fetched as text) |
| Merlin 1D Isp | 282 / 311 s (display only) | Not currently published by SpaceX | Estimate (flagged) | `ESTIMATE` |
| Falcon Heavy expendable cost | $150 M | SpaceX lists ≈ $97 M reusable; expendable price unpublished | Estimate (flagged) | `ESTIMATE` |
| New Glenn payload to LEO | 45 t (7×2 baseline) | [Blue Origin New Glenn page](https://www.blueorigin.com/new-glenn) | Verified | search excerpt |
| BE-4 thrust | 7 × 2,450 kN (550 klbf) | Blue Origin BE-4 page | Verified | cited |
| New Glenn upgrades | BE-4 upgrade: first stage 3.9 → 4.5 Mlbf from the third flight; 9×4 variant 70 t to LEO, no date (announced 20 Nov 2025). Not modelled | [Blue Origin news, 20 Nov 2025](https://www.blueorigin.com/news/new-glenn-upgraded-engines-subcooled-components-drive-enhanced-performance) | Verified | search excerpts (page rate-limited) |
| New Glenn status | 3 flights (Jan 2025, Nov 2025, 19 Apr 2026). NG-3 left its payload in a lower orbit; pad hotfire anomaly 28 May 2026; return to flight targeted end of 2026 | Blue Origin news; [Space.com NG-3](https://www.space.com/space-exploration/launches-spacecraft/blue-origin-reuses-new-glenn-rocket-landing-success-1st-time-on-april-19-2026-video); [AIAA, 3 Jun 2026](https://aiaa.org/2026/06/03/after-launch-pad-setback-blue-origin-eyes-new-glenn-return-in-2026/) | Verified | search |
| New Glenn cost per launch | $110 M | No published price | Estimate (flagged) | `ESTIMATE` |
| Launch reliability by class | proven 0.99 (Falcon Heavy), limited 0.97 (SLS Block 1, New Glenn), planned 0.96 (SLS Block 2), flight-test 0.95 (Starship) | Ranking by flight record; mature launchers succeed ≈ 98–99+ % of the time. Exposed in `successFactors` and `launchVehicle.reliabilityClass` | Heuristic (flagged) | new this pass |

## 5. Life support (`lifeSupport.js`, `mission.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| O₂ consumed | 0.895 kg/crew-day | NASA BVAD Rev2, NASA/TP-2015-218570/REV2 (Feb 2022), Table 3-31, [NTRS 20210024855](https://ntrs.nasa.gov/citations/20210024855) | Verified | cited |
| Water, transit | 3.2 kg/crew-day | BVAD Rev2 Table 4-20 (Transit Vehicle) | Verified | cited |
| Water, surface | 4.48 kg/crew-day | BVAD Rev2 Table 4-20 (Early Planetary Base) | Verified | cited |
| Food incl. packaging | 2.39 kg/crew-day | BVAD Rev2 text under Table 3-31 (Table 4-47; Ewert et al. 2019) | Verified | cited |
| Water recovery used | 93 % (98 % demonstrated with BPA in 2023) | [NASA, "NASA Achieves Water Recovery Milestone on ISS" (2023)](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) | Heuristic (flagged) | search (93–94 % pre-BPA and 98 % with BPA confirmed); 93 % is an `ASSUMPTION` |
| O₂ recovery used | 50 % | Sabatier limit ≈ 50 % (CH₄ carries away H₂); [ICES-2021-384](https://ntrs.nasa.gov/citations/20210015025), [ICES-2020 O₂ recovery trade](https://ntrs.nasa.gov/api/citations/20205004679/downloads/ICES-2020_Abney_O2ReTrade_FINAL%20MANUSCRIPT.pdf) | Verified | search excerpts |
| Contingency consumables | 30 days | Planning reserve | Heuristic (flagged) | `ASSUMPTION` |
| Crew range | 2–8 | Model scope | Heuristic (flagged) | code |
| Habitat mass | 15 t + 4.5 t per crew (42 t at 6) | Scaled from the DRA 5.0 ≈ 40 t-class transit habitat | Estimate (flagged) | `ESTIMATE` |
| Crew mass | 100 kg per person (body + kit) | — | Estimate (flagged) | `ESTIMATE` |
| Surface and return consumables pre-deployed | — | DRA 5.0 split-mission architecture | Heuristic (flagged) | README |

## 6. Launch windows (`windows.js`, `ephemeris.js`)

| Claim | Value | Primary source | Status | How checked |
|---|---|---|---|---|
| Window departures (minimum-energy) | 4 Nov 2026, 6 Dec 2028, 16 Jan 2031, 30 Mar 2033, 8 Jul 2035 | Computed from the ephemeris; fall in the published window months (NASA/JPL window lists) | Verified | computed (`windows.test.js`) |
| Mars oppositions | 19 Feb 2027, 25 Mar 2029, 4 May 2031, 28 Jun 2033 (UTC), 15 Sep 2035 | Published lists ([IMCCE](https://promenade.imcce.fr/en/pages6/887.html), [in-the-sky.org](https://in-the-sky.org/article.php?term=Mars)): 19 Feb 2027, 25 Mar 2029, 4 May 2031, 27 Jun 2033 (US time; 28 Jun UT), 15 Sep 2035 | Verified | search |
| Synodic period | 779.9 d (model) vs 780 d | Textbook | Verified | computed |
| Hohmann conjunction stay | 454 d (model) vs ≈ 450–460 d | Textbook / DRA 5.0 | Verified | computed |
| Minimum surface stay | 30 d floor in the stay solver | Modelling choice | Heuristic (flagged) | code |
| Default window `2028-12` | 2027 window already open on 2026-11-20 | Date of writing | Verified | — |

## 7. Heuristics and gameplay (`success.js`, `events.js`, `scoring.js`, `mission.js`)

| Claim | Value | Basis | Status |
|---|---|---|---|
| Mars EDL reliability | 0.98, all architectures | Same lander assumption | Heuristic (flagged) |
| Δv-margin reliability | 1 − 0.10·e^(−margin/0.04) | Shape choice | Heuristic (flagged) |
| Re-flight delay | 30 d per expected re-flight | Return-to-flight stand-downs range from weeks to months | Heuristic (flagged) |
| Δv margin from risk slider | 12 % (risk 1) → 2 % (risk 10) | Typical design margins span a few % to ≈ 10 % | Heuristic (flagged) |
| Event risk factor | 0.5 (risk 1) → 2.0 (risk 10) | Gameplay | Heuristic (flagged) |
| Engine fault | 0.03 per burn; 1–5 % of the burn's Δv | Gameplay | Heuristic (flagged) |
| Micrometeoroid | 0.001 per day; 10–100 kg consumables lost | Gameplay | Heuristic (flagged) |
| Comms blackout | 0.002 per day; 1–14 days | Magnitude grounded on ≈ 2-week solar-conjunction moratoria (NASA/JPL) | Heuristic (flagged) |
| Crew-health index | 100 − 25 × dose/0.6 Sv − 1 per weightless month | Illustrative; direction from LeBlanc et al. 2000 (1.0–1.6 %/month hip BMD loss) | Heuristic (flagged) |
| Score weights | success 300, radiation 200, propellant 150, cost 150, transit 200 | Design choice | Heuristic (flagged) |
| Cost score | full ≤ $1 B, zero ≥ $30 B, logarithmic | Design choice | Heuristic (flagged) |
| Transit score | full ≤ 120 d, zero ≥ 330 d | Design choice | Heuristic (flagged) |
| Radiation score | full ≤ 0.8 Sv, zero ≥ 1.4 Sv, linear | Spans reachable doses: 0.8 Sv is just below the lowest unshielded mission in the model, 1.4 Sv above the slowest plus several SPEs | Heuristic (flagged) |
| Grades | A+ ≥ 900, A ≥ 800, B ≥ 650, C ≥ 500, D ≥ 350 | Design choice | Heuristic (flagged) |
| Achievements | Fuel Miser (≤ 2 % over Hohmann propellant), Perfect Window, Radiation Rookie (< 0.9 Sv), Shielded (factor ≤ 0.75), Heavy Lifter (> 500 t), Speed Demon (< 180 d), Full Crew (8), Risk Taker Survives (risk ≥ 8, events on, no abort) | Each is pinned to an input that earns it (`scoring.test.js`, `test_reality_check.py`) | Heuristic (flagged) |

## 8. Removed or corrected claims

| Former claim | Problem | Now | Status |
|---|---|---|---|
| SLS Block 1B "$2.5 B" attributed to IG-22-003 | The figure is from IG-24-001 (Oct 2023) | Cited to IG-24-001; IG-22-003 kept for $2.2 B | Removed (corrected) |
| Raptor Vacuum 380 s and 1,200 t cited to SpaceX | SpaceX publishes no Raptor Isp, and its page lists 1,500–1,600 t, not 1,200 t; contradicted `launchVehicles.js` ("SpaceX does not publish Raptor Isp") | Both marked ESTIMATE (secondary sources) in `vehicles.js` and the README | Removed (corrected) |
| NTR ground tests "≈ 825–850 s (Pewee, NRX/XE)" | Imprecise; XE-Prime was only tested to ≈ 710 s | Pewee 1, 875 s; series ≈ 810–875 s (NASEM 2021 Table 2.1) | Removed (corrected) |
| Radiation score "200 × (1 − dose / 600 mSv)" | Every conjunction-class mission exceeds 600 mSv, so it was always 0 | 0.8–1.4 Sv scale, plus `dose.exceedsCareerLimit` and a `career-limit` note | Removed |
| Radiation Rookie "< 300 mSv" | Unreachable (surface stay alone ≈ 250–500 mSv) | < 0.9 Sv, reachable (e.g. NTR fastest, 2035 window: 0.84 Sv) | Removed |
| One launch reliability (0.99) for every launcher | Ignored that Starship is in flight test and SLS Block 2 has never flown | Per-class heuristic (§4) | Removed |
| "SLS Block 1: flown on Artemis I" only | Out of date | Artemis I (2022) and crewed Artemis II (April 2026) | Removed (updated) |
| Phase 1: SLS 105 t to LEO | 105 t is Block 1B | 95 t Block 1 (earlier phase) | Removed |
| Phase 1: per-month bone-loss percentage in the UI | Unsourced | Not shown; crew-health index only | Removed |

## UI claims (to be audited after Phase 5)

Known UI copy that still repeats corrected engine claims (outside this pass's
scope, for the Phase 5 audit):

- `frontend/src/components/debrief/Insights.jsx` lines 81–82: "Rover/NERVA
  ground tests (≈ 850 s)", "SpaceX Starship (1,200 t, Raptor Vac ≈ 380 s)" as
  a SpaceX source.
- `frontend/src/model/catalog.js` lines 301 and 308: "≈ 850 s demonstrated in
  ground tests"; "Isp 380 s · 1,200 t tanks" without the estimate flag.
