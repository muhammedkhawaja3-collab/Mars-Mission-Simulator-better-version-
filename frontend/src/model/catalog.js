/**
 * Static UI catalogs: rocket-builder parts, transfer strategies, fleet display
 * metadata and the debrief metrics. All mission numbers come from the physics
 * engine (src/physics); these tables only describe choices and labels.
 */
import { fromDays } from '../physics/index.js';

/**
 * Builder engines. `thrust` is in kN for every engine (electric thrusters are
 * well under 1 kN; see fmtThrust). Sources are in each description.
 * @type {ReadonlyArray<{id:string, name:string, family:string, isp:number, thrust:number, trl:number, electric:boolean, desc:string}>}
 */
export const ENGINE_CATALOG = Object.freeze([
  // LH₂/LOX
  {
    id: 'rl10b2',
    name: 'RL-10B-2',
    family: 'LH₂/LOX',
    isp: 465.5,
    thrust: 110,
    trl: 9,
    electric: false,
    desc: 'Delta IV upper stage. 465.5 s vacuum Isp (Aerojet Rocketdyne data sheet). The RL10 family also powers the SLS upper stages (ICPS; four RL10C-3 on the planned Exploration Upper Stage).',
  },
  {
    id: 'vinci',
    name: 'Vinci',
    family: 'LH₂/LOX',
    isp: 465,
    thrust: 180,
    trl: 7,
    electric: false,
    desc: 'ESA expander-cycle upper-stage engine (Ariane 6). One of the highest published Isp values of any operational chemical engine.',
  },
  {
    id: 'rl10c3',
    name: 'RL-10C-3',
    family: 'LH₂/LOX',
    isp: 456,
    thrust: 110,
    trl: 8,
    electric: false,
    desc: 'Evolved RL-10 with a larger nozzle extension. Selected for the SLS Exploration Upper Stage.',
  },
  // CH₄/LOX
  {
    id: 'raptor2v',
    name: 'Raptor 2 Vac',
    family: 'CH₄/LOX',
    isp: 380,
    thrust: 2200,
    trl: 7,
    electric: false,
    desc: 'SpaceX full-flow staged combustion, ≈ 300 bar chamber pressure. Isp is a commonly cited figure, not published by SpaceX.',
  },
  {
    id: 'be4vac',
    name: 'BE-4 Vac',
    family: 'CH₄/LOX',
    isp: 365,
    thrust: 1320,
    trl: 6,
    electric: false,
    desc: 'Hypothetical vacuum variant of Blue Origin’s oxygen-rich staged-combustion BE-4. Figures are estimates.',
  },
  // RP-1/LOX
  {
    id: 'merlin1d',
    name: 'Merlin 1D Vac',
    family: 'RP-1/LOX',
    isp: 348,
    thrust: 934,
    trl: 9,
    electric: false,
    desc: 'Falcon 9 upper stage. The most-flown vacuum engine in service. Pintle injector.',
  },
  {
    id: 'rd180',
    name: 'RD-180',
    family: 'RP-1/LOX',
    isp: 338,
    thrust: 3830,
    trl: 9,
    electric: false,
    desc: 'Energomash staged combustion, Atlas V first stage (100+ flights). A booster engine, shown for comparison.',
  },
  // Nuclear thermal: ≈ 2× the Isp of chemical (more Δv per tonne of propellant) but heavier engines and tanks.
  {
    id: 'nerva_xe',
    name: 'NERVA XE Prime',
    family: 'NTR (LH₂)',
    isp: 841,
    thrust: 223,
    trl: 6,
    electric: false,
    desc: 'Los Alamos/Aerojet, 1969 ground test. 841 s Isp measured. Never flown.',
  },
  {
    id: 'pewee',
    name: 'Pewee-1',
    family: 'NTR (LH₂)',
    isp: 845,
    thrust: 111,
    trl: 5,
    electric: false,
    desc: 'Los Alamos, 1968. Highest-Isp NTR reactor ground-tested. Never flown.',
  },
  {
    id: 'bimodal',
    name: 'Bimodal NTR',
    family: 'NTR (LH₂)',
    isp: 900,
    thrust: 270,
    trl: 4,
    electric: false,
    desc: 'NASA GRC concept with propulsion and power modes (Borowski et al., AIAA-2012-5144). 900 s is a design target.',
  },
  // Electric: high Isp but thrust far too low for crewed impulsive burns.
  {
    id: 'vasimr',
    name: 'VASIMR VX-200',
    family: 'Electric (Ar)',
    isp: 5000,
    thrust: 0.0057,
    trl: 4,
    electric: true,
    desc: 'Ad Astra Rocket, 200 kW plasma, ≈ 5.7 N of thrust. Far too little thrust for the impulsive burns of a crewed transfer.',
  },
  {
    id: 'nextc',
    name: 'NEXT-C Ion',
    family: 'Electric (Xe)',
    isp: 4190,
    thrust: 0.000236,
    trl: 8,
    electric: true,
    desc: 'NASA ion thruster (DART heritage), ≈ 0.236 N of thrust. Suited to cargo and robotic missions only.',
  },
]);

