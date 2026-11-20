/**
 * Where the planets are on a given date, and when the launch windows open.
 *
 * Planet positions come from J2000 mean orbital elements (Standish, JPL),
 * propagated with Kepler's equation and projected onto the ecliptic plane
 * (inclination ignored). This places Mars on its real eccentric orbit
 * (1.38–1.67 AU), so different launch windows really do differ. Good windows
 * are the ones that arrive while Mars is near perihelion.
 *
 * A launch window is the departure date on which a transfer, launched from
 * Earth, reaches Mars' orbit exactly when Mars is there.
 *
 * SI units throughout; dates are JavaScript Date objects (UTC).
 */
import {
  AU, DAY, MU_SUN, J2000_EPOCH_MS, EARTH_ELEMENTS, MARS_ELEMENTS,
  EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD,
} from './constants.js';
import { tangentialTransfer, transferForTimeOfFlight, synodicPeriod } from './orbits.js';

const DEG = Math.PI / 180;
const MS_PER_CENTURY = 36525 * DAY * 1000;
const TWO_PI = 2 * Math.PI;

/** Earth–Mars synodic period [s] (≈ 779.9 days). */
export const EARTH_MARS_SYNODIC_PERIOD = synodicPeriod(EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD);

/** Wrap an angle to (−π, π]. */
export function wrapToPi(angle) {
  let a = (angle + Math.PI) % TWO_PI;
  if (a <= 0) a += TWO_PI;
  return a - Math.PI;
}

function requireDate(name, date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

/**
 * Solve Kepler's equation M = E − e sin E for the eccentric anomaly (Newton's method).
 * @param {number} meanAnomaly M [rad].
 * @param {number} e Eccentricity, 0 ≤ e < 1.
 * @returns {number} Eccentric anomaly E [rad].
 */
export function solveKepler(meanAnomaly, e) {
  if (!(e >= 0 && e < 1)) throw new RangeError(`eccentricity must be in [0, 1) (got ${e})`);
  const M = wrapToPi(meanAnomaly);
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-14) break;
  }
  return E;
}

/**
 * @typedef {object} PlanetState
 * @property {number} r          Distance from the Sun [m].
 * @property {number} longitude  Heliocentric ecliptic longitude [rad].
 * @property {{radial:number, tangential:number}} velocity Heliocentric velocity [m/s].
 */

/**
 * Heliocentric position and velocity of a planet from mean orbital elements.
 * @param {typeof MARS_ELEMENTS} elements Mean elements (see constants.js).
 * @param {Date} date UTC date.
 * @returns {PlanetState}
 */
