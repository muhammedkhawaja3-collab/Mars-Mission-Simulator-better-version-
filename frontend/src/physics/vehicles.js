/**
 * In-space propulsion stages for the three reference architectures.
 *
 * Every vehicle carries the same crew payload (habitat, crew, consumables),
 * which mission.js adds on top of `stageDryMass`. Only the propulsion
 * differs. All three are fuelled in low Earth orbit (LEO) before departure.
 *
 * A stage is lifted to LEO by a launch vehicle (launchVehicles.js):
 *   - launchMode 'assembled' (chemical, nuclear, custom): the whole stack is
 *     split across ceil(stack mass / launcher payload) launches of any
 *     launcher and docked in LEO.
 *   - launchMode 'tanker' (Starship): the ship launches on Super Heavy with the
 *     crew payload, then Starship tankers refill it. Only the Starship
 *     launcher is compatible.
 *
 * Numbers marked ESTIMATE are not published by any program. They are the
 * author's engineering estimates, chosen to fall within the range of public
 * sources, and they move the results. The README lists them as open
 * assumptions.
 *
 * Fairness rule for the two "assembled in LEO" vehicles: the chemical and
 * nuclear stages are both sized to the SAME 300 t wet mass, so the comparison
 * isolates the Isp-vs-dry-mass trade instead of who got the bigger tank.
 *
 * SI units: kg, s, m/s, USD.
 *
 * Sources:
 *   [RL10]  Aerojet Rocketdyne RL10B-2 data sheet: vacuum Isp 465.5 s
 *           (RL10C-3 ≈ 460 s).
 *   [DRA5]  NASA-SP-2009-566 and -ADD: NTR crew vehicle with three ~25 klbf
 *           engines, Isp ≈ 900 s assumed.
 *   [NERVA] National Academies, "Space Nuclear Propulsion for Human Mars
 *           Exploration" (2021), Table 2.1: Rover/NERVA ground tests 1955–1972
 *           reached ideal vacuum Isp of ≈ 810–875 s; the best was Pewee 1
 *           (1968), 875 s. No NTR has flown.
 *   [SS-EST] ESTIMATE, commonly reported in secondary sources (not published
 *           by SpaceX): Raptor Vacuum Isp ≈ 380 s and ≈ 1,200 t of propellant in
 *           the Block 1 ship. SpaceX's vehicle page lists 1,500 t (later
 *           ≈ 1,600 t) for upgraded ships; the lower Block 1 figure is kept as
 *           the conservative choice, like the 100 t payload in launchVehicles.js.
 * Launch-vehicle figures (payload to LEO, cost per launch) live in
 * launchVehicles.js with their own sources.
 */

/**
 * @typedef {object} Vehicle
 * @property {string} id
 * @property {string} name
 * @property {string} engine              Engine description, for display.
 * @property {number} isp                 Vacuum specific impulse [s].
 * @property {number} stageDryMass        Propulsion system + structure, excluding the common crew payload [kg].
 * @property {number} propellantCapacity  Maximum propellant load [kg].
 * @property {'propulsive'|'aerocapture'} marsCapture How the vehicle stops at Mars.
 * @property {number} [maxEntrySpeed]     For aerocapture, the heat-shield entry-speed limit [m/s].
 * @property {number} gcrShieldingFactor  Multiplier on the deep-space GCR dose rate (1 = MSL-like shielding).
 * @property {'assembled'|'tanker'} launchMode How the stack reaches LEO (see file header).
 * @property {string} defaultLaunchVehicle Launch-vehicle id used when none is chosen.
 * @property {string[]|null} compatibleLaunchVehicles Allowed launch-vehicle ids, or null for any.
 * @property {number} hardwareCost        Production cost of the propulsion hardware, excluding development [USD].
 * @property {number} trl                 Technology Readiness Level of the propulsion system (1–9).
 * @property {number} burnReliability     Heuristic probability that each major burn succeeds.
 * @property {number} operationReliability Heuristic probability that each docking/propellant transfer in LEO succeeds.
 * @property {number} [aerocaptureReliability] Heuristic probability that Mars aerocapture succeeds.
 * @property {string} color               UI colour.
 * @property {string[]} notes             Plain-language caveats shown in the README/UI.
 */

/** Launch settings for stacks assembled in LEO from several launches (any launcher). */
const ASSEMBLED = Object.freeze({
  launchMode: 'assembled',
  defaultLaunchVehicle: 'sls-block1',
  compatibleLaunchVehicles: null,
});

