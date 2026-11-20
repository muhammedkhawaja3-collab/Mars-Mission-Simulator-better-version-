/**
 * Rocket equation and launch-count logic.
 *
 * Tsiolkovsky (1903): Δv = vₑ ln(m₀ / m_f), with vₑ = Isp · g0.
 * The exponential is why high-Isp engines matter so much. Propellant needed
 * grows as e^(Δv/vₑ), so halving vₑ more than doubles the propellant for
 * large Δv.
 *
 * SI units: kg, m/s, s.
 */
import { G0 } from './constants.js';

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

/**
 * Effective exhaust velocity from specific impulse, vₑ = Isp · g0.
 * @param {number} isp Specific impulse [s].
 * @returns {number} Exhaust velocity [m/s].
 */
export function exhaustVelocity(isp) {
  requirePositive('isp', isp);
  return isp * G0;
}

/**
 * Tsiolkovsky rocket equation: Δv = Isp · g0 · ln(m₀ / m_f).
 * @param {number} isp          Specific impulse [s].
 * @param {number} initialMass  Mass before the burn, m₀ [kg].
 * @param {number} finalMass    Mass after the burn, m_f [kg], with 0 < m_f ≤ m₀.
 * @returns {number} Δv [m/s].
 */
export function rocketEquationDeltaV(isp, initialMass, finalMass) {
  requirePositive('initialMass', initialMass);
  requirePositive('finalMass', finalMass);
  if (finalMass > initialMass) throw new RangeError('finalMass cannot exceed initialMass');
  return exhaustVelocity(isp) * Math.log(initialMass / finalMass);
}

/**
 * Mass ratio m₀/m_f needed for a given Δv: e^(Δv / vₑ).
 * @param {number} deltaV Δv [m/s].
 * @param {number} isp    Specific impulse [s].
 * @returns {number} Mass ratio [-], ≥ 1.
 */
export function massRatioForDeltaV(deltaV, isp) {
  requireNonNegative('deltaV', deltaV);
  return Math.exp(deltaV / exhaustVelocity(isp));
}

/**
 * Propellant needed to give a vehicle of known burnout ("dry") mass a Δv:
 * m_p = m_dry · (e^(Δv/vₑ) − 1).
 * @param {number} deltaV  Δv [m/s].
 * @param {number} dryMass Mass remaining after the burn: structure + payload [kg].
 * @param {number} isp     Specific impulse [s].
 * @returns {number} Propellant mass [kg].
 */
export function propellantForDeltaV(deltaV, dryMass, isp) {
  requirePositive('dryMass', dryMass);
  return dryMass * (massRatioForDeltaV(deltaV, isp) - 1);
}

/**
 * Largest Δv a vehicle can achieve with a given propellant load.
 * @param {number} isp            Specific impulse [s].
 * @param {number} dryMass        Burnout mass [kg].
 * @param {number} propellantMass Propellant loaded [kg].
 * @returns {number} Δv [m/s].
 */
export function maxDeltaV(isp, dryMass, propellantMass) {
  requirePositive('dryMass', dryMass);
  requireNonNegative('propellantMass', propellantMass);
  return rocketEquationDeltaV(isp, dryMass + propellantMass, dryMass);
}

/**
 * Number of launches needed to lift a mass when each launch carries at most
 * `capacityPerLaunch`. A tiny tolerance stops round-off from adding a
 * spurious extra launch (e.g. 300.0000001 t on 100 t launchers is 3 launches).
 * @param {number} mass              Total mass to deliver [kg].
 * @param {number} capacityPerLaunch Mass delivered per launch [kg].
 * @returns {number} Integer launch count (0 if mass is 0).
 */
export function launchesRequired(mass, capacityPerLaunch) {
  requireNonNegative('mass', mass);
  requirePositive('capacityPerLaunch', capacityPerLaunch);
  return Math.max(0, Math.ceil(mass / capacityPerLaunch - 1e-9)); // max() also turns −0 into 0
}