export function planetState(elements, date) {
  requireDate('date', date);
  const T = (date.getTime() - J2000_EPOCH_MS) / MS_PER_CENTURY;
  const { e } = elements;
  const a = elements.a * AU;
  const L = (elements.meanLongitude + elements.meanLongitudeRate * T) * DEG;
  const varpi = (elements.longitudePerihelion + elements.longitudePerihelionRate * T) * DEG;
  const E = solveKepler(L - varpi, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const p = a * (1 - e * e);
  const k = Math.sqrt(MU_SUN / p);
  return {
    r: a * (1 - e * Math.cos(E)),
    longitude: varpi + nu,
    velocity: { radial: k * e * Math.sin(nu), tangential: k * (1 + e * Math.cos(nu)) },
  };
}

/** Earth's heliocentric state on a date. @param {Date} date @returns {PlanetState} */
export const earthState = (date) => planetState(EARTH_ELEMENTS, date);

/** Mars' heliocentric state on a date. @param {Date} date @returns {PlanetState} */
export const marsState = (date) => planetState(MARS_ELEMENTS, date);

/**
 * @typedef {{kind:'hohmann'} | {kind:'timeOfFlight', timeOfFlight:number}} TransferSpec
 *   'hohmann' is the minimum-energy transfer (tangent at Earth and at Mars' orbit).
 *   'timeOfFlight' is a faster transfer with the given transit time [s].
 */

/**
 * @typedef {import('./orbits.js').TangentialTransfer & {
 *   departureDate: Date, arrivalDate: Date, r1: number, r2: number
 * }} WindowTransfer
 */

/**
 * Finds the departure date (near `nearDate`) on which the given transfer
 * reaches Mars' orbit exactly when Mars is there, and returns that transfer.
 *
 * Phasing condition: longitude of Mars at arrival = Earth's longitude at
 * departure + transfer angle. This is solved with Newton steps on the
 * departure date, using the Earth–Mars relative angular rate. Mars' distance
 * and velocity at arrival are updated on every iteration.
 *
 * @param {object} p
 * @param {TransferSpec} p.transfer Which transfer to fly.
 * @param {Date} p.nearDate Initial guess; the closest window (within about ±390 days) is returned.
 * @returns {WindowTransfer}
 * @throws {RangeError} If the transfer cannot be flown in this geometry.
 */
export function solveTransferWindow({ transfer, nearDate }) {
  requireDate('nearDate', nearDate);
  if (!transfer || (transfer.kind !== 'hohmann' && transfer.kind !== 'timeOfFlight')) {
    throw new TypeError("transfer.kind must be 'hohmann' or 'timeOfFlight'");
  }
  const relativeRate = TWO_PI / EARTH_ORBITAL_PERIOD - TWO_PI / MARS_ORBITAL_PERIOD; // rad/s
  let tof = transfer.kind === 'timeOfFlight' ? transfer.timeOfFlight : 259 * DAY;

  // For a fixed departure time, make the transfer consistent with where Mars
  // will be at arrival (Mars' distance depends on the arrival date, which
  // depends on the time of flight).
  const evaluate = (tMs) => {
    const earth = earthState(new Date(tMs));
    let mars;
    let result;
    for (let j = 0; j < 40; j++) {
      mars = marsState(new Date(tMs + tof * 1000));
      const geometry = {
        r1: earth.r, r2: mars.r,
        departurePlanetVelocity: earth.velocity, arrivalPlanetVelocity: mars.velocity,
      };
      result = transfer.kind === 'hohmann'
        ? tangentialTransfer({ ...geometry, rApoapsis: mars.r })
        : transferForTimeOfFlight({ ...geometry, timeOfFlight: transfer.timeOfFlight });
      const change = Math.abs(result.timeOfFlight - tof);
      tof = result.timeOfFlight;
      if (change < 0.01) break;
    }
    return {
      result: { ...result, r1: earth.r, r2: mars.r },
      phaseError: wrapToPi(mars.longitude - earth.longitude - result.transferAngle),
    };
  };

  let t = nearDate.getTime();
  for (let i = 0; i < 100; i++) {
    const { result, phaseError } = evaluate(t);
    if (Math.abs(phaseError) < 1e-9) {
      return {
        ...result,
        departureDate: new Date(t),
        arrivalDate: new Date(t + result.timeOfFlight * 1000),
      };
    }
    // d(phaseError)/dt ≈ −relativeRate, so a Newton step is +phaseError / relativeRate.
    t += (phaseError / relativeRate) * 1000;
  }
  throw new RangeError('Launch-window phasing did not converge');
}

/**
 * The next `count` minimum-energy (Hohmann-type) launch windows on or after a date.
 * @param {object} p
 * @param {Date} p.after Earliest acceptable departure date.
 * @param {number} [p.count=5] How many windows to return (1–20).
 * @returns {Array<{departureDate: Date, arrivalDate: Date, timeOfFlight: number, year: number}>}
 *   timeOfFlight in seconds; `year` is the UTC year of departure.
 */
export function launchWindows({ after, count = 5 }) {
  requireDate('after', after);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new RangeError('count must be an integer 1–20');
  const synodicMs = EARTH_MARS_SYNODIC_PERIOD * 1000;
  const hohmann = { kind: 'hohmann' };
  let w = solveTransferWindow({ transfer: hohmann, nearDate: after });
  while (w.departureDate < after) {
    w = solveTransferWindow({ transfer: hohmann, nearDate: new Date(w.departureDate.getTime() + synodicMs) });
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      departureDate: w.departureDate,
      arrivalDate: w.arrivalDate,
      timeOfFlight: w.timeOfFlight,
      year: w.departureDate.getUTCFullYear(),
    });
    w = solveTransferWindow({ transfer: hohmann, nearDate: new Date(w.departureDate.getTime() + synodicMs) });
  }
  return out;
}

/**
 * Surface stay for a conjunction-class round trip, where the return leg is a
 * mirror image of the outbound one (same transit time and transfer angle).
 *
 * At arrival Earth leads Mars by (n_E·T − θ). To fly the mirrored return,
 * Earth must lead Mars by (θ − n_E·T) when the crew leaves. The angle between
 * them changes at (n_E − n_M), so the wait is
 *   w = (2θ − 2·n_E·T + 2πk) / (n_E − n_M),
 * where k is the smallest integer that gives w ≥ minimumStay. Planets are on mean
 * circular motion here, a simplification. A Hohmann trip gives the classic
 * ≈ 455-day stay.
 *
 * @param {object} p
 * @param {number} p.transferAngle Outbound heliocentric transfer angle θ [rad].
 * @param {number} p.timeOfFlight  Outbound transit time T [s].
 * @param {number} [p.minimumStay=30 days] Shortest acceptable surface stay [s].
 * @returns {number} Surface stay [s].
 */
export function conjunctionStayTime({ transferAngle, timeOfFlight, minimumStay = 30 * DAY }) {
  if (!(transferAngle > 0 && transferAngle <= Math.PI)) throw new RangeError('transferAngle must be in (0, π]');
  if (!(timeOfFlight > 0)) throw new RangeError('timeOfFlight must be positive');
  if (!(minimumStay >= 0)) throw new RangeError('minimumStay must be ≥ 0');
  const nE = TWO_PI / EARTH_ORBITAL_PERIOD;
  const nM = TWO_PI / MARS_ORBITAL_PERIOD;
  const base = 2 * transferAngle - 2 * nE * timeOfFlight;
  const k = Math.ceil((minimumStay * (nE - nM) - base) / TWO_PI - 1e-12);
  return (base + TWO_PI * k) / (nE - nM);
}
