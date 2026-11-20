/**
 * Mission model: flies one in-space stage, lifted to LEO by a chosen launch
 * vehicle, from LEO to Mars in a real launch window, and reports transit
 * time, Δv, propellant, launches, cost, radiation, life support, success
 * factors, seeded gameplay events and a score.
 *
 * What is modelled with physics:
 *   - Launch-window phasing on Mars' real eccentric orbit (ephemeris.js, windows.js)
 *   - Heliocentric transfer: minimum-energy, or faster tangential-departure
 *     transfers that trade Δv for time (orbits.js)
 *   - Patched-conic burns: Earth departure from 400 km LEO, then Mars capture
 *     into the DRA 5.0 1-sol ellipse (or aerocapture with an entry-speed cap)
 *   - Propellant via the rocket equation, and launch counts (rocket.js)
 *   - Radiation dose from measured Curiosity/RAD dose rates × time
 *   - Life-support consumables from NASA BVAD rates (lifeSupport.js)
 *
 * What is a documented HEURISTIC or GAMEPLAY model, not rigorous engineering:
 *   - success probability and its factors (success.js)
 *   - crewHealthIndex: illustrative 0–100 score from dose and zero-g time
 *   - in-flight events (events.js) and the score (scoring.js)
 *
 * Scope: the propulsive model covers the crewed outbound leg. The return
 * leg is assumed to be a mirror-image transfer. It counts toward mission
 * duration, radiation dose and life support, but its propulsion is not
 * sized: as in NASA DRA 5.0, the return vehicle/propellant is assumed
 * pre-deployed or made on Mars (ISRU).
 *
 * Inputs and outputs are SI (m, s, kg, m/s, Sv, USD). Output dates are ISO
 * 8601 strings, so the result is plain JSON (the Python mirror returns the
 * same keys).
 */
import {
  DAY, MU_EARTH, MU_MARS, R_EARTH, R_MARS, LEO_ALTITUDE,
  MARS_CAPTURE_PERIAPSIS_ALTITUDE, MARS_CAPTURE_APOAPSIS_ALTITUDE, MARS_ENTRY_INTERFACE_ALTITUDE,
  GCR_CRUISE_DOSE_RATE, MARS_SURFACE_DOSE_RATE, CAREER_DOSE_LIMIT,
} from './constants.js';
import { departureBurnDeltaV, captureBurnDeltaV, maxVInfForEntrySpeed, transferArcLength } from './orbits.js';
import { solveTransferWindow, conjunctionStayTime } from './ephemeris.js';
import { propellantForDeltaV, maxDeltaV, launchesRequired } from './rocket.js';
import { VEHICLES } from './vehicles.js';
import { getLaunchVehicle, launchCompatibility } from './launchVehicles.js';
import { lifeSupportMass, dailyConsumables, DEFAULT_CLOSURE, CONTINGENCY_DAYS, LIFE_SUPPORT_CREW_RANGE } from './lifeSupport.js';
import { getWindow, DEFAULT_WINDOW_ID, BEST_WINDOW_ID } from './windows.js';
import { scheduleEvents, summarizeEvents } from './events.js';
import { successEstimate } from './success.js';
import { scoreMission } from './scoring.js';
import { validateSeed } from './rng.js';

/** Output format version (bump when keys change; the Python mirror checks it). */
export const MISSION_SCHEMA_VERSION = 3;

/**
 * Plain-language note for missions whose dose exceeds the 600 mSv career
 * limit (NASA-STD-3001). With the measured RAD dose rates, every
 * conjunction-class mission with MSL-like shielding exceeds it: the two cruise
 * legs alone give ≈ 0.4–1.0 Sv and the surface stay ≈ 0.25–0.5 Sv more.
 */
export const CAREER_LIMIT_NOTE =
  "NASA's career limit is 600 mSv (NASA-STD-3001). Every conjunction-class Mars mission with today's shielding exceeds it: " +
  'the two cruise legs and the long surface stay together give about 0.8–1.3 Sv. A crewed Mars mission would need much better ' +
  'shielding, a much shorter trip, or an exception to the standard.';

