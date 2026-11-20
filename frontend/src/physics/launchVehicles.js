/**
 * Launch vehicles: the rockets that lift the in-space stage, its propellant
 * and the crew payload from Earth to low Earth orbit (LEO).
 *
 * The in-space stages (vehicles.js) do the Mars burns. This catalog only
 * decides how many launches it takes to put the stack in LEO and what those
 * launches cost.
 *
 * Fields (SI units):
 *   payloadLeoKg       Mass delivered to LEO per launch [kg]. For a tanker
 *                      launch this is the propellant delivered.
 *   ispSeaLevelS       First-stage/core engine Isp at sea level [s], or null if unpublished.
 *   ispVacS            Same engine in vacuum [s], or null if unpublished.
 *   firstStageEngine   Engine the Isp values refer to.
 *   thrustN            Total liftoff thrust [N].
 *   costPerLaunchUsd   Marginal cost per launch [USD]. Development is excluded.
 *   reusable           Whether the configuration modelled is reused.
 *   status             'operational' | 'flight-test' | 'planned'.
 *   source             Short citation string, shown in the UI.
 *
 * Numbers marked ESTIMATE are not published by the operator. They are the
 * author's estimates, kept inside the range of public reporting, and the
 * README lists them as open assumptions. Isp values are display-only: the
 * launch count and cost use payloadLeoKg and costPerLaunchUsd.
 *
 * Sources:
 *   [SPX-SS]  SpaceX, Starship vehicle page (spacex.com/vehicles/starship):
 *             payload 100–150 t (fully reusable); Super Heavy thrust 7,590 tf.
 *   [SPX-FH]  SpaceX, Falcon Heavy vehicle page (spacex.com/vehicles/falcon-heavy):
 *             63,800 kg to LEO (expendable); 5,130,000 lbf (22,819 kN) at liftoff.
 *   [NASA-SLS] NASA SLS reference / fact sheets: Block 1 > 95 t to LEO and
 *             8.8 million lbf (39,100 kN) maximum thrust; Block 2 130 t to LEO
 *             (NASA SLS fact sheet 2015; JANNAF 2024 SLS presentation) and
 *             9.5 million lbf (NASA SLS fact sheet, June 2023).
 *   [RS25]    Aerojet Rocketdyne / L3Harris RS-25 spec sheet: 366 s sea level,
 *             452 s vacuum (109% power level).
 *   [OIG22]   NASA OIG IG-22-003 (2021): SLS production cost ≈ $2.2 B per launch
 *             (excluding Orion, service module and ground systems); the OIG
 *             estimated Block 1B would initially cost ≈ $2.5 B per flight.
 *   [BO-NG]   Blue Origin, New Glenn page (blueorigin.com/new-glenn): 45 t to LEO;
 *             BE-4: 550,000 lbf (2,450 kN) at sea level, seven on the first stage.
 */

/** Pound-force → newton (exact: 0.45359237 kg × 9.80665 m/s²). */
const LBF = 4.4482216152605;
/** Tonne-force → newton (1,000 kg × 9.80665 m/s²). */
const TONNE_FORCE = 9806.65;

/**
 * @typedef {object} LaunchVehicle
 * @property {string} id
 * @property {string} name
 * @property {number} payloadLeoKg
 * @property {number|null} ispSeaLevelS
 * @property {number|null} ispVacS
 * @property {string} firstStageEngine
 * @property {number} thrustN
 * @property {number} costPerLaunchUsd
 * @property {boolean} reusable
 * @property {'operational'|'flight-test'|'planned'} status
 * @property {string} source
 * @property {string[]} notes
 */

