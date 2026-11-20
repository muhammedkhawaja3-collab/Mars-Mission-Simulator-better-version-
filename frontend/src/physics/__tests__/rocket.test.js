import { describe, it, expect } from 'vitest';
import {
  exhaustVelocity, rocketEquationDeltaV, massRatioForDeltaV, propellantForDeltaV, maxDeltaV, launchesRequired,
} from '../rocket.js';

describe('Tsiolkovsky rocket equation', () => {
  it('exhaust velocity = Isp × g0', () => {
    expect(exhaustVelocity(450)).toBeCloseTo(4412.99, 2);
    expect(exhaustVelocity(900)).toBeCloseTo(2 * exhaustVelocity(450), 9);
  });

  it('a mass ratio of e gives Δv equal to the exhaust velocity', () => {
    expect(rocketEquationDeltaV(380, Math.E * 1000, 1000)).toBeCloseTo(exhaustVelocity(380), 6);
  });

  it('no propellant burned means no Δv, and zero Δv needs no propellant', () => {
    expect(rocketEquationDeltaV(450, 1000, 1000)).toBe(0);
    expect(propellantForDeltaV(0, 50_000, 450)).toBe(0);
    expect(massRatioForDeltaV(0, 450)).toBe(1);
  });

  it('worked example: 3.6 km/s at Isp 450 s on a 100 t vehicle needs ≈ 126 t of propellant', () => {
    expect(propellantForDeltaV(3600, 100_000, 450) / 1000).toBeCloseTo(126.1, 0);
  });

  it('propellant and Δv calculations are inverses', () => {
    const dry = 80_000;
    const prop = propellantForDeltaV(5200, dry, 460);
    expect(rocketEquationDeltaV(460, dry + prop, dry)).toBeCloseTo(5200, 6);
    expect(maxDeltaV(460, dry, prop)).toBeCloseTo(5200, 6);
  });

  it('higher Isp → less propellant for the same Δv (monotonic)', () => {
    const isps = [300, 380, 460, 900];
    const props = isps.map((isp) => propellantForDeltaV(6000, 100_000, isp));
    for (let i = 1; i < props.length; i++) expect(props[i]).toBeLessThan(props[i - 1]);
  });

  it('propellant grows faster than linearly with Δv (the tyranny of the exponential)', () => {
    const p1 = propellantForDeltaV(3000, 100_000, 450);
    const p2 = propellantForDeltaV(6000, 100_000, 450);
    expect(p2).toBeGreaterThan(2 * p1);
  });

  it('rejects invalid inputs', () => {
    expect(() => exhaustVelocity(0)).toThrow(RangeError);
    expect(() => exhaustVelocity(-450)).toThrow(RangeError);
    expect(() => rocketEquationDeltaV(450, 1000, 2000)).toThrow(RangeError);
    expect(() => propellantForDeltaV(-1, 1000, 450)).toThrow(RangeError);
    expect(() => propellantForDeltaV(1000, 0, 450)).toThrow(RangeError);
    expect(() => maxDeltaV(450, 1000, NaN)).toThrow(RangeError);
  });
});

describe('launchesRequired', () => {
  it('rounds up to whole launches', () => {
    expect(launchesRequired(300_000, 100_000)).toBe(3);
    expect(launchesRequired(301_000, 100_000)).toBe(4);
    expect(launchesRequired(1, 100_000)).toBe(1);
    expect(launchesRequired(0, 100_000)).toBe(0);
  });

  it('ignores floating-point round-off just above a whole number', () => {
    expect(launchesRequired(300_000.0000001, 100_000)).toBe(3);
  });

  it('rejects invalid capacity or mass', () => {
    expect(() => launchesRequired(1000, 0)).toThrow(RangeError);
    expect(() => launchesRequired(-1, 1000)).toThrow(RangeError);
  });
});
