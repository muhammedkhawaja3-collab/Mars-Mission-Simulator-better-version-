/**
 * Flight replay model: maps the replay clock onto each vehicle's own mission
 * timeline. Pure functions; every input comes from the engine's MissionResult.
 *
 * The replay compresses the longest outbound transfer into FLIGHT_REPLAY_MS.
 * All vehicles depart together on mission day 0, so a vehicle with a shorter
 * transfer reaches Mars earlier in the replay. Nothing here changes physics:
 * seeded events are shown on the day the engine scheduled them.
 */
import { exhaustVelocity, toMilliSieverts } from '../physics/index.js';
import { clamp } from './format.js';

/** Longest outbound transit (days) among vehicles that can fly; 0 if none. */
export function maxTransitDays(rockets) {
  const days = rockets.filter((r) => !r.failed).map((r) => r.transit);
  return days.length ? Math.max(...days) : 0;
}

/**
 * Mission day at which seeded engine faults exhaust the Δv reserve
 * (planned − required Δv), or null if the reserve survives.
 * @param {object} mission MissionResult
 */
export function abortDay(mission) {
  if (!mission?.eventSummary?.abort) return null;
  const reserve = mission.deltaV.planned - mission.deltaV.total;
  let used = 0;
  for (const e of mission.events) {
    used += e.effects.deltaVPenalty;
    if (used > reserve) return e.day;
  }
  return null;
}

/**
 * State of one vehicle at a replay fraction.
 * @param {import('./fleet.js').DisplayRocket} rocket
 * @param {number} replayFraction 0…1 of the replay clock.
 * @param {number} maxTransit     Longest transit in the comparison [days].
 */
export function vehicleState(rocket, replayFraction, maxTransit) {
  if (rocket.failed) {
    return { status: 'no-go', progress: 0, day: 0 };
  }
  const missionDay = clamp(replayFraction, 0, 1) * maxTransit;
  const stopDay = abortDay(rocket.mission);
  if (stopDay !== null && missionDay >= stopDay) {
    return { status: 'aborted', progress: clamp(stopDay / rocket.transit, 0, 1), day: stopDay };
  }
  const progress = rocket.transit > 0 ? clamp(missionDay / rocket.transit, 0, 1) : 1;
  const day = Math.min(missionDay, rocket.transit);
  return { status: progress >= 1 ? 'arrived' : 'transit', progress, day };
}

/**
 * Events (from the engine's seeded list) that have happened by `day` during
 * the outbound leg: TMI faults, cruise events and, on arrival, capture faults.
 */
export function outboundEventsUntil(rocket, day) {
  if (rocket.failed) return [];
  return rocket.events.filter(
    (e) => (e.phase === 'outbound' || e.phase === 'burn') && e.day <= day,
  );
}

/**
 * Outbound radiation dose so far [mSv]: GCR cruise dose pro-rated by time
 * plus the seeded solar particle events that have occurred.
 */
export function doseSoFar(rocket, day) {
  if (rocket.failed) return 0;
  const m = rocket.mission;
  const fraction = clamp(day / rocket.transit, 0, 1);
  const eventDose = outboundEventsUntil(rocket, day).reduce((s, e) => s + e.effects.extraDose, 0);
  return toMilliSieverts(m.dose.outbound * fraction + eventDose);
}

/**
 * Propellant remaining [kg] on the in-space stage. Burns are impulsive, so
 * this is a step function: full tanks before TMI (day 0), then what is left
 * after TMI, then what is left after the Mars capture burn (0 Δv for
 * aerocapture). Engine-fault Δv penalties are added to the burn they hit.
 */
export function propellantRemaining(rocket, day, { started = true, arrived = false } = {}) {
  if (rocket.failed) return 0;
  const m = rocket.mission;
  const ve = exhaustVelocity(m.vehicle.isp);
  const dry = m.mass.dry;
  const m0 = dry + m.mass.propellant;
  if (!started) return m.mass.propellant;
  const penalty = (burn) =>
    m.events
      .filter((e) => e.burn === burn && (burn === 'tmi' || e.day <= day))
      .reduce((s, e) => s + e.effects.deltaVPenalty, 0);
  const m1 = m0 * Math.exp(-(m.deltaV.departure + penalty('tmi')) / ve);
  if (!arrived) return Math.max(0, m1 - dry);
  const m2 = m1 * Math.exp(-(m.deltaV.capture + penalty('capture')) / ve);
  return Math.max(0, m2 - dry);
}

/** Every vehicle's state at a replay fraction, keyed by rocket key. */
export function fleetStates(rockets, replayFraction) {
  const maxTransit = maxTransitDays(rockets);
  return Object.fromEntries(
    rockets.map((r) => [r.key, vehicleState(r, replayFraction, maxTransit)]),
  );
}