export const TANK_OPTIONS = Object.freeze([
  {
    id: 'sm',
    name: 'Small tank',
    capacity: 80000,
    structMass: 4000,
    desc: '80 t propellant. Compact and light, limited Δv.',
  },
  {
    id: 'med',
    name: 'Medium tank',
    capacity: 200000,
    structMass: 8000,
    desc: '200 t propellant. Typical interplanetary stage sizing.',
  },
  {
    id: 'lrg',
    name: 'Large tank',
    capacity: 400000,
    structMass: 14000,
    desc: '400 t propellant. More Δv, heavier structure.',
  },
  {
    id: 'depot',
    name: 'Depot-fed',
    capacity: 600000,
    structMass: 9000,
    desc: '600 t filled from an orbital depot. Lighter structure than a monolithic tank of the same size (estimate).',
  },
]);

export const SHIELD_OPTIONS = Object.freeze([
  {
    id: 'none',
    name: 'Hull only',
    mass: 0,
    factor: 1.0,
    desc: 'About 0.3 g/cm² aluminium. No dedicated shielding.',
  },
  {
    id: 'poly',
    name: 'Polyethylene panels',
    mass: 1500,
    factor: 0.85,
    desc: 'Hydrogen-rich polymer, ISS-derived. 15 % GCR dose reduction (estimate).',
  },
  {
    id: 'water',
    name: 'Water wall',
    mass: 4000,
    factor: 0.75,
    desc: 'Dual use: 4 t of water as a radiation barrier. 25 % reduction (estimate).',
  },
  {
    id: 'lh2',
    name: 'LH₂ shadow shield',
    mass: 4000,
    factor: 0.7,
    desc: 'Hydrogen tank placed between the reactor and the crew. 30 % reduction (estimate).',
  },
  {
    id: 'borated',
    name: 'Borated polyethylene',
    mass: 6000,
    factor: 0.6,
    desc: 'Boron-10 + polyethylene composite. 40 % reduction (estimate).',
  },
  {
    id: 'mag',
    name: 'Active magnetic shield',
    mass: 12000,
    factor: 0.45,
    desc: 'Superconducting magnet concept (ESA/NASA studies). 55 % reduction is a concept target, never demonstrated.',
  },
]);

export const HAB_OPTIONS = Object.freeze([
  {
    id: 'capsule',
    name: 'Orion-class capsule',
    dryMass: 8000,
    desc: 'Cramped crew capsule. Light, but a hard place to spend 200+ days.',
  },
  {
    id: 'standard',
    name: 'NASA transit hab',
    dryMass: 20000,
    desc: 'NASA DRA 5.0 reference transit habitat. No centrifuge.',
  },
  {
    id: 'bigelow',
    name: 'Bigelow BA-330',
    dryMass: 24000,
    desc: 'Inflatable 330 m³ module. More crew volume.',
  },
  {
    id: 'centrifuge',
    name: 'Centrifuge hab',
    dryMass: 35000,
    desc: 'Rotating section at 0.38 g. Artificial gravity is expected to reduce bone and muscle loss, but it has never been tested on a crewed spacecraft and the model does not credit it.',
  },
]);

/** Builder colours, each ≥ 3:1 against the dark surfaces, with a spoken name. */
export const PLAYER_COLORS = Object.freeze([
  { value: '#E91E8C', name: 'Magenta' },
  { value: '#00BCD4', name: 'Cyan' },
  { value: '#C77DFF', name: 'Violet' },
  { value: '#FF5722', name: 'Orange' },
  { value: '#CDDC39', name: 'Lime' },
  { value: '#FFD700', name: 'Gold' },
]);

export const DEFAULT_BUILD = Object.freeze({
  name: 'MY ROCKET',
  color: PLAYER_COLORS[0].value,
  engine: null,
  tank: 'med',
  shield: 'none',
  hab: 'standard',
});

/** Structure allowance for the bus and engine on a custom stage (estimate). */
export const BUS_MASS = 3000;

export const TRANSFER_OPTIONS = Object.freeze([
  {
    id: 'fastest',
    label: 'Fastest each vehicle can fly',
    choice: { kind: 'fastest' },
    hint: 'Each vehicle burns its full tank load (minus the risk margin) on the fastest transfer it can fly. Fast transfers here are conservative (tangential departure).',
  },
  {
    id: 'hohmann',
    label: 'Minimum-energy (Hohmann-type)',
    choice: { kind: 'hohmann' },
    hint: 'Every vehicle flies the same slow, cheap trajectory. Compare propellant, launches and cost.',
  },
  {
    id: 'tof200',
    label: 'Fixed 200-day transfer',
    choice: { kind: 'timeOfFlight', timeOfFlight: fromDays(200) },
    hint: 'Every vehicle flies the same 200-day trajectory, if it can.',
  },
]);

