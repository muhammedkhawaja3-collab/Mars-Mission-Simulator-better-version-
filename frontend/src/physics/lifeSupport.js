/**
 * Life-support consumables: food, water and oxygen per crew member per day,
 * scaled by crew size and by mission phase (outbound cruise, surface stay,
 * return cruise), with and without recycling.
 *
 * Per-person rates come from the NASA Life Support Baseline Values and
 * Assumptions Document (BVAD), NASA/TP-2015-218570/REV2 (February 2022):
 *   - Oxygen: Table 3-31 "Summary of Nominal Human Metabolic Interface
 *     Values", Oxygen Consumed = 0.895 kg/CM-d (82 kg reference crew member
 *     exercising daily on a long mission).
 *   - Water: Table 4-20 "Typical Steady-State Water Usage Rates for Various
 *     Missions", Total Water Consumption = 3.2 kg/CM-d for a Transit Vehicle
 *     (2.0 drinking + 0.5 food rehydration + 0.7 hygiene/flush) and
 *     4.48 kg/CM-d for an Early Planetary Base (adds a 1.08 kg/CM-d shower and
 *     more flush water). Medical water (Table 4-20: 0.5 kg/CM-d + 5 kg) is
 *     not included.
 *   - Food: 2.39 kg/CM-d of individually packaged food, the ISS food supply
 *     planning value including packaging (BVAD Rev2 text under Table 3-31,
 *     citing Table 4-47 and Ewert et al. 2019).
 *
 * Recycling (ASSUMPTION, adjustable):
 *   - Water recovery 93 %: the ISS ECLSS total water recovery before the Brine
 *     Processor Assembly was 93–94 %; NASA reported 98 % demonstrated with the
 *     BPA in 2023 ("NASA Achieves Water Recovery Milestone on International
 *     Space Station", NASA, 2023). 93 % is used as the sustained,
 *     conservative value for a multi-year mission.
 *   - Oxygen recovery 50 %: Sabatier-based CO₂ reduction on ISS is limited to
 *     ≈ 50 % O₂ recovery because half of the hydrogen leaves as methane
 *     (NASA Exploration ECLSS overviews, e.g. ICES-2021-384).
 *   - Food is never recycled (no crop growth modelled).
 * Closed-loop mass = food + water × (1 − water closure) + O₂ × (1 − O₂ closure).
 * The mass of the recycling hardware and its spares is part of the habitat
 * allowance in mission.js, not counted here.
 *
 * SI units: kg, s. "CM-d" = crew-member-day.
 */
import { DAY } from './constants.js';

/** Per-crew-member daily rates [kg/CM-d]. See file header for table references. */
export const BVAD_RATES = Object.freeze({
  oxygen: 0.895, // BVAD Rev2 Table 3-31
  waterTransit: 3.2, // BVAD Rev2 Table 4-20, Transit Vehicle column
  waterSurface: 4.48, // BVAD Rev2 Table 4-20, Early Planetary Base column
  food: 2.39, // BVAD Rev2 §3.3 text under Table 3-31 / Table 4-47 (ISS, with packaging)
});

/** Default recycling closure fractions (ASSUMPTION, see header). */
export const DEFAULT_CLOSURE = Object.freeze({ water: 0.93, oxygen: 0.5 });

/** Crew sizes supported by the life-support and mission model. */
export const LIFE_SUPPORT_CREW_RANGE = Object.freeze({ min: 2, max: 8 });

/** Days of extra consumables carried beyond the planned mission (ASSUMPTION, planning reserve). */
export const CONTINGENCY_DAYS = 30;

function validateCrew(crewSize) {
  const { min, max } = LIFE_SUPPORT_CREW_RANGE;
  if (!Number.isInteger(crewSize) || crewSize < min || crewSize > max) {
    throw new RangeError(`crewSize must be an integer ${min}–${max} (got ${crewSize})`);
  }
}

function validateClosure(closure) {
  for (const k of ['water', 'oxygen']) {
    const v = closure[k];
    if (typeof v !== 'number' || !(v >= 0 && v < 1)) throw new RangeError(`closure.${k} must be in [0, 1) (got ${v})`);
  }
}

