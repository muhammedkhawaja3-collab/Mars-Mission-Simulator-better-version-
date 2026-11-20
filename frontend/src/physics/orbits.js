/**
 * Two-body orbital mechanics and patched-conic helpers.
 *
 * Patched conics: the trip is split into three two-body problems. Near Earth
 * the ship follows a hyperbola relative to Earth, between the planets it
 * follows an ellipse around the Sun, and near Mars it follows a hyperbola
 * relative to Mars. The pieces are joined by the hyperbolic excess speed v∞,
 * which is the ship's speed relative to a planet "far away" from it.
 *
 * All inputs and outputs are SI: metres, seconds, m/s, m³/s², radians.
 * Every function is pure and throws on invalid input instead of returning NaN.
 */
import { MU_SUN } from './constants.js';

/* ── Input validation ───────────────────────────────────────────────────── */

function requirePositive(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number (got ${value})`);
  }
}

function requireNonNegative(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number (got ${value})`);
  }
}

/* ── Basic two-body relations ───────────────────────────────────────────── */

/**
 * Speed of a circular orbit, v = √(μ / r).
 * @param {number} mu Gravitational parameter of the central body [m³/s²].
 * @param {number} r  Orbit radius [m].
 * @returns {number} Speed [m/s].
 */
export function circularSpeed(mu, r) {
  requirePositive('mu', mu);
  requirePositive('r', r);
  return Math.sqrt(mu / r);
}

/**
 * Vis-viva equation, v = √(μ (2/r − 1/a)): speed anywhere on a conic orbit.
 * @param {number} mu Gravitational parameter [m³/s²].
 * @param {number} r  Current distance from the central body [m].
 * @param {number} a  Semi-major axis [m] (use Infinity for a parabola).
 * @returns {number} Speed [m/s].
 */
export function visVivaSpeed(mu, r, a) {
  requirePositive('mu', mu);
  requirePositive('r', r);
  if (!(a > 0)) throw new RangeError(`a must be positive for an elliptic or parabolic orbit (got ${a})`);
  const v2 = mu * (2 / r - 1 / a);
  if (v2 < 0) throw new RangeError(`r = ${r} m is beyond the apoapsis of an orbit with a = ${a} m`);
  return Math.sqrt(v2);
}

/**
 * Period of an elliptical orbit (Kepler's third law), T = 2π √(a³ / μ).
 * @param {number} mu Gravitational parameter [m³/s²].
 * @param {number} a  Semi-major axis [m].
 * @returns {number} Period [s].
 */
export function orbitalPeriod(mu, a) {
  requirePositive('mu', mu);
  requirePositive('a', a);
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu);
}

/**
 * Synodic period, the time between repeats of the same relative geometry of two
 * bodies orbiting the same star: 1/S = |1/T1 − 1/T2|. For Earth and Mars this is
 * the spacing between launch windows (≈780 days, about 26 months).
 * @param {number} period1 Orbital period of the first body [s].
 * @param {number} period2 Orbital period of the second body [s].
 * @returns {number} Synodic period [s].
 */
export function synodicPeriod(period1, period2) {
  requirePositive('period1', period1);
  requirePositive('period2', period2);
  if (period1 === period2) throw new RangeError('Equal periods never change relative geometry (infinite synodic period)');
  return 1 / Math.abs(1 / period1 - 1 / period2);
}

/* ── Hohmann (minimum-energy) transfer between circular coplanar orbits ── */

/**
 * @typedef {object} HohmannTransfer
 * @property {number} semiMajorAxis  Transfer ellipse semi-major axis [m].
 * @property {number} timeOfFlight   Half the transfer-orbit period [s].
 * @property {number} departureSpeed Heliocentric speed just after departure [m/s].
 * @property {number} arrivalSpeed   Heliocentric speed on arrival [m/s].
 * @property {number} vInfDeparture  Hyperbolic excess speed leaving the first body [m/s].
 * @property {number} vInfArrival    Hyperbolic excess speed arriving at the second body [m/s].
 * @property {number} transferAngle  Heliocentric angle swept (always π) [rad].
 * @property {number} phaseAngle     How far the target must lead the origin at departure [rad].
 */