/** Display metadata for the reference fleet (numbers come from the engine). */
export const FLEET_DISPLAY = Object.freeze({
  chemical: {
    label: 'Chemical',
    shortLabel: 'CHEM',
    engineType: 'LH₂/LOX, RL10-class',
    source:
      'RL10 Isp ≈ 460 s · 300 t wet stage · assembled in LEO from launches of the selected launch vehicle',
  },
  nuclear: {
    label: 'Nuclear Thermal',
    shortLabel: 'NTR',
    engineType: 'NERVA-derived NTR, LH₂ · advanced concept, never flown',
    source:
      'Isp 900 s (DRA 5.0 design value; ≈ 850 s demonstrated in ground tests) · same 300 t wet stage · never flown',
  },
  starship: {
    label: 'Starship',
    shortLabel: 'SHIP',
    engineType: 'Raptor Vacuum, CH₄/LOX',
    source:
      'Isp 380 s · 1,200 t tanks refilled in LEO by tankers · aerocapture at Mars (entry ≤ 7.5 km/s, est.)',
  },
});

/**
 * Metrics in the debrief comparison table. `lo` = lower is better.
 * Every key exists on the display rocket built by toDisplayRocket().
 */
export const METRICS = Object.freeze([
  {
    key: 'transit',
    label: 'Transit time (outbound)',
    unit: 'days',
    lo: true,
    src: 'Patched conics, JPL mean planetary elements',
  },
  {
    key: 'avgVelocity',
    label: 'Average heliocentric speed',
    unit: 'km/s',
    lo: false,
    src: 'Transfer arc length ÷ transit time',
  },
  {
    key: 'radiation',
    label: 'Transit dose (outbound)',
    unit: 'mSv',
    lo: true,
    src: 'Curiosity RAD 1.84 mSv/day (Zeitlin et al., Science 2013)',
  },
  {
    key: 'missionDose',
    label: 'Mission dose (round trip + surface + events)',
    unit: 'mSv',
    lo: true,
    src: 'RAD cruise + surface 0.64 mSv/day (Hassler et al. 2014) + seeded solar particle events',
  },
  {
    key: 'careerRadPct',
    label: 'Career radiation limit used',
    unit: '%',
    lo: true,
    src: 'NASA-STD-3001, 600 mSv career limit',
  },
  {
    key: 'deltaV',
    label: 'Δv required (burns)',
    unit: 'km/s',
    lo: true,
    src: 'TMI from 400 km LEO + Mars capture',
  },
  {
    key: 'abortDv',
    label: 'Spare Δv capability',
    unit: 'km/s',
    lo: false,
    src: 'Full-tank Δv − required Δv (rocket equation)',
  },
  {
    key: 'propellantT',
    label: 'Propellant mass',
    unit: 't',
    lo: true,
    src: 'Tsiolkovsky rocket equation',
  },
  {
    key: 'imleo',
    label: 'Mass in low Earth orbit',
    unit: 't',
    lo: true,
    src: 'Stage + crew payload + propellant',
  },
  {
    key: 'launches',
    label: 'Launches required',
    unit: '×',
    lo: true,
    src: 'ceil(mass in LEO ÷ launcher payload); Starship: ship + tankers',
  },
  {
    key: 'cost',
    label: 'Transportation cost (est.)',
    unit: '$B',
    lo: true,
    src: 'Hardware + launches + expected re-flights; estimates, see physics/README',
  },
  {
    key: 'success',
    label: 'Success estimate (heuristic)',
    unit: '%',
    lo: false,
    src: 'Product of mission-critical factors; uncrewed launch failures are re-flown',
  },
  {
    key: 'crewHealth',
    label: 'Crew health index (heuristic)',
    unit: '/100',
    lo: false,
    src: 'Illustrative: dose + zero-g time',
  },
  {
    key: 'isp',
    label: 'Specific impulse',
    unit: 's',
    lo: false,
    src: 'Engine test data / manufacturer spec',
  },
]);

/** Metrics drawn as bar charts in the debrief. */
export const CHART_METRIC_KEYS = Object.freeze([
  'transit',
  'missionDose',
  'imleo',
  'cost',
  'launches',
  'success',
]);

/** Duration of the flight replay. The longest transfer is compressed into this. */
export const FLIGHT_REPLAY_MS = 60000;

/** Countdown length in seconds. */
export const COUNTDOWN_SECONDS = 5;
