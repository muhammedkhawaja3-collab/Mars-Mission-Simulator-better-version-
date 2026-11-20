/**
 * Adapter between the mission configuration and the physics engine.
 * Every number here comes from simulateMission(); this module only converts SI
 * results into the display units the UI renders. Pure functions, no React.
 */
import {
  simulateMission,
  createCustomVehicle,
  exhaustVelocity,
  VEHICLES,
  VEHICLE_IDS,
  getWindow,
  toDays,
  toKmPerSecond,
  toTonnes,
  toMilliSieverts,
  toBillionUsd,
  toMillionKm,
} from '../physics/index.js';
import {
  ENGINE_CATALOG,
  TANK_OPTIONS,
  SHIELD_OPTIONS,
  HAB_OPTIONS,
  TRANSFER_OPTIONS,
  FLEET_DISPLAY,
  BUS_MASS,
} from './catalog.js';
import { round, fmtThrust } from './format.js';

/**
 * @typedef {object} DisplayRocket
 * @property {string} key         'chemical' | 'nuclear' | 'starship' | 'player'
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} color       Data colour (graphics only; text uses tokens).
 * @property {boolean} failed     True when the engine says the mission is infeasible.
 * @property {string|null} failReason
 * @property {boolean} aborted    True when seeded engine faults exhaust the Δv reserve (gameplay model).
 * @property {object|null} mission The raw MissionResult (SI).
 */

/** Resolves the transfer option for an id (falls back to the first). */
export const transferOptionFor = (id) =>
  TRANSFER_OPTIONS.find((o) => o.id === id) ?? TRANSFER_OPTIONS[0];

/** Convert an engine MissionResult (SI) into the flat display object the UI renders. */
export function toDisplayRocket(key, mission, vehicle, display, extra = {}) {
  const base = {
    key,
    ...display,
    color: vehicle.color,
    trl: vehicle.trl,
    isp: vehicle.isp,
    exhaustVelocity: Math.round(exhaustVelocity(vehicle.isp)),
    departureDate: mission.departureDate,
    ...extra,
  };
  if (!mission.feasible) {
    return {
      ...base,
      failed: true,
      aborted: false,
      failReason: mission.infeasibleReason,
      deltaV: mission.deltaV ? round(toKmPerSecond(mission.deltaV.total), 2) : null,
      events: [],
      mission: null,
    };
  }
  return {
    ...base,
    failed: false,
    failReason: null,
    transit: round(toDays(mission.transitTime)),
    radiation: round(toMilliSieverts(mission.dose.outbound)),
    missionDose: round(toMilliSieverts(mission.dose.total), 0),
    careerRadPct: round(mission.dose.careerFraction * 100),
    surfaceStay: Math.round(toDays(mission.duration.surfaceStay)),
    propellant: Math.round(mission.mass.propellant),
    propellantT: round(toTonnes(mission.mass.propellant), 0),
    imleo: round(toTonnes(mission.mass.initialMassInLEO), 0),
    cost: round(toBillionUsd(mission.cost.total), 2),
    launches: mission.launches,
    deltaV: round(toKmPerSecond(mission.deltaV.total), 2),
    deltaVDeparture: round(toKmPerSecond(mission.deltaV.departure), 2),
    deltaVCapture: round(toKmPerSecond(mission.deltaV.capture), 2),
    abortDv: round(toKmPerSecond(mission.deltaV.reserve), 2),
    avgVelocity: round(toKmPerSecond(mission.averageSpeed), 1),
    pathMkm: round(toMillionKm(mission.pathLength), 0),
    success: round(mission.success.probability * 100),
    successFactors: mission.successFactors,
    launchVehicleName: mission.launchVehicle.name,
    crewHealth: round(mission.crewHealthIndex, 0),
    events: mission.events,
    eventSummary: mission.eventSummary,
    aborted: Boolean(mission.eventSummary?.abort),
    mission,
  };
}

/**
 * Engine inputs shared by every vehicle for a configuration.
 * @param {import('../state/missionReducer.js').MissionConfig} config
 */