/** @type {Readonly<Record<string, LaunchVehicle>>} */
export const LAUNCH_VEHICLES = Object.freeze({
  starship: Object.freeze({
    id: 'starship',
    name: 'Starship (Super Heavy + Starship, reusable)',
    // [SPX-SS] lists 100–150 t. The low end is used: no Starship has yet
    // delivered a full-scale payload, and this is also the propellant each
    // tanker flight delivers.
    payloadLeoKg: 100_000,
    // ESTIMATE: SpaceX does not publish Raptor Isp. ≈ 327 s (sea level) and
    // ≈ 350 s (vacuum, sea-level nozzle) are widely reported secondary figures.
    ispSeaLevelS: 327,
    ispVacS: 350,
    firstStageEngine: '33 × Raptor (CH₄/LOX)',
    thrustN: 7590 * TONNE_FORCE, // [SPX-SS] 7,590 tf ≈ 74.4 MN
    // ESTIMATE: no published price. $150 M reflects current-era cost
    // estimates; SpaceX's long-term target is far lower.
    costPerLaunchUsd: 150e6,
    reusable: true,
    status: 'flight-test', // in flight test, not yet in operational service (as modelled)
    source: 'SpaceX Starship page: 100–150 t to LEO, 7,590 tf; cost is an estimate',
    notes: ['Required for the Starship in-space stage (the ship and its tankers are Starships).'],
  }),

  'sls-block1': Object.freeze({
    id: 'sls-block1',
    name: 'SLS Block 1',
    payloadLeoKg: 95_000, // [NASA-SLS] "more than 95 t" to LEO
    ispSeaLevelS: 366, // [RS25]
    ispVacS: 452, // [RS25]
    firstStageEngine: '4 × RS-25 core + 2 five-segment SRBs',
    thrustN: 8.8e6 * LBF, // [NASA-SLS] 8.8 million lbf ≈ 39.1 MN
    costPerLaunchUsd: 2.2e9, // [OIG22]
    reusable: false,
    status: 'operational',
    source: 'NASA SLS: 95 t to LEO, 8.8 Mlbf; NASA OIG IG-22-003: ≈ $2.2 B per launch',
    notes: ['Flown on Artemis I (2022).'],
  }),

  'sls-block2': Object.freeze({
    id: 'sls-block2',
    name: 'SLS Block 2 (planned)',
    payloadLeoKg: 130_000, // [NASA-SLS] 130 t to LEO (design goal)
    ispSeaLevelS: 366, // [RS25] same core engines
    ispVacS: 452, // [RS25]
    firstStageEngine: '4 × RS-25 core + 2 advanced boosters',
    thrustN: 9.5e6 * LBF, // [NASA-SLS] 9.5 million lbf ≈ 42.3 MN (June 2023 fact sheet)
    // ESTIMATE: no published figure. Uses the OIG's initial Block 1B estimate
    // ($2.5 B) as a floor for the larger Block 2.
    costPerLaunchUsd: 2.5e9,
    reusable: false,
    status: 'planned',
    source: 'NASA SLS fact sheets: 130 t to LEO, 9.5 Mlbf (planned, never flown); cost is an estimate',
    notes: ['Planned configuration that has never flown; its future depends on NASA budgets.'],
  }),

  'falcon-heavy': Object.freeze({
    id: 'falcon-heavy',
    name: 'Falcon Heavy (expendable)',
    payloadLeoKg: 63_800, // [SPX-FH] fully expendable
    // ESTIMATE: SpaceX does not currently publish Merlin Isp. 282 s / 311 s
    // are the commonly cited Merlin 1D sea-level / vacuum figures.
    ispSeaLevelS: 282,
    ispVacS: 311,
    firstStageEngine: '27 × Merlin 1D (RP-1/LOX)',
    thrustN: 22_819e3, // [SPX-FH] 22,819 kN
    // ESTIMATE: SpaceX lists ≈ $97 M for the reusable configuration; the
    // fully expendable price is not published.
    costPerLaunchUsd: 150e6,
    reusable: false,
    status: 'operational',
    source: 'SpaceX Falcon Heavy page: 63.8 t to LEO expendable, 22,819 kN; cost is an estimate',
    notes: ['Expendable configuration (no booster recovery) gives the maximum LEO payload.'],
  }),

  'new-glenn': Object.freeze({
    id: 'new-glenn',
    name: 'New Glenn',
    payloadLeoKg: 45_000, // [BO-NG]
    ispSeaLevelS: null, // not published by Blue Origin
    ispVacS: null, // not published by Blue Origin
    firstStageEngine: '7 × BE-4 (CH₄/LOX)',
    thrustN: 7 * 2450e3, // [BO-NG] 7 × 2,450 kN ≈ 17.2 MN (≈ 3.85 Mlbf)
    costPerLaunchUsd: 110e6, // ESTIMATE: no published price
    reusable: true, // reusable first stage
    status: 'operational', // first orbital flight January 2025
    source: 'Blue Origin New Glenn page: 45 t to LEO, 7 × BE-4 at 2,450 kN; cost is an estimate',
    notes: ['BE-4 specific impulse is not published, so it is not shown.'],
  }),
});

/** Launch-vehicle ids in display order. */
export const LAUNCH_VEHICLE_IDS = Object.freeze(['starship', 'sls-block1', 'sls-block2', 'falcon-heavy', 'new-glenn']);

/**
 * Resolves a launch-vehicle id to its catalog entry.
 * @param {string} id
 * @returns {LaunchVehicle}
 * @throws {TypeError} For an unknown id.
 */
export function getLaunchVehicle(id) {
  const lv = typeof id === 'string' ? LAUNCH_VEHICLES[id] : undefined;
  if (!lv) throw new TypeError(`Unknown launch vehicle: ${String(id)} (expected one of ${LAUNCH_VEHICLE_IDS.join(', ')})`);
  return lv;
}

/**
 * Whether an in-space stage can be lifted by a launch vehicle.
 *
 * Rule: an 'assembled' stage (chemical, nuclear, custom) can ride on any
 * launcher; its stack is split into as many launches as needed and docked
 * in LEO. A 'tanker' stage (Starship) IS the upper stage of the Starship
 * launcher and is refuelled by Starship tankers, so it can only use the
 * Starship launch vehicle. Other combinations are disallowed, not silently
 * replaced, so the UI can explain why.
 *
 * @param {{launchMode:'assembled'|'tanker', compatibleLaunchVehicles?: string[]|null, name?: string}} stage
 * @param {string} launchVehicleId
 * @returns {{ok: boolean, reason: string|null}}
 */
export function launchCompatibility(stage, launchVehicleId) {
  getLaunchVehicle(launchVehicleId);
  const allowed = stage.compatibleLaunchVehicles;
  if (Array.isArray(allowed) && !allowed.includes(launchVehicleId)) {
    return {
      ok: false,
      reason: `${stage.name ?? 'This stage'} can only launch on ${allowed.map((id) => LAUNCH_VEHICLES[id].name).join(' or ')}: ` +
        'the ship is the launcher\'s own upper stage and is refuelled by its tankers.',
    };
  }
  return { ok: true, reason: null };
}