/** @type {Readonly<Record<string, Vehicle>>} */
export const VEHICLES = Object.freeze({
  chemical: Object.freeze({
    id: 'chemical',
    name: 'Chemical (LH₂/LOX)',
    engine: 'RL10-class expander-cycle LH₂/LOX',
    isp: 460, // [RL10]: RL10C-3 ≈ 460 s, RL10B-2 465.5 s
    // ESTIMATE: 10% inert fraction on a 300 t wet stage (Centaur-class
    // stages run ≈ 8–10%), plus engines and long-duration cryo insulation.
    stageDryMass: 30_000,
    propellantCapacity: 270_000, // 300 t wet stage (fairness rule above)
    marsCapture: 'propulsive',
    gcrShieldingFactor: 1.0,
    ...ASSEMBLED,
    hardwareCost: 1.0e9, // ESTIMATE
    trl: 9, // engines flight-proven; months-long LH₂ storage is not
    burnReliability: 0.99, // heuristic, flight-proven engines
    operationReliability: 0.995, // heuristic, ISS-style docking heritage
    color: '#E24B4A',
    notes: [
      'Engines are flight-proven; storing liquid hydrogen for months without boil-off is not yet demonstrated.',
    ],
  }),

  nuclear: Object.freeze({
    id: 'nuclear',
    name: 'Nuclear Thermal (advanced concept, never flown)',
    engine: 'NERVA-derived solid-core NTR, LH₂ propellant',
    isp: 900, // [DRA5] design assumption; [NERVA] best ground test 875 s (Pewee 1)
    // ESTIMATE: three ~3.5 t engines with internal shields, external
    // shadow shields, and large LH₂ tanks with cryocoolers. LH₂ is only
    // 71 kg/m³, so tankage is heavy. Same 300 t wet mass as chemical.
    stageDryMass: 70_000,
    propellantCapacity: 230_000,
    marsCapture: 'propulsive',
    gcrShieldingFactor: 1.0, // shadow shields block the reactor, not cosmic rays
    ...ASSEMBLED,
    hardwareCost: 3.0e9, // ESTIMATE; excludes reactor development (several $B)
    trl: 5, // ground-tested 1960s–70s, never flown
    burnReliability: 0.95, // heuristic, no flight heritage
    operationReliability: 0.995,
    color: '#3B8BD4',
    notes: [
      'Isp 900 s is the DRA 5.0 design value; the best 1960s–70s ground test (Pewee 1, 1968) reached 875 s.',
      'No nuclear thermal rocket has ever flown; development cost is not included.',
    ],
  }),

  starship: Object.freeze({
    id: 'starship',
    name: 'Starship (CH₄/LOX)',
    engine: 'Raptor Vacuum, CH₄/LOX full-flow staged combustion',
    isp: 380, // [SS-EST] ESTIMATE: SpaceX does not publish Raptor Vacuum Isp
    stageDryMass: 120_000, // ESTIMATE: not published; public estimates span ≈ 100–150 t
    propellantCapacity: 1_200_000, // [SS-EST] ESTIMATE: Block 1 ship, secondary sources
    marsCapture: 'aerocapture',
    // ESTIMATE: about 7.5 km/s entry speed, from SpaceX public statements;
    // not demonstrated at Mars.
    maxEntrySpeed: 7_500,
    gcrShieldingFactor: 1.0,
    launchMode: 'tanker',
    defaultLaunchVehicle: 'starship',
    compatibleLaunchVehicles: Object.freeze(['starship']),
    hardwareCost: 0.2e9, // ESTIMATE
    trl: 7,
    burnReliability: 0.97, // heuristic, in-space Raptor relights only briefly demonstrated
    operationReliability: 0.99, // heuristic, ship-to-ship cryogenic transfer at scale is undemonstrated
    aerocaptureReliability: 0.97, // heuristic, crewed-scale Mars aerocapture never attempted
    color: '#1D9E75',
    notes: [
      'Relies on many tanker flights and ship-to-ship propellant transfer, which is not yet demonstrated at scale.',
      'Stops at Mars with its heat shield (aerocapture), so it needs no braking burn but caps the arrival speed.',
      'Isp 380 s and 1,200 t of propellant are commonly reported figures; SpaceX does not publish Raptor Isp.',
    ],
  }),
});

/** Reference vehicle ids in display order. */
export const VEHICLE_IDS = Object.freeze(['chemical', 'nuclear', 'starship']);

/**
 * Builds a vehicle from custom parts (used by the "build your rocket" UI).
 * Uses the assembled-in-LEO architecture (any launcher) and propulsive capture.
 * @param {object} p
 * @param {string} p.name
 * @param {number} p.isp               [s]
 * @param {number} p.stageDryMass      [kg]
 * @param {number} p.propellantCapacity [kg]
 * @param {number} [p.trl=5]
 * @param {number} [p.gcrShieldingFactor=1]
 * @param {number} [p.burnReliability] Defaults to a TRL-based heuristic (0.99 at TRL 9, −1% per level below).
 * @param {string} [p.color]
 * @returns {Vehicle}
 */
export function createCustomVehicle({ name, isp, stageDryMass, propellantCapacity, trl = 5, gcrShieldingFactor = 1, burnReliability, color = '#E91E8C' }) {
  for (const [k, v] of Object.entries({ isp, stageDryMass, propellantCapacity })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new RangeError(`${k} must be a positive finite number`);
  }
  if (!(gcrShieldingFactor > 0 && gcrShieldingFactor <= 1)) throw new RangeError('gcrShieldingFactor must be in (0, 1]');
  if (!(trl >= 1 && trl <= 9)) throw new RangeError('trl must be in 1–9');
  return Object.freeze({
    id: 'custom',
    name: name || 'Custom rocket',
    engine: 'Custom',
    isp,
    stageDryMass,
    propellantCapacity,
    marsCapture: 'propulsive',
    gcrShieldingFactor,
    ...ASSEMBLED,
    hardwareCost: 2.0e9, // ESTIMATE, flat placeholder for custom builds
    trl,
    burnReliability: burnReliability ?? 0.99 - 0.01 * (9 - trl),
    operationReliability: 0.995,
    color,
    notes: ['Custom build: hardware cost is a flat placeholder estimate.'],
  });
}
