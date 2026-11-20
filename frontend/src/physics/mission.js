/**
 * Mission model: flies one vehicle from LEO to Mars orbit in a real launch
 * window and reports transit time, Δv, propellant, launches, cost,
 * radiation, and simple success/health indicators.
 *
 * What is modelled with physics:
 *   - Launch-window phasing on Mars' real eccentric orbit (ephemeris.js)
 *   - Heliocentric transfer: minimum-energy, or faster tangential-departure
 *     transfers that trade Δv for time (orbits.js)
 *   - Patched-conic burns: Earth departure from 400 km LEO, then Mars capture
 *     into the DRA 5.0 1-sol ellipse (or aerocapture with an entry-speed cap)
 *   - Propellant via the rocket equation, and launch counts (rocket.js)
 *   - Radiation dose from measured Curiosity/RAD dose rates × time
 *
 * What is a documented HEURISTIC, not rigorous engineering:
 *   - successProbability: product of per-event reliabilities (see below)
 *   - crewHealthIndex: illustrative 0–100 score from dose and zero-g time
 *
 * Scope: the propulsive model covers the crewed outbound leg. The return
 * leg is assumed to be a mirror-image transfer. It counts toward mission
 * duration and radiation dose, but its propulsion is not sized: as in
 * NASA DRA 5.0, the return vehicle/propellant is assumed pre-deployed or made
 * on Mars (ISRU).
 *
 * All inputs/outputs are SI (m, s, kg, m/s, Sv, USD). Dates are Date objects.
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

/* ── Common crew payload (identical for every vehicle) ──────────────────── */

/**
 * Crew payload assumptions. ESTIMATES, cross-checked against:
 *  - DRA 5.0 transit habitat ≈ 40 t class for 6 crew → 15 t + 4.5 t/crew = 42 t at 6.
 *  - NASA Baseline Values and Assumptions Document (BVAD, NASA/TP-2015-218570):
 *    food ≈ 1.8 kg/crew-day with packaging; with partly closed-loop water and
 *    O₂ recovery, ≈ 5 kg/crew-day of consumables and spares is a round planning value.
 */
export const CREW_PAYLOAD = Object.freeze({
  habitatBaseMass: 15_000, // kg
  habitatMassPerCrew: 4_500, // kg/person
  crewMassPerPerson: 100, // kg/person (body + personal kit)
  consumablesPerCrewDay: 5.0, // kg/(person·day)
  contingencyDays: 30, // extra days of consumables carried on the outbound leg
});

/** Allowed crew sizes (integer). */
export const CREW_SIZE_RANGE = Object.freeze({ min: 1, max: 12 });

/**
 * Crew payload mass for the outbound leg.
 * @param {object} p
 * @param {number} p.crewSize      Number of crew (integer ≥ 1).
 * @param {number} p.transitTime   Outbound transit time [s].
 * @param {number} [p.habitatMass] Override the habitat mass [kg] (custom builds).
 * @returns {{habitat:number, crew:number, consumables:number, total:number}} Masses [kg].
 */