/**
 * Hohmann transfer between two circular, coplanar orbits around the same body.
 * This is the classic minimum-Δv two-impulse transfer: half an ellipse that is
 * tangent to both orbits.
 *
 * @param {number} r1 Radius of the departure orbit [m].
 * @param {number} r2 Radius of the arrival orbit [m].
 * @param {number} [mu=MU_SUN] Gravitational parameter of the central body [m³/s²].
 * @returns {HohmannTransfer}
 */
export function hohmannTransfer(r1, r2, mu = MU_SUN) {
  requirePositive('r1', r1);
  requirePositive('r2', r2);
  requirePositive('mu', mu);
  if (r1 === r2) throw new RangeError('r1 and r2 must differ for a transfer');
  const a = (r1 + r2) / 2;
  const timeOfFlight = Math.PI * Math.sqrt((a * a * a) / mu);
  const departureSpeed = visVivaSpeed(mu, r1, a);
  const arrivalSpeed = visVivaSpeed(mu, r2, a);
  const targetMeanMotion = Math.sqrt(mu / (r2 * r2 * r2));
  return {
    semiMajorAxis: a,
    timeOfFlight,
    departureSpeed,
    arrivalSpeed,
    vInfDeparture: Math.abs(departureSpeed - circularSpeed(mu, r1)),
    vInfArrival: Math.abs(circularSpeed(mu, r2) - arrivalSpeed),
    transferAngle: Math.PI,
    phaseAngle: Math.PI - targetMeanMotion * timeOfFlight,
  };
}

/* ── Planet-centred (patched-conic) burns ───────────────────────────────── */

/**
 * Δv to leave a circular parking orbit on a hyperbola with excess speed v∞.
 * The burn is done at periapsis, where the Oberth effect makes it most efficient:
 * Δv = √(v∞² + 2μ/r) − √(μ/r).
 * @param {number} vInf  Required hyperbolic excess speed [m/s].
 * @param {number} mu    Planet gravitational parameter [m³/s²].
 * @param {number} rPark Parking-orbit radius, measured from the planet centre [m].
 * @returns {number} Δv [m/s].
 */
export function departureBurnDeltaV(vInf, mu, rPark) {
  requireNonNegative('vInf', vInf);
  requirePositive('mu', mu);
  requirePositive('rPark', rPark);
  return Math.sqrt(vInf * vInf + (2 * mu) / rPark) - Math.sqrt(mu / rPark);
}

/**
 * Δv to capture from an arrival hyperbola into a closed orbit, with the burn at
 * periapsis. A loose ellipse (large apoapsis) is much cheaper than a circular
 * orbit, which is why crewed Mars plans capture into ellipses.
 * @param {number} vInf        Arrival hyperbolic excess speed [m/s].
 * @param {number} mu          Planet gravitational parameter [m³/s²].
 * @param {number} rPeriapsis  Capture-orbit periapsis radius from planet centre [m].
 * @param {number} [rApoapsis=rPeriapsis] Capture-orbit apoapsis radius [m] (defaults to circular).
 * @returns {number} Δv [m/s].
 */
export function captureBurnDeltaV(vInf, mu, rPeriapsis, rApoapsis = rPeriapsis) {
  requireNonNegative('vInf', vInf);
  requirePositive('mu', mu);
  requirePositive('rPeriapsis', rPeriapsis);
  requirePositive('rApoapsis', rApoapsis);
  if (rApoapsis < rPeriapsis) throw new RangeError('rApoapsis must be ≥ rPeriapsis');
  const vHyperbolic = Math.sqrt(vInf * vInf + (2 * mu) / rPeriapsis);
  const vCaptured = visVivaSpeed(mu, rPeriapsis, (rPeriapsis + rApoapsis) / 2);
  return vHyperbolic - vCaptured;
}

