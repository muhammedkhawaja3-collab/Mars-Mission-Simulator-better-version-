import { describe, it, expect } from 'vitest';
import {
  solveKepler, earthState, marsState, launchWindows, solveTransferWindow,
  conjunctionStayTime, wrapToPi, EARTH_MARS_SYNODIC_PERIOD,
} from '../ephemeris.js';
import { AU, DAY, EARTH_ORBITAL_PERIOD, R_EARTH_ORBIT, R_MARS_ORBIT } from '../constants.js';
import { hohmannTransfer } from '../orbits.js';

const days = (s) => s / DAY;
const iso = (d) => d.toISOString().slice(0, 10);

describe("Kepler's equation", () => {
  it('solves M = E − e sin E across eccentricities', () => {
    for (const e of [0, 0.0167, 0.0934, 0.5, 0.9]) {
      for (const M of [-3, -1, 0, 0.5, 2, 3.1]) {
        const E = solveKepler(M, e);
        expect(wrapToPi(E - e * Math.sin(E) - M)).toBeCloseTo(0, 10);
      }
    }
  });

  it('rejects non-elliptic eccentricities', () => {
    expect(() => solveKepler(1, 1)).toThrow(RangeError);
    expect(() => solveKepler(1, -0.1)).toThrow(RangeError);
  });
});

describe('planet positions', () => {
  it('Earth stays within its perihelion/aphelion range and is closest to the Sun in early January', () => {
    const jan = earthState(new Date(Date.UTC(2027, 0, 3)));
    const jul = earthState(new Date(Date.UTC(2027, 6, 4)));
    expect(jan.r / AU).toBeCloseTo(0.983, 2);
    expect(jul.r / AU).toBeCloseTo(1.017, 2);
  });

  it('Mars ranges between ≈ 1.381 AU (perihelion) and ≈ 1.666 AU (aphelion)', () => {
    let min = Infinity;
    let max = 0;
    for (let d = 0; d < 700; d += 2) {
      const r = marsState(new Date(Date.UTC(2030, 0, 1) + d * DAY * 1000)).r / AU;
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeCloseTo(1.381, 2);
    expect(max).toBeCloseTo(1.666, 2);
  });

  it('rejects invalid dates', () => {
    expect(() => marsState(new Date('not a date'))).toThrow(TypeError);
    expect(() => earthState('2030-01-01')).toThrow(TypeError);
  });
});

describe('launch windows', () => {
  const windows = launchWindows({ after: new Date(Date.UTC(2026, 0, 1)), count: 5 });

  it('match published Earth→Mars windows (Nov 2026, Dec 2028, early 2031, Apr 2033, mid 2035)', () => {
    const ranges = [
      ['2026-10-01', '2026-12-31'],
      ['2028-11-15', '2029-01-31'],
      ['2030-12-15', '2031-03-15'],
      ['2033-03-01', '2033-05-31'],
      ['2035-05-15', '2035-08-15'],
    ];
    windows.forEach((w, i) => {
      expect(iso(w.departureDate) >= ranges[i][0]).toBe(true);
      expect(iso(w.departureDate) <= ranges[i][1]).toBe(true);
    });
  });

  it('are spaced by roughly one synodic period', () => {
    for (let i = 1; i < windows.length; i++) {
      const gap = (windows[i].departureDate - windows[i - 1].departureDate) / 1000;
      expect(Math.abs(days(gap) - days(EARTH_MARS_SYNODIC_PERIOD))).toBeLessThan(80);
    }
  });

  it("have minimum-energy transits near the circular 259 d, varying with Mars' distance", () => {
    for (const w of windows) {
      expect(days(w.timeOfFlight)).toBeGreaterThan(220);
      expect(days(w.timeOfFlight)).toBeLessThan(300);
    }
  });

  it('never return a window before the requested date', () => {
    const after = new Date(Date.UTC(2026, 10, 20));
    const [next] = launchWindows({ after, count: 1 });
    expect(next.departureDate >= after).toBe(true);
  });

  it('satisfy the phasing condition: Mars is at the arrival point at arrival', () => {
    const w = solveTransferWindow({ transfer: { kind: 'timeOfFlight', timeOfFlight: 200 * DAY }, nearDate: windows[1].departureDate });
    const lead = marsState(w.arrivalDate).longitude - earthState(w.departureDate).longitude;
    expect(wrapToPi(lead - w.transferAngle)).toBeCloseTo(0, 6);
    expect(days(w.timeOfFlight)).toBeCloseTo(200, 2);
  });

  it('reject bad arguments', () => {
    expect(() => launchWindows({ after: new Date(), count: 0 })).toThrow(RangeError);
    expect(() => solveTransferWindow({ transfer: { kind: 'warp' }, nearDate: new Date() })).toThrow(TypeError);
  });
});

describe('conjunction-class surface stay', () => {
  it('a Hohmann round trip has the classic ≈ 454-day stay', () => {
    const h = hohmannTransfer(R_EARTH_ORBIT, R_MARS_ORBIT);
    const stay = conjunctionStayTime({ transferAngle: Math.PI, timeOfFlight: h.timeOfFlight });
    expect(days(stay)).toBeGreaterThan(450);
    expect(days(stay)).toBeLessThan(458);
  });

  it('respects the minimum stay and satisfies the return phasing condition', () => {
    const transferAngle = (138 * Math.PI) / 180;
    const timeOfFlight = 180 * DAY;
    const minimumStay = 30 * DAY;
    const stay = conjunctionStayTime({ transferAngle, timeOfFlight, minimumStay });
    expect(stay).toBeGreaterThanOrEqual(minimumStay);
    const nE = (2 * Math.PI) / EARTH_ORBITAL_PERIOD;
    const nM = (2 * Math.PI) / (686.98 * DAY);
    const atArrival = nE * timeOfFlight - transferAngle;
    const needed = transferAngle - nE * timeOfFlight;
    expect(wrapToPi(atArrival + (nE - nM) * stay - needed)).toBeCloseTo(0, 9);
  });

  it('rejects invalid input', () => {
    expect(() => conjunctionStayTime({ transferAngle: 0, timeOfFlight: DAY })).toThrow(RangeError);
    expect(() => conjunctionStayTime({ transferAngle: 1, timeOfFlight: -1 })).toThrow(RangeError);
  });
});