/** Formats a launch price for framing notes: '$2.2 B' or '$150 M'. */
function formatUsd(usd) {
  return usd >= 1e9 ? `$${(usd / 1e9).toFixed(1)} B` : `$${(usd / 1e6).toFixed(0)} M`;
}

/**
 * Framing notes the UI can show next to the numbers, as [{id, text}]:
 *   'launcher-cost'  which launcher the costs assume (costs depend on it);
 *   'capture-method' that propulsive vs aerocapture is an architecture choice;
 *   'career-limit'   (only if exceeded) that the dose is over NASA's limit.
 * @param {import('./vehicles.js').Vehicle} vehicle
 * @param {import('./launchVehicles.js').LaunchVehicle} launchVehicle
 * @param {{exceedsCareerLimit:boolean}} dose
 * @returns {Array<{id:string, text:string}>}
 */
export function missionFraming(vehicle, launchVehicle, dose) {
  const notes = [
    {
      id: 'launcher-cost',
      text: `Costs shown with ${launchVehicle.name} at ${formatUsd(launchVehicle.costPerLaunchUsd)} per launch. ` +
        (vehicle.launchMode === 'tanker'
          ? 'This stage can only fly on its own launcher.'
          : 'This stage can fly on any launcher, and the launch cost changes with that choice.'),
    },
    {
      id: 'capture-method',
      text: vehicle.marsCapture === 'aerocapture'
        ? 'Stops at Mars by aerocapture (heat shield, no braking burn); the entry-speed limit caps how fast it can arrive.'
        : "Stops at Mars with an engine burn. That is an architecture choice: NASA's DRA 5.0 also studied aerocapture for the chemical option, which would remove most of that burn.",
    },
  ];
  if (dose.exceedsCareerLimit) notes.push({ id: 'career-limit', text: CAREER_LIMIT_NOTE });
  return notes;
}

/* ── Common crew payload (identical for every vehicle) ──────────────────── */

/**
 * Crew payload assumptions (ESTIMATES), cross-checked against the DRA 5.0
 * transit habitat (≈ 40 t class for 6 crew → 15 t + 4.5 t/crew = 42 t at 6).
 * The habitat allowance includes life-support hardware and spares.
 * Consumables come from lifeSupport.js (NASA BVAD rates with recycling):
 * outbound transit + CONTINGENCY_DAYS. The surface and return consumables
 * are reported in `lifeSupport` but assumed pre-deployed with the return
 * vehicle (DRA 5.0), so they are not carried by the outbound stage.
 */
export const CREW_PAYLOAD = Object.freeze({
  habitatBaseMass: 15_000, // kg
  habitatMassPerCrew: 4_500, // kg/person
  crewMassPerPerson: 100, // kg/person (body + personal kit)
  contingencyDays: CONTINGENCY_DAYS, // extra days of consumables carried on the outbound leg
});

/** Closed-loop transit consumables per crew-day with default recycling [kg] (for display). */
export const CONSUMABLES_PER_CREW_DAY = dailyConsumables('transit', DEFAULT_CLOSURE).closedLoop;

/** Allowed crew sizes (integer 2–8, the range BVAD-based life support is scaled for). */
export const CREW_SIZE_RANGE = LIFE_SUPPORT_CREW_RANGE;

/**
 * Crew payload mass for the outbound leg.
 * @param {object} p
 * @param {number} p.crewSize      Number of crew (integer 2–8).
 * @param {number} p.transitTime   Outbound transit time [s].
 * @param {number} [p.habitatMass] Override the habitat mass [kg] (custom builds).
 * @param {{water:number, oxygen:number}} [p.closure] Recycling closure (default ISS-class).
 * @returns {{habitat:number, crew:number, consumables:number, total:number}} Masses [kg].
 */
