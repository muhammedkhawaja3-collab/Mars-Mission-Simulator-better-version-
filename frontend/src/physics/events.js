/**
 * In-flight events: GAMEPLAY MODEL.
 *
 * Seeded, reproducible events along the mission timeline: solar particle
 * events, engine faults at burns, micrometeoroid strikes and comms
 * blackouts. Same seed + same mission → identical events.
 *
 * Gameplay model means: the event ODDS are illustrative, chosen so a typical
 * mission sees a handful of events, and they scale with the risk-tolerance
 * slider (risk 1 → ×0.5, risk 10 → ×2.0). They are NOT reliability data.
 * The MAGNITUDES are grounded where a source exists (see each type below).
 *
 * Determinism contract (for the Python mirror), RNG = mulberry32(seed):
 *   1. TMI burn (day 0): one draw for an engine fault; if it fires, one more
 *      draw for its magnitude.
 *   2. Outbound cruise, for each whole day d = 0 … floor(outboundDays) − 1,
 *      for each cruise type in order [solar-particle-event, micrometeoroid,
 *      comms-blackout]: one draw; if it fires, one magnitude draw.
 *   3. Mars capture burn (propulsive capture only), day = outboundDays:
 *      same as step 1.
 *   4. Surface stay, each whole day: [comms-blackout] only.
 *   5. Return cruise, each whole day: same types as step 2.
 *   An event fires when draw < baseOdds × riskFactor(risk).
 *
 * SI units: Sv, m/s, kg, days for event timing (day counted from TMI).
 */
import { createRng, validateSeed } from './rng.js';
import { DAY } from './constants.js';

const MSV = 1e-3; // Sv

/**
 * Event types. baseOdds are per day (cruise/surface types) or per burn
 * (engine-fault) at risk factor 1.
 */
export const EVENT_TYPES = Object.freeze({
  'solar-particle-event': Object.freeze({
    label: 'Solar particle event',
    phases: Object.freeze(['outbound', 'return']),
    // GAMEPLAY ODDS, grounded: Curiosity/RAD recorded 5 significant SPEs in
    // ≈ 221 days of cruise near solar maximum (2011–12), ≈ 0.023/day.
    // Halved as a rough solar-cycle average (ESTIMATE).
    baseOdds: 0.01,
    // Dose equivalent per event: uniform 1.2–19.5 mSv, the range of per-event
    // values RAD measured behind MSL cruise-stage shielding (Hassler, NOAA
    // Space Weather Workshop 2016; Zeitlin et al., Science 340, 2013). The
    // 1.84 mSv/day cruise rate is GCR only, so this does not double count.
    // A dedicated storm shelter would lower these; extreme events such as
    // August 1972 are not represented. Surface SPEs are not modelled: Mars'
    // atmosphere attenuates them strongly.
    doseRange: Object.freeze([1.2 * MSV, 19.5 * MSV]),
  }),
  'engine-fault': Object.freeze({
    label: 'Engine fault during burn',
    phases: Object.freeze(['burn']),
    baseOdds: 0.03, // GAMEPLAY ODDS per burn
    // GAMEPLAY MAGNITUDE: the fault costs 1–5 % of that burn's Δv (restart,
    // off-nominal thrust, gravity losses), comparable to the 2–12 % Δv
    // reserve, so risk tolerance matters. If the total penalty exceeds the
    // reserve carried, the mission aborts.
    penaltyFractionRange: Object.freeze([0.01, 0.05]),
  }),
  micrometeoroid: Object.freeze({
    label: 'Micrometeoroid strike',
    phases: Object.freeze(['outbound', 'return']),
    baseOdds: 0.001, // GAMEPLAY ODDS per day (a strike that needs a repair)
    // GAMEPLAY MAGNITUDE: 10–100 kg of consumables lost (e.g. a punctured
    // water line), drawn from the 30-day contingency reserve.
    consumablesLossRange: Object.freeze([10, 100]),
  }),
  'comms-blackout': Object.freeze({
    label: 'Communications blackout',
    phases: Object.freeze(['outbound', 'surface', 'return']),
    baseOdds: 0.002, // GAMEPLAY ODDS per day
    // Grounded magnitude: Mars missions observe a ≈ 2-week command moratorium
    // around solar conjunction (NASA/JPL); blackouts last 1–14 days.
    outageDaysRange: Object.freeze([1, 14]),
  }),
});

const CRUISE_ORDER = Object.freeze(['solar-particle-event', 'micrometeoroid', 'comms-blackout']);
const SURFACE_ORDER = Object.freeze(['comms-blackout']);

/**
 * Multiplier on event odds from the 1–10 risk slider: 0.5 at 1, 2.0 at 10.
 * GAMEPLAY: aggressive plans accept more exposure (fewer conservative holds,
 * thinner maintenance margins).
 * @param {number} riskTolerance 1–10.
 */
export function riskFactor(riskTolerance) {
  if (typeof riskTolerance !== 'number' || !(riskTolerance >= 1 && riskTolerance <= 10)) {
    throw new RangeError(`riskTolerance must be a number 1–10 (got ${riskTolerance})`);
  }
  return 0.5 + (1.5 * (riskTolerance - 1)) / 9;
}

const noEffects = () => ({ extraDose: 0, deltaVPenalty: 0, consumablesLossKg: 0, commsOutageDays: 0 });

