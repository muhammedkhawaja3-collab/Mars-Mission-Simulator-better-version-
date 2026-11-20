import { describe, it, expect } from 'vitest';
import {
  circularSpeed, visVivaSpeed, orbitalPeriod, synodicPeriod, hohmannTransfer,
  departureBurnDeltaV, captureBurnDeltaV, entrySpeed, maxVInfForEntrySpeed,
  tangentialTransfer, transferForTimeOfFlight, parabolicTimeOfFlight, transferArcLength,
} from '../orbits.js';
import {
  MU_SUN, MU_EARTH, MU_MARS, R_EARTH, R_MARS, R_EARTH_ORBIT, R_MARS_ORBIT, DAY,
  LEO_ALTITUDE, MARS_CAPTURE_PERIAPSIS_ALTITUDE, MARS_CAPTURE_APOAPSIS_ALTITUDE,
  EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD,
} from '../constants.js';

const km = (m) => m / 1000;
const days = (s) => s / DAY;
const deg = (rad) => (rad * 180) / Math.PI;

describe('basic two-body relations', () => {
  it('Earth heliocentric circular speed ≈ 29.78 km/s', () => {
    expect(km(circularSpeed(MU_SUN, R_EARTH_ORBIT))).toBeCloseTo(29.78, 2);
  });

  it('circular speed in 400 km LEO ≈ 7.67 km/s', () => {
    expect(km(circularSpeed(MU_EARTH, R_EARTH + LEO_ALTITUDE))).toBeCloseTo(7.67, 2);
  });

  it('vis-viva reduces to circular speed when r = a, and to escape speed when a = ∞', () => {
    const r = R_EARTH + LEO_ALTITUDE;
    expect(visVivaSpeed(MU_EARTH, r, r)).toBeCloseTo(circularSpeed(MU_EARTH, r), 6);
    expect(visVivaSpeed(MU_EARTH, r, Infinity)).toBeCloseTo(Math.SQRT2 * circularSpeed(MU_EARTH, r), 6);
  });

  it("Kepler's third law gives Earth's year (≈ 365.25 d) from its orbital radius", () => {
    expect(days(orbitalPeriod(MU_SUN, R_EARTH_ORBIT))).toBeCloseTo(365.25, 0);
  });

  it('Earth–Mars synodic period ≈ 780 days (26 months between launch windows)', () => {
    expect(days(synodicPeriod(EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD))).toBeCloseTo(779.9, 0);
  });
});

describe('Hohmann transfer Earth → Mars (circular, coplanar)', () => {
  const h = hohmannTransfer(R_EARTH_ORBIT, R_MARS_ORBIT);

  it('takes ≈ 259 days', () => {
    expect(days(h.timeOfFlight)).toBeGreaterThan(258);
    expect(days(h.timeOfFlight)).toBeLessThan(260);
  });

  it('departure v∞ ≈ 2.94 km/s and arrival v∞ ≈ 2.65 km/s', () => {
    expect(km(h.vInfDeparture)).toBeCloseTo(2.94, 1);
    expect(Math.abs(km(h.vInfDeparture) - 2.945)).toBeLessThan(0.01);
    expect(Math.abs(km(h.vInfArrival) - 2.649)).toBeLessThan(0.01);
  });

  it('needs Mars ≈ 44° ahead of Earth at departure', () => {
    expect(deg(h.phaseAngle)).toBeCloseTo(44.3, 0);
  });

  it('is symmetric: the inward transfer has the same time of flight', () => {
    const back = hohmannTransfer(R_MARS_ORBIT, R_EARTH_ORBIT);
    expect(back.timeOfFlight).toBeCloseTo(h.timeOfFlight, 3);
    expect(back.vInfDeparture).toBeCloseTo(h.vInfArrival, 6);
  });

  it('rejects invalid radii', () => {
    expect(() => hohmannTransfer(-1, R_MARS_ORBIT)).toThrow(RangeError);
    expect(() => hohmannTransfer(R_EARTH_ORBIT, NaN)).toThrow(RangeError);
    expect(() => hohmannTransfer(R_EARTH_ORBIT, R_EARTH_ORBIT)).toThrow(RangeError);
  });
});