/**
 * Daily consumables for one crew member in a given environment.
 * @param {'transit'|'surface'} environment
 * @param {{water:number, oxygen:number}} [closure=DEFAULT_CLOSURE]
 * @returns {{food:number, water:number, oxygen:number, openLoop:number, closedLoop:number}} [kg/CM-d]
 *   food/water/oxygen are open-loop demands; closedLoop is the resupply mass after recycling.
 */
export function dailyConsumables(environment, closure = DEFAULT_CLOSURE) {
  if (environment !== 'transit' && environment !== 'surface') throw new TypeError("environment must be 'transit' or 'surface'");
  validateClosure(closure);
  const food = BVAD_RATES.food;
  const water = environment === 'transit' ? BVAD_RATES.waterTransit : BVAD_RATES.waterSurface;
  const oxygen = BVAD_RATES.oxygen;
  return {
    food,
    water,
    oxygen,
    openLoop: food + water + oxygen,
    closedLoop: food + water * (1 - closure.water) + oxygen * (1 - closure.oxygen),
  };
}

/**
 * Consumables for one mission phase.
 * @param {number} crewSize
 * @param {number} days
 * @param {'transit'|'surface'} environment
 * @param {{water:number, oxygen:number}} closure
 */
function phaseMass(crewSize, days, environment, closure) {
  const d = dailyConsumables(environment, closure);
  const cmd = crewSize * days;
  return {
    days,
    crewDays: cmd,
    food: d.food * cmd,
    water: d.water * cmd,
    oxygen: d.oxygen * cmd,
    openLoop: d.openLoop * cmd,
    closedLoop: d.closedLoop * cmd,
  };
}

/**
 * Life-support consumables for a whole conjunction-class mission.
 *
 * The outbound phase includes CONTINGENCY_DAYS of reserve. Masses are
 * linear in crew size and in each phase's length.
 *
 * @param {object} p
 * @param {number} p.crewSize         Integer 2–8.
 * @param {number} p.outboundTime     Outbound cruise [s].
 * @param {number} [p.surfaceTime=0]  Surface stay [s].
 * @param {number} [p.returnTime=0]   Return cruise [s].
 * @param {{water:number, oxygen:number}} [p.closure=DEFAULT_CLOSURE] Recycling fractions in [0, 1).
 * @returns {{
 *   crewSize:number, closure:{water:number, oxygen:number}, contingencyDays:number,
 *   ratesPerCrewDay:{transit:object, surface:object},
 *   outbound:object, surface:object, return:object,
 *   total:{food:number, water:number, oxygen:number, openLoop:number, closedLoop:number},
 * }} Masses [kg]; each phase object has days, crewDays, food, water, oxygen, openLoop, closedLoop.
 */
export function lifeSupportMass({ crewSize, outboundTime, surfaceTime = 0, returnTime = 0, closure = DEFAULT_CLOSURE }) {
  validateCrew(crewSize);
  validateClosure(closure);
  for (const [k, v] of Object.entries({ outboundTime, surfaceTime, returnTime })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a non-negative finite number of seconds`);
  }
  const outbound = phaseMass(crewSize, outboundTime / DAY + CONTINGENCY_DAYS, 'transit', closure);
  const surface = phaseMass(crewSize, surfaceTime / DAY, 'surface', closure);
  const ret = phaseMass(crewSize, returnTime / DAY, 'transit', closure);
  const sum = (k) => outbound[k] + surface[k] + ret[k];
  return {
    crewSize,
    closure: { water: closure.water, oxygen: closure.oxygen },
    contingencyDays: CONTINGENCY_DAYS,
    ratesPerCrewDay: { transit: dailyConsumables('transit', closure), surface: dailyConsumables('surface', closure) },
    outbound,
    surface,
    return: ret,
    total: { food: sum('food'), water: sum('water'), oxygen: sum('oxygen'), openLoop: sum('openLoop'), closedLoop: sum('closedLoop') },
  };
}