export function crewPayloadMass({ crewSize, transitTime, habitatMass, closure = DEFAULT_CLOSURE }) {
  validateCrewSize(crewSize);
  if (!(transitTime > 0)) throw new RangeError('transitTime must be positive');
  const P = CREW_PAYLOAD;
  const habitat = habitatMass ?? P.habitatBaseMass + P.habitatMassPerCrew * crewSize;
  if (!(habitat > 0)) throw new RangeError('habitatMass must be positive');
  const crew = P.crewMassPerPerson * crewSize;
  const consumables = lifeSupportMass({ crewSize, outboundTime: transitTime, closure }).outbound.closedLoop;
  return { habitat, crew, consumables, total: habitat + crew + consumables };
}

/**
 * Δv margin (reserve) from the 1–10 risk-tolerance slider: 12% of the
 * planned Δv at 1 (conservative) down to 2% at 10 (aggressive). Typical
 * mission design carries a few percent to ~10%, so this spans that range.
 * @param {number} riskTolerance 1–10.
 * @returns {number} Fractional margin, e.g. 0.07 means +7%.
 */
export function deltaVMargin(riskTolerance) {
  validateRisk(riskTolerance);
  return 0.12 - ((riskTolerance - 1) / 9) * 0.1;
}

/**
 * Illustrative crew-health index (0–100). NOT a medical model:
 *   100 − 25 × (mission dose / 600 mSv career limit) − 1 × (months in zero-g)
 * It only shows the direction of two real effects: radiation (cancer risk)
 * and weightlessness (bone and muscle loss; LeBlanc et al., J. Musculoskelet.
 * Neuronal Interact. 1(2):157–160, 2000, measured ≈ 1.0–1.6 % per month hip
 * bone-density loss on long Mir flights). The UI does not show a bone-loss
 * percentage.
 * @param {object} p
 * @param {number} p.missionDose      [Sv]
 * @param {number} p.microgravityTime Time spent weightless [s].
 * @returns {number} 0–100.
 */
export function crewHealthIndex({ missionDose, microgravityTime }) {
  const months = microgravityTime / (30.44 * DAY);
  const score = 100 - 25 * (missionDose / CAREER_DOSE_LIMIT) - months;
  return Math.min(100, Math.max(0, score));
}

/* ── Validation ─────────────────────────────────────────────────────────── */

function validateCrewSize(crewSize) {
  if (!Number.isInteger(crewSize) || crewSize < CREW_SIZE_RANGE.min || crewSize > CREW_SIZE_RANGE.max) {
    throw new RangeError(`crewSize must be an integer ${CREW_SIZE_RANGE.min}–${CREW_SIZE_RANGE.max} (got ${crewSize})`);
  }
}

function validateRisk(risk) {
  if (typeof risk !== 'number' || !(risk >= 1 && risk <= 10)) {
    throw new RangeError(`riskTolerance must be a number 1–10 (got ${risk})`);
  }
}

function resolveVehicle(vehicle) {
  const v = typeof vehicle === 'string' ? VEHICLES[vehicle] : vehicle;
  if (!v || typeof v.isp !== 'number') throw new TypeError(`Unknown vehicle: ${String(vehicle)}`);
  return v;
}

/**
 * Picks the date to search for a window from. Precedence: windowId, then
 * launchDate, then launchYear, then DEFAULT_WINDOW_ID.
 * @returns {{nearDate: Date, windowId: string|null}}
 */
function resolveLaunch({ windowId, launchDate, launchYear }) {
  if (windowId !== undefined && windowId !== null) {
    const w = getWindow(windowId);
    return { nearDate: new Date(w.departureDate), windowId: w.id };
  }
  if (launchDate !== undefined) {
    if (!(launchDate instanceof Date) || Number.isNaN(launchDate.getTime())) throw new TypeError('launchDate must be a valid Date');
    return { nearDate: launchDate, windowId: null };
  }
  if (launchYear !== undefined) {
    if (!Number.isInteger(launchYear) || launchYear < 1900 || launchYear > 2100) {
      throw new RangeError('launchYear must be an integer 1900–2100 (orbital elements are valid ~1800–2050)');
    }
    return { nearDate: new Date(Date.UTC(launchYear, 6, 1)), windowId: null };
  }
  const w = getWindow(DEFAULT_WINDOW_ID);
  return { nearDate: new Date(w.departureDate), windowId: w.id };
}