/**
 * Speed at atmospheric entry interface for a ship arriving with excess speed v∞
 * (energy conservation on the arrival hyperbola).
 * @param {number} vInf   Arrival hyperbolic excess speed [m/s].
 * @param {number} mu     Planet gravitational parameter [m³/s²].
 * @param {number} rEntry Entry-interface radius from planet centre [m].
 * @returns {number} Entry speed [m/s].
 */
export function entrySpeed(vInf, mu, rEntry) {
  requireNonNegative('vInf', vInf);
  requirePositive('mu', mu);
  requirePositive('rEntry', rEntry);
  return Math.sqrt(vInf * vInf + (2 * mu) / rEntry);
}

/**
 * Inverse of {@link entrySpeed}: the largest arrival v∞ that keeps the entry
 * speed at or below a heat-shield limit.
 * @param {number} maxEntrySpeed Entry-speed limit [m/s].
 * @param {number} mu            Planet gravitational parameter [m³/s²].
 * @param {number} rEntry        Entry-interface radius [m].
 * @returns {number} Maximum v∞ [m/s] (0 if the limit is below escape speed).
 */
export function maxVInfForEntrySpeed(maxEntrySpeed, mu, rEntry) {
  requirePositive('maxEntrySpeed', maxEntrySpeed);
  requirePositive('mu', mu);
  requirePositive('rEntry', rEntry);
  return Math.sqrt(Math.max(0, maxEntrySpeed * maxEntrySpeed - (2 * mu) / rEntry));
}

/* ── Faster-than-Hohmann transfers ──────────────────────────────────────── */

/**
 * @typedef {object} PlanarVelocity
 * @property {number} radial     Component away from the Sun [m/s].
 * @property {number} tangential Component along the direction of orbital motion [m/s].
 */

/**
 * @typedef {object} TangentialTransfer
 * @property {number} semiMajorAxis Transfer-orbit semi-major axis [m].
 * @property {number} eccentricity  Transfer-orbit eccentricity [-].
 * @property {number} aphelion      Transfer-orbit apoapsis radius [m].
 * @property {number} timeOfFlight  Time from departure (periapsis) to reaching r2 [s].
 * @property {number} transferAngle Heliocentric angle swept, 0 < θ ≤ π [rad].
 * @property {number} vInfDeparture Excess speed relative to the departure planet [m/s].
 * @property {number} vInfArrival   Excess speed relative to the arrival planet [m/s].
 * @property {number} semiLatusRectum Transfer-orbit p = a(1 − e²) [m].
 * @property {PlanarVelocity} arrivalVelocity Ship heliocentric velocity at r2.
 */

/**
 * Transfer that leaves r1 tangentially (r1 is the transfer orbit's periapsis)
 * and crosses r2 on the way out to a chosen apoapsis rApoapsis ≥ r2.
 *
 * - rApoapsis = r2 reproduces the Hohmann transfer (tangent at both ends).
 *   With circular planetary orbits that is the minimum-energy transfer. On
 *   Mars' real eccentric orbit, a slightly faster transfer that meets Mars
 *   nearer perihelion can sometimes cost less.
 * - A larger rApoapsis gives a faster, higher-energy transfer. The ship
 *   reaches r2 before apoapsis, at an angle to the planet's orbit. That raises
 *   v∞ at both ends: you spend Δv to buy transit time.
 *
 * Planet velocities default to circular orbits but can be passed in, so the
 * same function works with eccentric planetary orbits (see ephemeris.js).
 *
 * @param {object} p
 * @param {number} p.r1        Departure radius = transfer periapsis [m].
 * @param {number} p.r2        Arrival radius, r1 < r2 ≤ rApoapsis [m].
 * @param {number} p.rApoapsis Transfer apoapsis [m].
 * @param {number} [p.mu=MU_SUN] Central-body gravitational parameter [m³/s²].
 * @param {PlanarVelocity} [p.departurePlanetVelocity] Departure planet velocity (default circular).
 * @param {PlanarVelocity} [p.arrivalPlanetVelocity]   Arrival planet velocity (default circular).
 * @returns {TangentialTransfer}
 */