export function missionInputs(config) {
  return {
    crewSize: config.crewSize,
    windowId: config.windowId,
    transferChoice: transferOptionFor(config.transferChoice).choice,
    riskTolerance: config.riskTolerance,
    seed: config.seed,
  };
}

/**
 * Builder parts → engine vehicle → display rocket.
 * Habitat mass comes from the chosen hab module; structure = tank structure +
 * shielding + bus/engine allowance (estimate).
 * @returns {DisplayRocket|null} null while no engine is selected.
 */
export function computePlayerStats(parts, config) {
  if (!parts) return null;
  const eng = ENGINE_CATALOG.find((e) => e.id === parts.engine);
  const tank = TANK_OPTIONS.find((t) => t.id === parts.tank);
  const shield = SHIELD_OPTIONS.find((s) => s.id === parts.shield);
  const hab = HAB_OPTIONS.find((h) => h.id === parts.hab);
  if (!eng || !tank || !shield || !hab) return null;

  const name = (parts.name || '').trim() || 'MY ROCKET';
  const stageDryMass = tank.structMass + shield.mass + BUS_MASS;
  const display = {
    label: name,
    shortLabel: name.replace(/\s+/g, '').slice(0, 4).toUpperCase() || 'CUST',
    engineType: `${eng.name}, ${eng.family}`,
    source: `${eng.name} Isp ${eng.isp} s · TRL ${eng.trl} · ${hab.name} · ${shield.name} · ${tank.name}`,
  };
  const extra = {
    parts: { ...parts },
    engineName: eng.name,
    habName: hab.name,
    shieldName: shield.name,
    tankName: tank.name,
    stageDryMass,
    habitatMass: hab.dryMass,
    propellantCapacity: tank.capacity,
  };
  const vehicle = createCustomVehicle({
    name,
    isp: eng.isp,
    stageDryMass,
    propellantCapacity: tank.capacity,
    trl: eng.trl,
    gcrShieldingFactor: shield.factor,
    color: parts.color,
  });
  if (eng.electric) {
    // Impulsive-burn patched conics do not apply to months-long low-thrust spirals.
    const mission = {
      feasible: false,
      departureDate: getWindow(config.windowId).departureDate,
      deltaV: null,
      infeasibleReason: `Electric drive: ${fmtThrust(eng.thrust)} of thrust cannot perform the impulsive burns this crewed transfer model assumes`,
    };
    return toDisplayRocket('player', mission, vehicle, display, extra);
  }
  const mission = simulateMission({
    ...missionInputs(config),
    vehicle,
    launchVehicle: config.launchVehicleId,
    habitatMass: hab.dryMass,
  });
  return toDisplayRocket('player', mission, vehicle, display, extra);
}

/** Simulate one reference-fleet vehicle. */
export function simulateFleetVehicle(id, config) {
  const vehicle = VEHICLES[id];
  // The Starship stage only flies on the Starship launcher (it is that launcher's upper stage).
  const launchVehicle =
    vehicle.launchMode === 'tanker' ? vehicle.defaultLaunchVehicle : config.launchVehicleId;
  const mission = simulateMission({ ...missionInputs(config), vehicle, launchVehicle });
  return toDisplayRocket(id, mission, vehicle, FLEET_DISPLAY[id]);
}

/**
 * Simulates the whole configuration once.
 * - `fleet`: all three reference vehicles (setup cards show every option).
 * - `player`: the custom rocket, or null.
 * - `rockets`: what flies and is compared: the selected fleet vehicles, then the
 *   custom rocket, in display order.
 * @returns {{fleet: DisplayRocket[], player: DisplayRocket|null, rockets: DisplayRocket[]}}
 */
export function buildMissionResults(config) {
  const fleet = VEHICLE_IDS.map((id) => simulateFleetVehicle(id, config));
  const player = computePlayerStats(config.customRocket, config);
  const rockets = fleet.filter((r) => config.vehicleIds.includes(r.key));
  if (player) rockets.push(player);
  return { fleet, player, rockets };
}