/* ── The simulation ─────────────────────────────────────────────────────── */

/**
 * @typedef {{kind:'fastest'} | {kind:'hohmann'} | {kind:'timeOfFlight', timeOfFlight:number}} TransferChoice
 *   - 'hohmann': minimum-energy transfer (same trajectory for every vehicle).
 *   - 'timeOfFlight': a fixed transit time [s] (same trajectory for every vehicle).
 *   - 'fastest': each vehicle flies the fastest transfer that one full load of
 *     its tanks can deliver while keeping the risk-based Δv margin, so higher
 *     performance buys a shorter trip.
 */

/**
 * Simulates a crewed Earth→Mars mission for one in-space stage.
 *
 * See README.md for the full output shape. Main keys: inputs, vehicle,
 * launchVehicle, feasible, departureDate, transitTime, deltaV, mass,
 * launches, launchPlan, cost, duration, dose, lifeSupport, success,
 * successFactors, crewHealthIndex, events, eventSummary, score.
 *
 * @param {object} p
 * @param {string|import('./vehicles.js').Vehicle} p.vehicle Stage id ('chemical' | 'nuclear' | 'starship') or a vehicle object.
 * @param {string} [p.launchVehicle]    Launch-vehicle id; defaults to the stage's defaultLaunchVehicle.
 * @param {number} [p.crewSize=4]       Integer 2–8.
 * @param {string} [p.windowId]         Fixed window id from windows.js (e.g. '2028-12'). Takes precedence over dates.
 * @param {Date}   [p.launchDate]       A date near the desired launch window (the closest window within ±390 days is used).
 * @param {number} [p.launchYear]       Alternative to launchDate: uses 1 July of that year as the search start.
 *   With no windowId/launchDate/launchYear, DEFAULT_WINDOW_ID is used.
 * @param {TransferChoice} [p.transferChoice={kind:'fastest'}]
 * @param {number} [p.riskTolerance=5]  1 (conservative, 12% Δv margin) … 10 (aggressive, 2%).
 * @param {number} [p.habitatMass]      Override the common habitat mass [kg] (custom builds).
 * @param {number|null} [p.seed=null]   uint32 seed for gameplay events; null = no events (nominal flight).
 * @param {{water:number, oxygen:number}} [p.closure] Life-support recycling closure (default ISS-class).
 * @returns {object} MissionResult (plain JSON).
 * @throws {RangeError} For out-of-range inputs or a launch vehicle that cannot lift this stage.
 */