export function tangentialTransfer({ r1, r2, rApoapsis, mu = MU_SUN, departurePlanetVelocity, arrivalPlanetVelocity }) {
  requirePositive('r1', r1);
  requirePositive('r2', r2);
  requirePositive('rApoapsis', rApoapsis);
  requirePositive('mu', mu);
  if (!(r2 > r1)) throw new RangeError('This transfer family only goes outward (needs r2 > r1)');
  // Allow a hair of round-off when rApoapsis is meant to equal r2.
  if (rApoapsis < r2 * (1 - 1e-12)) throw new RangeError('rApoapsis must be ≥ r2 or the ship never reaches r2');
  const rA = Math.max(rApoapsis, r2);

  const a = (r1 + rA) / 2;
  const e = (rA - r1) / (rA + r1);
  const p = (2 * r1 * rA) / (r1 + rA); // semi-latus rectum a(1 − e²)

  // True anomaly where the transfer orbit crosses r2 (on the outbound leg).
  const cosNu = Math.min(1, Math.max(-1, (p / r2 - 1) / e));
  // Exactly π for the Hohmann case (acos loses precision right next to −1).
  const nu = rA === r2 ? Math.PI : Math.acos(cosNu);

  // Kepler's equation: time from periapsis to true anomaly ν.
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const M = E - e * Math.sin(E);
  const timeOfFlight = M / Math.sqrt(mu / (a * a * a));

  // Ship velocity at departure (pure tangential) and at r2.
  const vPeri = visVivaSpeed(mu, r1, a);
  const h = Math.sqrt(mu * p); // specific angular momentum
  const vT = h / r2;
  const vR = Math.sqrt(mu / p) * e * Math.sin(nu);

  const dep = departurePlanetVelocity ?? { radial: 0, tangential: circularSpeed(mu, r1) };
  const arr = arrivalPlanetVelocity ?? { radial: 0, tangential: circularSpeed(mu, r2) };

  return {
    semiMajorAxis: a,
    eccentricity: e,
    aphelion: rA,
    timeOfFlight,
    transferAngle: nu,
    vInfDeparture: Math.hypot(vPeri - dep.tangential, 0 - dep.radial),
    vInfArrival: Math.hypot(vT - arr.tangential, vR - arr.radial),
    semiLatusRectum: p,
    arrivalVelocity: { radial: vR, tangential: vT },
  };
}

/**
 * Distance flown along a transfer arc: the length of the conic
 * r(ν) = p / (1 + e cos ν) from periapsis (ν = 0) to the transfer angle,
 * integrated with Simpson's rule.
 * @param {Pick<TangentialTransfer, 'semiLatusRectum'|'eccentricity'|'transferAngle'>} transfer
 * @returns {number} Arc length [m].
 */
export function transferArcLength({ semiLatusRectum, eccentricity, transferAngle }) {
  requirePositive('semiLatusRectum', semiLatusRectum);
  requireNonNegative('eccentricity', eccentricity);
  requirePositive('transferAngle', transferAngle);
  return conicArcLength(semiLatusRectum, eccentricity, transferAngle);
}