export function crewPayloadMass({ crewSize, transitTime, habitatMass }) {
  validateCrewSize(crewSize);
  if (!(transitTime > 0)) throw new RangeError('transitTime must be positive');
  const P = CREW_PAYLOAD;
  const habitat = habitatMass ?? P.habitatBaseMass + P.habitatMassPerCrew * crewSize;
  if (!(habitat > 0)) throw new RangeError('habitatMass must be positive');
  const crew = P.crewMassPerPerson * crewSize;
  const consumables = P.consumablesPerCrewDay * crewSize * (transitTime / DAY + P.contingencyDays);
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

/* ── Heuristic reliability and health models ────────────────────────────── */

/** Heuristic probability that any single launch succeeds (modern operational launchers ≈ 0.98–0.99+). */
export const LAUNCH_RELIABILITY = 0.99;

/**
 * Heuristic success probability. It multiplies independent per-event
 * probabilities:
 *   P = p_launch^launches × p_op^(launches−1) × p_burn^burns × p_aero × p_margin,
 *   p_margin = 1 − 0.10·exp(−margin / 0.04)
 * The margin term means thin Δv reserves leave less room for dispersions or
 * engine underperformance.
 * Assumes every launch and docking must succeed within the window (no spares),
 * which penalises architectures with many launches.
 * @param {object} p
 * @param {import('./vehicles.js').Vehicle} p.vehicle
 * @param {number} p.launches Total launches.
 * @param {number} p.burns    Major propulsive burns (TMI, MOI).
 * @param {number} p.margin   Fractional Δv margin.
 * @returns {{probability:number, factors:Record<string, number>}}
 */
export function successEstimate({ vehicle, launches, burns, margin }) {
  const factors = {
    launches: LAUNCH_RELIABILITY ** launches,
    orbitalOperations: vehicle.operationReliability ** Math.max(0, launches - 1),
    propulsion: vehicle.burnReliability ** burns,
    aerocapture: vehicle.marsCapture === 'aerocapture' ? (vehicle.aerocaptureReliability ?? 1) : 1,
    deltaVMargin: 1 - 0.1 * Math.exp(-margin / 0.04),
  };
  const probability = Object.values(factors).reduce((p, f) => p * f, 1);
  return { probability, factors };
}

/**
 * Illustrative crew-health index (0–100). NOT a medical model:
 *   100 − 25 × (mission dose / 600 mSv career limit) − 1 × (months in zero-g)
 * It just shows the direction of two real effects: radiation (cancer risk)
 * and weightlessness (bone/muscle loss, roughly ~1%/month of hip bone density
 * without countermeasures).
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

function resolveLaunchDate({ launchDate, launchYear }) {
  if (launchDate !== undefined) {
    if (!(launchDate instanceof Date) || Number.isNaN(launchDate.getTime())) throw new TypeError('launchDate must be a valid Date');
    return launchDate;
  }
  if (launchYear !== undefined) {
    if (!Number.isInteger(launchYear) || launchYear < 1900 || launchYear > 2100) {
      throw new RangeError('launchYear must be an integer 1900–2100 (orbital elements are valid ~1800–2050)');
    }
    return new Date(Date.UTC(launchYear, 6, 1));
  }
  throw new TypeError('Provide launchDate (Date near the desired window) or launchYear');
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
 * @typedef {object} MissionResult
 * @property {string} vehicleId
 * @property {boolean} feasible
 * @property {string|null} infeasibleReason
 * @property {TransferChoice} transferChoice
 * @property {Date} departureDate
 * @property {Date} arrivalDate
 * @property {number} transitTime          Outbound time of flight [s].
 * @property {number} hohmannTransitTime   Minimum-energy transit in this window, for reference [s].
 * @property {number} transferAngle        [rad]
 * @property {number} pathLength           Distance flown along the heliocentric arc [m].
 * @property {number} averageSpeed         pathLength / transitTime, heliocentric [m/s].
 * @property {number} vInfDeparture        [m/s]
 * @property {number} vInfArrival          [m/s]
 * @property {{departure:number, capture:number, total:number, planned:number, capability:number, reserve:number, margin:number}} deltaV
 *   [m/s] except margin (fraction). planned = total × (1 + margin);
 *   capability = Δv with full tanks; reserve = capability − total.
 * @property {{habitat:number, crew:number, consumables:number, payload:number, stageDry:number, dry:number, propellant:number, initialMassInLEO:number}} mass [kg]
 * @property {number} launches
 * @property {{hardware:number, launches:number, total:number}} cost [USD]
 * @property {{transit:number, surface:number, return:number, mission:number, careerFraction:number}} dose [Sv]; careerFraction = mission / 600 mSv.
 * @property {{outbound:number, surfaceStay:number, return:number, total:number}} duration [s]
 * @property {number} consumablesPerCrewDay [kg]
 * @property {number} missionConsumablesMass Consumables for the whole round trip, for reference (not all carried by this vehicle) [kg].
 * @property {{probability:number, factors:Record<string, number>}} success  Heuristic.
 * @property {number} crewHealthIndex 0–100, heuristic.
 */

/**
 * Simulates a crewed Earth→Mars transfer for one vehicle.
 *
 * @param {object} p
 * @param {string|import('./vehicles.js').Vehicle} p.vehicle Vehicle id ('chemical' | 'nuclear' | 'starship') or a vehicle object.
 * @param {number} [p.crewSize=4]       Integer 1–12.
 * @param {Date}   [p.launchDate]       A date near the desired launch window (the closest window within ±390 days is used).
 * @param {number} [p.launchYear]       Alternative to launchDate: uses 1 July of that year as the search start.
 * @param {TransferChoice} [p.transferChoice={kind:'fastest'}]
 * @param {number} [p.riskTolerance=5]  1 (conservative, 12% Δv margin) … 10 (aggressive, 2%).
 * @param {number} [p.habitatMass]      Override the common habitat mass [kg] (custom builds).
 * @returns {MissionResult}
 */
export function simulateMission({
  vehicle: vehicleInput,
  crewSize = 4,
  launchDate,
  launchYear,
  transferChoice = { kind: 'fastest' },
  riskTolerance = 5,
  habitatMass,
} = {}) {
  const vehicle = resolveVehicle(vehicleInput);
  validateCrewSize(crewSize);
  validateRisk(riskTolerance);
  const nearDate = resolveLaunchDate({ launchDate, launchYear });
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
    const payload = crewPayloadMass({ crewSize, transitTime: w.timeOfFlight, habitatMass });
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
      return infeasibleResult(vehicle, transferChoice, hohmann,
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
  if (chosen.reason) return infeasibleResult(vehicle, transferChoice, hohmann, chosen.reason, chosen);

  return buildResult({ vehicle, transferChoice, chosen, hohmann, crewSize, margin });
}

function launchCount(vehicle, initialMassInLEO, propellant) {
  const { mode, capacityPerLaunch } = vehicle.launch;
  return mode === 'tanker'
    ? 1 + launchesRequired(propellant, capacityPerLaunch) // the ship itself + tankers
    : launchesRequired(initialMassInLEO, capacityPerLaunch);
}

function buildResult({ vehicle, transferChoice, chosen, hohmann, crewSize, margin }) {
  const { w } = chosen;
  const pathLength = transferArcLength(w);
  const initialMassInLEO = chosen.dry + chosen.propellant;
  const launches = launchCount(vehicle, initialMassInLEO, chosen.propellant);
  const launchCost = launches * vehicle.launch.costPerLaunch;

  const outbound = w.timeOfFlight;
  const surfaceStay = conjunctionStayTime({ transferAngle: w.transferAngle, timeOfFlight: outbound });
  const returnTime = outbound; // mirror-image return leg
  const cruiseRate = GCR_CRUISE_DOSE_RATE * vehicle.gcrShieldingFactor;
  const dose = {
    transit: cruiseRate * outbound,
    surface: MARS_SURFACE_DOSE_RATE * surfaceStay,
    return: cruiseRate * returnTime,
  };
  dose.mission = dose.transit + dose.surface + dose.return;
  dose.careerFraction = dose.mission / CAREER_DOSE_LIMIT;

  const burns = vehicle.marsCapture === 'propulsive' ? 2 : 1;
  const totalDuration = outbound + surfaceStay + returnTime;

  return {
    vehicleId: vehicle.id,
    feasible: true,
    infeasibleReason: null,
    transferChoice,
    departureDate: w.departureDate,
    arrivalDate: w.arrivalDate,
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
    },
    launches,
    cost: { hardware: vehicle.hardwareCost, launches: launchCost, total: vehicle.hardwareCost + launchCost },
    dose,
    duration: { outbound, surfaceStay, return: returnTime, total: totalDuration },
    consumablesPerCrewDay: CREW_PAYLOAD.consumablesPerCrewDay,
    missionConsumablesMass: CREW_PAYLOAD.consumablesPerCrewDay * crewSize * (totalDuration / DAY),
    success: successEstimate({ vehicle, launches, burns, margin }),
    crewHealthIndex: crewHealthIndex({ missionDose: dose.mission, microgravityTime: outbound + returnTime }),
  };
}

function infeasibleResult(vehicle, transferChoice, hohmann, reason, attempted) {
  const w = attempted?.w ?? hohmann.w;
  return {
    vehicleId: vehicle.id,
    feasible: false,
    infeasibleReason: reason,
    transferChoice,
    departureDate: w.departureDate,
    arrivalDate: w.arrivalDate,
    transitTime: null,
    hohmannTransitTime: hohmann.w.timeOfFlight,
    deltaV: attempted
      ? { departure: attempted.departure, capture: attempted.capture, total: attempted.total, capability: attempted.capability }
      : null,
  };
}