export function simulateMission({
  vehicle: vehicleInput,
  launchVehicle: launchVehicleInput,
  crewSize = 4,
  windowId: windowIdInput,
  launchDate,
  launchYear,
  transferChoice = { kind: 'fastest' },
  riskTolerance = 5,
  habitatMass,
  seed = null,
  closure = DEFAULT_CLOSURE,
} = {}) {
  const vehicle = resolveVehicle(vehicleInput);
  validateCrewSize(crewSize);
  validateRisk(riskTolerance);
  if (seed !== null) validateSeed(seed);
  const launchVehicleId = launchVehicleInput ?? vehicle.defaultLaunchVehicle;
  const launchVehicle = getLaunchVehicle(launchVehicleId);
  const compat = launchCompatibility(vehicle, launchVehicleId);
  if (!compat.ok) throw new RangeError(compat.reason);
  const { nearDate, windowId } = resolveLaunch({ windowId: windowIdInput, launchDate, launchYear });
  const kind = transferChoice?.kind;
  if (!['fastest', 'hohmann', 'timeOfFlight'].includes(kind)) {
    throw new TypeError("transferChoice.kind must be 'fastest', 'hohmann' or 'timeOfFlight'");
  }
  if (kind === 'timeOfFlight' && !(transferChoice.timeOfFlight > 0)) {
    throw new RangeError('transferChoice.timeOfFlight must be a positive number of seconds');
  }

  const margin = deltaVMargin(riskTolerance);
  const rLeo = R_EARTH + LEO_ALTITUDE;
  const rCapPeri = R_MARS + MARS_CAPTURE_PERIAPSIS_ALTITUDE;
  const rCapApo = R_MARS + MARS_CAPTURE_APOAPSIS_ALTITUDE;
  const maxArrivalVInf = vehicle.marsCapture === 'aerocapture'
    ? maxVInfForEntrySpeed(vehicle.maxEntrySpeed, MU_MARS, R_MARS + MARS_ENTRY_INTERFACE_ALTITUDE)
    : Infinity;

  /** Size the vehicle for one transfer; returns null if the geometry is impossible. */
  const evaluate = (spec, near) => {
    let w;
    try {
      w = solveTransferWindow({ transfer: spec, nearDate: near });
    } catch (err) {
      if (err instanceof RangeError) return null;
      throw err;
    }
    const departure = departureBurnDeltaV(w.vInfDeparture, MU_EARTH, rLeo);
    const capture = vehicle.marsCapture === 'propulsive'
      ? captureBurnDeltaV(w.vInfArrival, MU_MARS, rCapPeri, rCapApo)
      : 0;
    const total = departure + capture;
    const planned = total * (1 + margin);
    const payload = crewPayloadMass({ crewSize, transitTime: w.timeOfFlight, habitatMass, closure });
    const dry = vehicle.stageDryMass + payload.total;
    const propellant = propellantForDeltaV(planned, dry, vehicle.isp);
    const capability = maxDeltaV(vehicle.isp, dry, vehicle.propellantCapacity);
    let reason = null;
    if (w.vInfArrival > maxArrivalVInf) {
      reason = `Arrival v∞ ${(w.vInfArrival / 1000).toFixed(2)} km/s exceeds the ${(maxArrivalVInf / 1000).toFixed(2)} km/s aerocapture limit`;
    } else if (propellant > vehicle.propellantCapacity) {
      reason = `Needs ${(propellant / 1000).toFixed(0)} t of propellant; tanks hold ${(vehicle.propellantCapacity / 1000).toFixed(0)} t`;
    }
    return { w, departure, capture, total, planned, payload, dry, propellant, capability, reason };
  };

  const ctx = { vehicle, launchVehicle, transferChoice, crewSize, riskTolerance, seed, windowId, margin, habitatMass, closure };

  // The minimum-energy transfer anchors the window and serves as a reference.
  const hohmann = evaluate({ kind: 'hohmann' }, nearDate);
  if (!hohmann) throw new RangeError('Could not solve the launch window for this date');
  const windowDate = hohmann.w.departureDate;

  let chosen;
  if (kind === 'hohmann') {
    chosen = hohmann;
  } else if (kind === 'timeOfFlight') {
    chosen = evaluate({ kind: 'timeOfFlight', timeOfFlight: transferChoice.timeOfFlight }, windowDate);
    if (!chosen) {
      return infeasibleResult(ctx, hohmann,
        `A ${(transferChoice.timeOfFlight / DAY).toFixed(0)}-day transfer is outside the range this model can fly in this window ` +
        `(must be faster than the ${(hohmann.w.timeOfFlight / DAY).toFixed(0)}-day minimum-energy transfer)`);
    }
  } else {
    // 'fastest': bisection on transit time between a near-parabolic floor and Hohmann.
    if (hohmann.reason) chosen = hohmann;
    else {
      let hi = hohmann.w.timeOfFlight; // known feasible
      let lo = 60 * DAY; // faster than any feasible design here
      let best = hohmann;
      for (let i = 0; i < 40 && hi - lo > 0.01 * DAY; i++) {
        const mid = (lo + hi) / 2;
        const trial = evaluate({ kind: 'timeOfFlight', timeOfFlight: mid }, windowDate);
        if (trial && !trial.reason) { best = trial; hi = mid; } else lo = mid;
      }
      chosen = best;
    }
  }
  if (chosen.reason) return infeasibleResult(ctx, hohmann, chosen.reason, chosen);

  return buildResult(ctx, chosen, hohmann);
}