function conicArcLength(p, e, nuEnd, steps = 200) {
  const ds = (nu) => {
    const denom = 1 + e * Math.cos(nu);
    const r = p / denom;
    const drdnu = (p * e * Math.sin(nu)) / (denom * denom);
    return Math.sqrt(r * r + drdnu * drdnu);
  };
  const h = nuEnd / steps;
  let sum = ds(0) + ds(nuEnd);
  for (let i = 1; i < steps; i++) sum += ds(i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

/**
 * Time of flight on a parabola with periapsis r1 out to r2 (Barker's equation).
 * This is the lower limit on transit time for the elliptic tangential family:
 * any faster trip would have to be hyperbolic relative to the Sun.
 * @param {number} r1 Periapsis radius [m].
 * @param {number} r2 Arrival radius, > r1 [m].
 * @param {number} [mu=MU_SUN] Gravitational parameter [m³/s²].
 * @returns {number} Time of flight [s].
 */
export function parabolicTimeOfFlight(r1, r2, mu = MU_SUN) {
  requirePositive('r1', r1);
  requirePositive('r2', r2);
  requirePositive('mu', mu);
  if (!(r2 > r1)) throw new RangeError('needs r2 > r1');
  const cosNu = (2 * r1) / r2 - 1;
  const D = Math.sqrt((1 - cosNu) / (1 + cosNu)); // tan(ν/2)
  return Math.sqrt((2 * r1 * r1 * r1) / mu) * (D + (D * D * D) / 3);
}

/**
 * Finds the tangential-departure transfer with a requested time of flight,
 * by bisection on the apoapsis radius (time of flight falls steadily as
 * apoapsis grows). This is how the model "buys" a shorter transit with Δv.
 *
 * NOTE: this one-parameter family is not Δv-optimal for a given time of flight.
 * A full Lambert/porkchop optimisation spreads the extra energy between
 * departure and arrival and does somewhat better, so treat fast-transfer Δv
 * here as a conservative (high) estimate.
 *
 * @param {object} p
 * @param {number} p.r1           Departure radius [m].
 * @param {number} p.r2           Arrival radius [m].
 * @param {number} p.timeOfFlight Requested transit time [s]. It must be between the
 *   near-parabolic limit and the Hohmann time for these radii.
 * @param {number} [p.mu=MU_SUN]  Gravitational parameter [m³/s²].
 * @param {PlanarVelocity} [p.departurePlanetVelocity]
 * @param {PlanarVelocity} [p.arrivalPlanetVelocity]
 * @returns {TangentialTransfer}
 * @throws {RangeError} If the requested time is outside what this transfer family can fly.
 */
export function transferForTimeOfFlight({ r1, r2, timeOfFlight, mu = MU_SUN, departurePlanetVelocity, arrivalPlanetVelocity }) {
  requirePositive('timeOfFlight', timeOfFlight);
  const base = { r1, r2, mu, departurePlanetVelocity, arrivalPlanetVelocity };
  const slowest = tangentialTransfer({ ...base, rApoapsis: r2 });
  if (timeOfFlight > slowest.timeOfFlight * (1 + 1e-9)) {
    throw new RangeError(
      `Requested ${(timeOfFlight / 86400).toFixed(1)} d is slower than the minimum-energy ` +
      `transfer (${(slowest.timeOfFlight / 86400).toFixed(1)} d)`,
    );
  }
  if (timeOfFlight >= slowest.timeOfFlight) return slowest;

  // Upper bracket: an apoapsis so large the orbit is almost parabolic.
  let lo = Math.log(r2);
  let hi = Math.log(r2 * 1e6);
  const fastest = tangentialTransfer({ ...base, rApoapsis: Math.exp(hi) });
  if (timeOfFlight < fastest.timeOfFlight) {
    throw new RangeError(
      `Requested ${(timeOfFlight / 86400).toFixed(1)} d is faster than any elliptic transfer ` +
      `(limit ≈ ${(fastest.timeOfFlight / 86400).toFixed(1)} d)`,
    );
  }
  let result = slowest;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    result = tangentialTransfer({ ...base, rApoapsis: Math.exp(mid) });
    if (Math.abs(result.timeOfFlight - timeOfFlight) < 1e-3) break; // 1 ms
    if (result.timeOfFlight > timeOfFlight) lo = mid; else hi = mid;
  }
  return result;
}
