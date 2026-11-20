import { describe, it, expect } from 'vitest';
import { scoreMission, gradeFor, ACHIEVEMENTS, RADIATION_SCORE_FULL_SV, RADIATION_SCORE_ZERO_SV, RADIATION_ROOKIE_SV } from '../scoring.js';
import { VEHICLE_IDS } from '../vehicles.js';
import { WINDOW_IDS } from '../windows.js';
import { simulateMission } from '../mission.js';
import { BEST_WINDOW_ID } from '../windows.js';
import { createCustomVehicle } from '../vehicles.js';
import { DAY } from '../constants.js';

describe('scoreMission', () => {
  const m = simulateMission({ vehicle: 'nuclear', windowId: '2028-12', seed: 3 });

  it('is 0–1000 with transparent components that sum to the total', () => {
    const s = m.score;
    expect(s.max).toBe(1000);
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(1000);
    expect(s.components.map((c) => c.id)).toEqual(['success', 'radiation', 'propellant', 'cost', 'transit']);
    expect(s.components.reduce((a, c) => a + c.max, 0)).toBe(1000);
    expect(s.total).toBeCloseTo(s.components.reduce((a, c) => a + c.points, 0), 9);
    for (const c of s.components) {
      expect(c.points).toBeGreaterThanOrEqual(0);
      expect(c.points).toBeLessThanOrEqual(c.max);
      expect(c.explanation.length).toBeGreaterThan(10);
    }
    expect(s.grade).toBe(gradeFor(s.total));
  });

  it('is a pure function of the result', () => {
    expect(scoreMission(m, { bestWindowId: BEST_WINDOW_ID })).toEqual(m.score);
  });

  it('grades by threshold', () => {
    expect(gradeFor(950)).toBe('A+');
    expect(gradeFor(800)).toBe('A');
    expect(gradeFor(700)).toBe('B');
    expect(gradeFor(500)).toBe('C');
    expect(gradeFor(400)).toBe('D');
    expect(gradeFor(10)).toBe('F');
  });

  it('infeasible missions score 0 / F', () => {
    const bad = simulateMission({ vehicle: 'chemical', windowId: '2028-12', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 120 * DAY } });
    expect(bad.feasible).toBe(false);
    expect(bad.score).toEqual({ total: 0, max: 1000, grade: 'F', components: [], achievements: [] });
  });

  it('an event-model abort removes the success points', () => {
    const aborted = { ...m, eventSummary: { ...m.eventSummary, abort: true } };
    expect(scoreMission(aborted).components[0].points).toBe(0);
  });
});

describe('achievements', () => {
  const ids = (m) => m.score.achievements.map((a) => a.id);

  it('every achievement has an id, label and description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[a-z-]+$/);
      expect(a.label.length).toBeGreaterThan(3);
      expect(a.description.length).toBeGreaterThan(10);
    }
  });

  it('Fuel Miser and Perfect Window on a minimum-energy flight in the best window', () => {
    const m = simulateMission({ vehicle: 'chemical', windowId: BEST_WINDOW_ID, transferChoice: { kind: 'hohmann' } });
    expect(ids(m)).toContain('fuel-miser');
    expect(ids(m)).toContain('perfect-window');
  });

  it('Full Crew, Shielded, Risk Taker Survives', () => {
    const shielded = createCustomVehicle({ name: 's', isp: 900, stageDryMass: 60_000, propellantCapacity: 200_000, gcrShieldingFactor: 0.6 });
    const m = simulateMission({ vehicle: shielded, crewSize: 8, windowId: '2031-01', riskTolerance: 9, seed: 11, transferChoice: { kind: 'hohmann' } });
    expect(ids(m)).toContain('full-crew');
    expect(ids(m)).toContain('shielded');
    if (!m.eventSummary.abort) expect(ids(m)).toContain('risk-taker');
  });

  it('Speed Demon needs a sub-180-day transit', () => {
    const fast = simulateMission({ vehicle: 'nuclear', windowId: '2031-01' });
    const slow = simulateMission({ vehicle: 'nuclear', windowId: '2031-01', transferChoice: { kind: 'hohmann' } });
    expect(ids(fast).includes('speed-demon')).toBe(fast.transitTime < 180 * DAY);
    expect(ids(slow)).not.toContain('speed-demon');
  });
});