/**
 * Launch count for a stack.
 *   assembled: ceil(mass in LEO / launcher payload)
 *   tanker:    1 (the crewed ship) + ceil(propellant / propellant per tanker)
 */
function launchCount(vehicle, launchVehicle, initialMassInLEO, propellant) {
  return vehicle.launchMode === 'tanker'
    ? 1 + launchesRequired(propellant, launchVehicle.payloadLeoKg)
    : launchesRequired(initialMassInLEO, launchVehicle.payloadLeoKg);
}

function vehicleSummary(v) {
  return {
    id: v.id,
    name: v.name,
    isp: v.isp,
    stageDryMass: v.stageDryMass,
    propellantCapacity: v.propellantCapacity,
    marsCapture: v.marsCapture,
    gcrShieldingFactor: v.gcrShieldingFactor,
    launchMode: v.launchMode,
    trl: v.trl,
    hardwareCost: v.hardwareCost,
  };
}

function launchVehicleSummary(lv) {
  return {
    id: lv.id,
    name: lv.name,
    payloadLeoKg: lv.payloadLeoKg,
    costPerLaunchUsd: lv.costPerLaunchUsd,
    status: lv.status,
    reliabilityClass: lv.reliabilityClass,
    launchReliability: lv.launchReliability,
  };
}

function inputsSummary(ctx) {
  return {
    vehicleId: ctx.vehicle.id,
    launchVehicleId: ctx.launchVehicle.id,
    crewSize: ctx.crewSize,
    riskTolerance: ctx.riskTolerance,
    windowId: ctx.windowId,
    seed: ctx.seed,
    transferChoice: ctx.transferChoice.kind === 'timeOfFlight'
      ? { kind: 'timeOfFlight', timeOfFlight: ctx.transferChoice.timeOfFlight }
      : { kind: ctx.transferChoice.kind },
    habitatMass: ctx.habitatMass ?? null,
    closure: { water: ctx.closure.water, oxygen: ctx.closure.oxygen },
  };
}

