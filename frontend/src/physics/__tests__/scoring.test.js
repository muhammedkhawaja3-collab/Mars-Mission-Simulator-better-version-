import { describe, it, expect } from 'vitest';
import { scoreMission, gradeFor, ACHIEVEMENTS } from '../scoring.js';
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