describe('radiation score is live (every conjunction-class mission exceeds 600 mSv)', () => {
  const rad = (m) => m.score.components.find((c) => c.id === 'radiation');
  const grid = [];
  for (const windowId of WINDOW_IDS) {
    for (const vehicle of VEHICLE_IDS) {
      for (const kind of ['fastest', 'hohmann']) {
        const m = simulateMission({ vehicle, windowId, transferChoice: { kind } });
        if (m.feasible) grid.push(m);
      }
    }
  }

  it('every reference mission exceeds the career limit, and the result says so', () => {
    expect(grid.length).toBeGreaterThan(20);
    for (const m of grid) {
      expect(m.dose.exceedsCareerLimit).toBe(true);
      expect(m.dose.careerLimit).toBe(0.6);
      expect(m.framing.map((f) => f.id)).toContain('career-limit');
    }
  });

  it('awards non-zero, non-identical radiation points across the reference missions', () => {
    const pts = grid.map((m) => rad(m).points);
    expect(Math.max(...pts)).toBeGreaterThan(50);
    expect(Math.min(...pts)).toBeLessThan(Math.max(...pts) - 50);
    expect(pts.every((p) => p > 0)).toBe(true);
  });

  it('is linear between the full-marks and zero doses', () => {
    const m = grid[0];
    const at = (total) => scoreMission({ ...m, dose: { ...m.dose, total } }).components.find((c) => c.id === 'radiation').points;
    expect(at(RADIATION_SCORE_FULL_SV)).toBeCloseTo(200, 9);
    expect(at(0.3)).toBe(200);
    expect(at(RADIATION_SCORE_ZERO_SV)).toBeCloseTo(0, 9);
    expect(at(2)).toBe(0);
    expect(at((RADIATION_SCORE_FULL_SV + RADIATION_SCORE_ZERO_SV) / 2)).toBeCloseTo(100, 9);
    expect(rad(m).value).toBe(m.dose.total);
  });

  it('a heavily shielded custom build can get under the limit, and then no career-limit note appears', () => {
    const v = createCustomVehicle({ name: 'bunker', isp: 900, stageDryMass: 60_000, propellantCapacity: 300_000, gcrShieldingFactor: 0.1 });
    const m = simulateMission({ vehicle: v, windowId: '2035-07' });
    expect(m.feasible).toBe(true);
    expect(m.dose.exceedsCareerLimit).toBe(false);
    expect(m.framing.map((f) => f.id)).not.toContain('career-limit');
  });
});

describe('every achievement is earnable by some input combination', () => {
  const shielded = createCustomVehicle({ name: 's', isp: 900, stageDryMass: 60_000, propellantCapacity: 200_000, gcrShieldingFactor: 0.6 });
  // One witness input per achievement (kept explicit so a rebalance that
  // makes an achievement unreachable fails here).
  const WITNESSES = {
    'fuel-miser': { vehicle: 'chemical', windowId: '2028-12', transferChoice: { kind: 'hohmann' } },
    'perfect-window': { vehicle: 'chemical', windowId: BEST_WINDOW_ID },
    'radiation-rookie': { vehicle: 'nuclear', windowId: '2035-07' },
    shielded: { vehicle: shielded, windowId: '2031-01', transferChoice: { kind: 'hohmann' } },
    'heavy-lifter': { vehicle: createCustomVehicle({ name: 'big', isp: 460, stageDryMass: 60_000, propellantCapacity: 600_000 }), windowId: '2028-12' },
    'speed-demon': { vehicle: 'nuclear', windowId: '2033-03' },
    'full-crew': { vehicle: 'chemical', crewSize: 8, windowId: '2028-12', transferChoice: { kind: 'hohmann' } },
    'risk-taker': null, // found by a seed search below
  };

  it('has a witness for every achievement in the catalogue', () => {
    expect(Object.keys(WITNESSES).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  for (const [id, input] of Object.entries(WITNESSES)) {
    if (input === null) continue;
    it(`${id} is earned by its witness input`, () => {
      const m = simulateMission(input);
      expect(m.feasible).toBe(true);
      expect(m.score.achievements.map((a) => a.id)).toContain(id);
    });
  }

  it('risk-taker is earned by some seed at risk 9', () => {
    let found = null;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const m = simulateMission({ vehicle: 'chemical', windowId: '2028-12', riskTolerance: 9, seed });
      if (m.score.achievements.some((a) => a.id === 'risk-taker')) found = seed;
    }
    expect(found).not.toBeNull();
  });

  it('Radiation Rookie threshold sits inside the reachable dose range', () => {
    expect(RADIATION_ROOKIE_SV).toBeGreaterThan(RADIATION_SCORE_FULL_SV);
    expect(RADIATION_ROOKIE_SV).toBeLessThan(RADIATION_SCORE_ZERO_SV);
  });
});