describe('patched-conic burns', () => {
  const h = hohmannTransfer(R_EARTH_ORBIT, R_MARS_ORBIT);

  it('trans-Mars injection from 400 km LEO ≈ 3.6 km/s', () => {
    const dv = departureBurnDeltaV(h.vInfDeparture, MU_EARTH, R_EARTH + LEO_ALTITUDE);
    expect(km(dv)).toBeGreaterThan(3.5);
    expect(km(dv)).toBeLessThan(3.65);
  });

  it('capture into the DRA 5.0 1-sol ellipse (≈ 0.9 km/s) is far cheaper than a 400 km circular orbit (≈ 2.1 km/s)', () => {
    const ellipse = captureBurnDeltaV(h.vInfArrival, MU_MARS, R_MARS + MARS_CAPTURE_PERIAPSIS_ALTITUDE, R_MARS + MARS_CAPTURE_APOAPSIS_ALTITUDE);
    const circular = captureBurnDeltaV(h.vInfArrival, MU_MARS, R_MARS + 400e3);
    expect(km(ellipse)).toBeCloseTo(0.9, 1);
    expect(km(circular)).toBeCloseTo(2.08, 1);
    expect(ellipse).toBeLessThan(circular);
  });

  it('a zero-v∞ departure costs exactly escape − circular speed', () => {
    const r = R_EARTH + LEO_ALTITUDE;
    expect(departureBurnDeltaV(0, MU_EARTH, r)).toBeCloseTo((Math.SQRT2 - 1) * circularSpeed(MU_EARTH, r), 6);
  });

  it('entry speed and its inverse agree', () => {
    const rEntry = R_MARS + 125e3;
    const v = entrySpeed(4000, MU_MARS, rEntry);
    expect(maxVInfForEntrySpeed(v, MU_MARS, rEntry)).toBeCloseTo(4000, 6);
    expect(maxVInfForEntrySpeed(100, MU_MARS, rEntry)).toBe(0); // below escape speed
  });

  it('rejects negative v∞ and an apoapsis below periapsis', () => {
    expect(() => departureBurnDeltaV(-1, MU_EARTH, R_EARTH)).toThrow(RangeError);
    expect(() => captureBurnDeltaV(1000, MU_MARS, 4e6, 3e6)).toThrow(RangeError);
  });
});

describe('faster-than-Hohmann (tangential departure) transfers', () => {
  const r1 = R_EARTH_ORBIT;
  const r2 = R_MARS_ORBIT;

  it('reduces to the Hohmann transfer when apoapsis = r2', () => {
    const t = tangentialTransfer({ r1, r2, rApoapsis: r2 });
    const h = hohmannTransfer(r1, r2);
    expect(t.timeOfFlight).toBeCloseTo(h.timeOfFlight, 0);
    expect(t.vInfDeparture).toBeCloseTo(h.vInfDeparture, 3);
    expect(t.vInfArrival).toBeCloseTo(h.vInfArrival, 3);
    expect(t.transferAngle).toBeCloseTo(Math.PI, 9);
  });

  it('hits a requested time of flight', () => {
    const t = transferForTimeOfFlight({ r1, r2, timeOfFlight: 180 * DAY });
    expect(days(t.timeOfFlight)).toBeCloseTo(180, 3);
    expect(t.transferAngle).toBeLessThan(Math.PI);
  });

  it('shorter transits always cost more v∞ at both ends (monotonic)', () => {
    const tofs = [250, 220, 190, 160, 130, 100];
    const transfers = tofs.map((d) => transferForTimeOfFlight({ r1, r2, timeOfFlight: d * DAY }));
    for (let i = 1; i < transfers.length; i++) {
      expect(transfers[i].vInfDeparture).toBeGreaterThan(transfers[i - 1].vInfDeparture);
      expect(transfers[i].vInfArrival).toBeGreaterThan(transfers[i - 1].vInfArrival);
    }
  });

  it('cannot beat the parabolic limit (≈ 70 d) or be slower than Hohmann', () => {
    const limit = days(parabolicTimeOfFlight(r1, r2));
    expect(limit).toBeGreaterThan(65);
    expect(limit).toBeLessThan(75);
    expect(() => transferForTimeOfFlight({ r1, r2, timeOfFlight: (limit - 1) * DAY })).toThrow(RangeError);
    expect(() => transferForTimeOfFlight({ r1, r2, timeOfFlight: 300 * DAY })).toThrow(RangeError);
    expect(() => transferForTimeOfFlight({ r1, r2, timeOfFlight: -5 })).toThrow(RangeError);
  });

  it('rejects inward transfers and apoapsis below r2', () => {
    expect(() => tangentialTransfer({ r1: r2, r2: r1, rApoapsis: r2 })).toThrow(RangeError);
    expect(() => tangentialTransfer({ r1, r2, rApoapsis: r1 })).toThrow(RangeError);
  });

  it('arc length: a half circle is π r, and the Hohmann arc lies between the two half-orbits', () => {
    expect(transferArcLength({ semiLatusRectum: r1, eccentricity: 0, transferAngle: Math.PI })).toBeCloseTo(Math.PI * r1, -3);
    const h = tangentialTransfer({ r1, r2, rApoapsis: r2 });
    const arc = transferArcLength(h);
    expect(arc).toBeGreaterThan(Math.PI * r1);
    expect(arc).toBeLessThan(Math.PI * r2);
  });
});