function buildResult(ctx, chosen, hohmann) {
  const { vehicle, launchVehicle, crewSize, riskTolerance, seed, margin, closure } = ctx;
  const { w } = chosen;
  const pathLength = transferArcLength(w);
  const initialMassInLEO = chosen.dry + chosen.propellant;
  const launches = launchCount(vehicle, launchVehicle, initialMassInLEO, chosen.propellant);
  const launchCost = launches * launchVehicle.costPerLaunchUsd;

  const outbound = w.timeOfFlight;
  const surfaceStay = conjunctionStayTime({ transferAngle: w.transferAngle, timeOfFlight: outbound });
  const returnTime = outbound; // mirror-image return leg
  const totalDuration = outbound + surfaceStay + returnTime;

  const success = successEstimate({ vehicle, launchVehicle, launches, margin });

  // Gameplay events (only with a seed). The Δv reserve is the margin carried
  // beyond the required Δv.
  const burns = [{ id: 'tmi', label: 'Trans-Mars injection', deltaV: chosen.departure }];
  if (vehicle.marsCapture === 'propulsive') burns.push({ id: 'capture', label: 'Mars capture burn', deltaV: chosen.capture });
  const events = seed === null ? [] : scheduleEvents({ seed, riskTolerance, outboundTime: outbound, surfaceTime: surfaceStay, returnTime, burns });
  const eventSummary = summarizeEvents(events, { deltaVReserve: chosen.planned - chosen.total });

  const cruiseRate = GCR_CRUISE_DOSE_RATE * vehicle.gcrShieldingFactor;
  const dose = {
    outbound: cruiseRate * outbound,
    surface: MARS_SURFACE_DOSE_RATE * surfaceStay,
    return: cruiseRate * returnTime,
    events: eventSummary.extraDose,
  };
  dose.total = dose.outbound + dose.surface + dose.return + dose.events;
  dose.careerFraction = dose.total / CAREER_DOSE_LIMIT;
  dose.careerLimit = CAREER_DOSE_LIMIT;
  dose.exceedsCareerLimit = dose.total > CAREER_DOSE_LIMIT;

  const result = {
    schemaVersion: MISSION_SCHEMA_VERSION,
    inputs: inputsSummary(ctx),
    vehicleId: vehicle.id,
    launchVehicleId: launchVehicle.id,
    windowId: ctx.windowId,
    vehicle: vehicleSummary(vehicle),
    launchVehicle: launchVehicleSummary(launchVehicle),
    feasible: true,
    infeasibleReason: null,
    transferChoice: inputsSummary(ctx).transferChoice,
    departureDate: w.departureDate.toISOString(),
    arrivalDate: w.arrivalDate.toISOString(),
    transitTime: outbound,
    hohmannTransitTime: hohmann.w.timeOfFlight,
    transferAngle: w.transferAngle,
    pathLength,
    averageSpeed: pathLength / outbound,
    vInfDeparture: w.vInfDeparture,
    vInfArrival: w.vInfArrival,
    deltaV: {
      departure: chosen.departure,
      capture: chosen.capture,
      total: chosen.total,
      planned: chosen.planned,
      capability: chosen.capability,
      reserve: chosen.capability - chosen.total,
      margin,
      hohmannTotal: hohmann.total,
    },
    mass: {
      habitat: chosen.payload.habitat,
      crew: chosen.payload.crew,
      consumables: chosen.payload.consumables,
      payload: chosen.payload.total,
      stageDry: vehicle.stageDryMass,
      dry: chosen.dry,
      propellant: chosen.propellant,
      initialMassInLEO,
      hohmannPropellant: hohmann.propellant,
    },
    launches,
    launchPlan: {
      launchVehicleId: launchVehicle.id,
      capacityPerLaunch: launchVehicle.payloadLeoKg,
      crewedLaunches: 1,
      uncrewedLaunches: launches - 1,
      expectedReflights: success.recoverable.expectedReflights,
      expectedLaunches: launches + success.recoverable.expectedReflights,
      reflightDelayDays: success.recoverable.delayDays,
    },
    cost: {
      hardware: vehicle.hardwareCost,
      launches: launchCost,
      reflightReserve: success.recoverable.costPenaltyUsd,
      total: vehicle.hardwareCost + launchCost + success.recoverable.costPenaltyUsd,
    },
    duration: { outbound, surfaceStay, return: returnTime, total: totalDuration },
    dose,
    lifeSupport: lifeSupportMass({ crewSize, outboundTime: outbound, surfaceTime: surfaceStay, returnTime, closure }),
    success: { probability: success.probability, recoverable: success.recoverable },
    successFactors: success.factors,
    crewHealthIndex: crewHealthIndex({ missionDose: dose.total, microgravityTime: outbound + returnTime }),
    events,
    eventSummary,
    framing: missionFraming(vehicle, launchVehicle, dose),
  };
  result.score = scoreMission(result, { bestWindowId: BEST_WINDOW_ID });
  return result;
}

function infeasibleResult(ctx, hohmann, reason, attempted) {
  const w = attempted?.w ?? hohmann.w;
  return {
    schemaVersion: MISSION_SCHEMA_VERSION,
    inputs: inputsSummary(ctx),
    vehicleId: ctx.vehicle.id,
    launchVehicleId: ctx.launchVehicle.id,
    windowId: ctx.windowId,
    vehicle: vehicleSummary(ctx.vehicle),
    launchVehicle: launchVehicleSummary(ctx.launchVehicle),
    feasible: false,
    infeasibleReason: reason,
    transferChoice: inputsSummary(ctx).transferChoice,
    departureDate: w.departureDate.toISOString(),
    arrivalDate: w.arrivalDate.toISOString(),
    transitTime: null,
    hohmannTransitTime: hohmann.w.timeOfFlight,
    deltaV: attempted
      ? { departure: attempted.departure, capture: attempted.capture, total: attempted.total, capability: attempted.capability }
      : null,
    successFactors: [],
    events: [],
    score: scoreMission(null),
  };
}