/**
 * @typedef {object} MissionEvent
 * @property {string} id         e.g. 'solar-particle-event-3' (index counts all events).
 * @property {string} type       Key of EVENT_TYPES.
 * @property {string} label
 * @property {'outbound'|'surface'|'return'|'burn'} phase
 * @property {string|null} burn  For engine faults, the burn id ('tmi' | 'capture').
 * @property {number} day        Mission day (from TMI) when it happens.
 * @property {'gameplay'} model
 * @property {{extraDose:number, deltaVPenalty:number, consumablesLossKg:number, commsOutageDays:number}} effects
 * @property {string} description Fixed text per type (numbers live in `effects`, so the UI formats them).
 */

/**
 * Schedules events along the mission timeline.
 * @param {object} p
 * @param {number} p.seed            Integer 0 … 2³² − 1.
 * @param {number} p.riskTolerance   1–10.
 * @param {number} p.outboundTime    [s]
 * @param {number} p.surfaceTime     [s]
 * @param {number} p.returnTime      [s]
 * @param {Array<{id:string, label:string, deltaV:number}>} p.burns
 *   Propulsive burns in order. 'tmi' happens at day 0 and 'capture' at arrival.
 * @returns {MissionEvent[]}
 */
export function scheduleEvents({ seed, riskTolerance, outboundTime, surfaceTime, returnTime, burns }) {
  validateSeed(seed);
  const factor = riskFactor(riskTolerance);
  const rng = createRng(seed);
  const events = [];
  const T = EVENT_TYPES;

  const push = (type, phase, day, effects, description, burn = null) => {
    events.push({
      id: `${type}-${events.length + 1}`,
      type,
      label: T[type].label,
      phase,
      burn,
      day,
      model: 'gameplay',
      effects: { ...noEffects(), ...effects },
      description,
    });
  };

  const burnCheck = (burn, day) => {
    const t = T['engine-fault'];
    if (rng.next() < t.baseOdds * factor) {
      const fraction = rng.uniform(t.penaltyFractionRange[0], t.penaltyFractionRange[1]);
      const penalty = fraction * burn.deltaV;
      push('engine-fault', 'burn', day, { deltaVPenalty: penalty },
        `${burn.label}: engine fault; extra Δv needed to complete the burn.`, burn.id);
    }
  };

  const dayCheck = (type, phase, day) => {
    const t = T[type];
    if (!(rng.next() < t.baseOdds * factor)) return;
    if (type === 'solar-particle-event') {
      const dose = rng.uniform(t.doseRange[0], t.doseRange[1]);
      push(type, phase, day, { extraDose: dose }, 'Solar particle event: crew moves to the storm shelter; extra radiation dose.');
    } else if (type === 'micrometeoroid') {
      const kg = rng.uniform(t.consumablesLossRange[0], t.consumablesLossRange[1]);
      push(type, phase, day, { consumablesLossKg: kg }, 'Micrometeoroid strike: hull repaired; some consumables lost.');
    } else {
      const days = rng.int(t.outageDaysRange[0], t.outageDaysRange[1]);
      push(type, phase, day, { commsOutageDays: days }, 'Communications blackout: the crew works autonomously until contact returns.');
    }
  };

  const outboundDays = outboundTime / DAY;
  const surfaceDays = surfaceTime / DAY;
  const returnDays = returnTime / DAY;
  const tmi = burns.find((b) => b.id === 'tmi');
  const capture = burns.find((b) => b.id === 'capture');

  if (tmi) burnCheck(tmi, 0);
  for (let d = 0; d < Math.floor(outboundDays); d++) for (const type of CRUISE_ORDER) dayCheck(type, 'outbound', d);
  if (capture) burnCheck(capture, outboundDays);
  for (let d = 0; d < Math.floor(surfaceDays); d++) for (const type of SURFACE_ORDER) dayCheck(type, 'surface', outboundDays + d);
  for (let d = 0; d < Math.floor(returnDays); d++) for (const type of CRUISE_ORDER) dayCheck(type, 'return', outboundDays + surfaceDays + d);
  return events;
}

/**
 * Totals the effects of a list of events and decides whether the Δv reserve
 * survives them.
 * @param {MissionEvent[]} events
 * @param {object} p
 * @param {number} p.deltaVReserve Δv carried beyond the requirement [m/s] (planned − required).
 * @returns {{count:number, byType:Record<string, number>, extraDose:number, deltaVPenalty:number,
 *   consumablesLossKg:number, commsOutageDays:number, deltaVReserveAfter:number, abort:boolean, abortReason:string|null}}
 */
export function summarizeEvents(events, { deltaVReserve }) {
  const byType = Object.fromEntries(Object.keys(EVENT_TYPES).map((k) => [k, 0]));
  let extraDose = 0;
  let deltaVPenalty = 0;
  let consumablesLossKg = 0;
  let commsOutageDays = 0;
  for (const e of events) {
    byType[e.type] += 1;
    extraDose += e.effects.extraDose;
    deltaVPenalty += e.effects.deltaVPenalty;
    consumablesLossKg += e.effects.consumablesLossKg;
    commsOutageDays += e.effects.commsOutageDays;
  }
  const deltaVReserveAfter = deltaVReserve - deltaVPenalty;
  const abort = deltaVReserveAfter < 0;
  return {
    count: events.length,
    byType,
    extraDose,
    deltaVPenalty,
    consumablesLossKg,
    commsOutageDays,
    deltaVReserveAfter,
    abort,
    abortReason: abort ? 'Engine faults used more Δv than the reserve carried: abort (gameplay model).' : null,
  };
}
