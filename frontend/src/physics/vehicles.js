/**
 * Vehicle definitions for the three reference architectures.
 *
 * Every vehicle carries the same crew payload (habitat, crew, consumables),
 * which mission.js adds on top of `stageDryMass`. Only the propulsion
 * differs. All three are fuelled in low Earth orbit (LEO) before departure.
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
 *   [NERVA] Rover/NERVA ground tests 1955–1972 demonstrated ≈ 825–850 s
 *           (e.g. Pewee, NRX/XE). No NTR has flown.
 *   [SLS]   NASA SLS reference: Block 1B ≈ 105 t to LEO.
 *   [OIG22] NASA OIG IG-22-003 (2022): SLS production + operations
 *           ≈ $2.2 B per launch (excluding Orion and ground systems).
 *   [SPX]   SpaceX Starship page / user's guide: ≈ 1,200 t propellant,
 *           100+ t payload, Raptor Vacuum Isp ≈ 380 s.
 */

/**
 * @typedef {object} LaunchArchitecture
 * @property {'assembled'|'tanker'} mode
 *   'assembled': the whole stack (stage + propellant + payload) is lifted by
 *   heavy-lift launches and docked in LEO.
 *   'tanker': the ship launches with the crew payload, and tanker flights
 *   then refill its propellant in LEO.
 * @property {string} name             Launcher name, for display.
 * @property {number} capacityPerLaunch Mass delivered to LEO per launch [kg] (for 'tanker' this is propellant per tanker).
 * @property {number} costPerLaunch    [USD].
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
 * @property {LaunchArchitecture} launch
 * @property {number} hardwareCost        Production cost of the propulsion hardware, excluding development [USD].
 * @property {number} trl                 Technology Readiness Level of the propulsion system (1–9).
 * @property {number} burnReliability     Heuristic probability that each major burn succeeds.
 * @property {number} operationReliability Heuristic probability that each docking/propellant transfer in LEO succeeds.
 * @property {number} [aerocaptureReliability] Heuristic probability that Mars aerocapture succeeds.
 * @property {string} color               UI colour.
 * @property {string[]} notes             Plain-language caveats shown in the README/UI.
 */

const SLS_CLASS = Object.freeze({
  mode: 'assembled',
  name: 'SLS Block 1B-class heavy lift',
  capacityPerLaunch: 105_000, // [SLS]
  costPerLaunch: 2.2e9, // [OIG22]
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
    launch: SLS_CLASS,
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
    name: 'Nuclear Thermal (NTR)',
    engine: 'NERVA-derived solid-core NTR, LH₂ propellant',
    isp: 900, // [DRA5] design assumption; [NERVA] demonstrated ≈ 850 s on the ground
    // ESTIMATE: three ~3.5 t engines with internal shields, external
    // shadow shields, and large LH₂ tanks with cryocoolers. LH₂ is only
    // 71 kg/m³, so tankage is heavy. Same 300 t wet mass as chemical.
    stageDryMass: 70_000,
    propellantCapacity: 230_000,
    marsCapture: 'propulsive',
    gcrShieldingFactor: 1.0, // shadow shields block the reactor, not cosmic rays
    launch: SLS_CLASS,
    hardwareCost: 3.0e9, // ESTIMATE; excludes reactor development (several $B)
    trl: 5, // ground-tested 1960s–70s, never flown
    burnReliability: 0.95, // heuristic, no flight heritage
    operationReliability: 0.995,
    color: '#3B8BD4',
    notes: [
      'Isp 900 s is the DRA 5.0 design value; ground tests in the 1960s–70s reached ≈ 850 s.',
      'No nuclear thermal rocket has ever flown; development cost is not included.',
    ],
  }),

  starship: Object.freeze({
    id: 'starship',
    name: 'Starship (CH₄/LOX)',
    engine: 'Raptor Vacuum, CH₄/LOX full-flow staged combustion',
    isp: 380, // [SPX]
    stageDryMass: 120_000, // ESTIMATE: not published; public estimates span ≈ 100–150 t
    propellantCapacity: 1_200_000, // [SPX]
    marsCapture: 'aerocapture',
    // ESTIMATE: about 7.5 km/s entry speed, from SpaceX public statements;
    // not demonstrated at Mars.
    maxEntrySpeed: 7_500,
    gcrShieldingFactor: 1.0,
    launch: Object.freeze({
      mode: 'tanker',
      name: 'Starship tanker flights',
      capacityPerLaunch: 150_000, // ESTIMATE: propellant delivered per tanker flight
      costPerLaunch: 150e6, // ESTIMATE: current-era cost; SpaceX's long-term target is far lower
    }),
    hardwareCost: 0.2e9, // ESTIMATE
    trl: 7,
    burnReliability: 0.97, // heuristic, in-space Raptor relights only briefly demonstrated
    operationReliability: 0.99, // heuristic, ship-to-ship cryogenic transfer at scale is undemonstrated
    aerocaptureReliability: 0.97, // heuristic, crewed-scale Mars aerocapture never attempted
    color: '#1D9E75',
    notes: [
      'Relies on many tanker flights and ship-to-ship propellant transfer, which is not yet demonstrated at scale.',
      'Stops at Mars with its heat shield (aerocapture), so it needs no braking burn but caps the arrival speed.',
    ],
  }),
});

/** Reference vehicle ids in display order. */
export const VEHICLE_IDS = Object.freeze(['chemical', 'nuclear', 'starship']);

/**
 * Builds a vehicle from custom parts (used by the "build your rocket" UI).
 * Uses the SLS-class assembled-in-LEO architecture and propulsive capture.
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
    launch: SLS_CLASS,
    hardwareCost: 2.0e9, // ESTIMATE, flat placeholder for custom builds
    trl,
    burnReliability: burnReliability ?? 0.99 - 0.01 * (9 - trl),
    operationReliability: 0.995,
    color,
    notes: ['Custom build: hardware cost is a flat placeholder estimate.'],
  });
}
