import { describe, it, expect } from 'vitest';
import { buildMissionResults } from '../fleet.js';
import { initialState } from '../../state/missionReducer.js';
import {
  maxTransitDays,
  vehicleState,
  propellantRemaining,
  doseSoFar,
  abortDay,
  outboundEventsUntil,
} from '../flight.js';
import { toMilliSieverts } from '../../physics/index.js';

const config = { ...initialState.config };
const { rockets, fleet } = buildMissionResults(config);

describe('mission results adapter', () => {
  it('flies every selected fleet vehicle, with seeded engine events', () => {
    expect(fleet.map((r) => r.key)).toEqual(['chemical', 'nuclear', 'starship']);
    expect(rockets).toHaveLength(3);
    for (const r of rockets.filter((x) => !x.failed)) {
      expect(r.mission.inputs.seed).toBe(config.seed);
      expect(Array.isArray(r.events)).toBe(true);
      expect(r.missionDose).toBeCloseTo(toMilliSieverts(r.mission.dose.total), 0);
      expect(Number.isFinite(r.crewHealth)).toBe(true); // A10: computed, not missing
      expect(Number.isFinite(r.success)).toBe(true);
    }
  });

  it('includes the custom rocket in the comparison (same mission, same engine)', () => {
    const parts = {
      name: 'TEST',
      color: '#00BCD4',
      engine: 'rl10b2',
      tank: 'lrg',
      shield: 'none',
      hab: 'standard',
    };
    const res = buildMissionResults({ ...config, customRocket: parts });
    expect(res.rockets.map((r) => r.key)).toEqual(['chemical', 'nuclear', 'starship', 'player']);
    expect(res.player.label).toBe('TEST');
  });

  it('respects vehicle selection', () => {
    const res = buildMissionResults({ ...config, vehicleIds: ['starship'] });
    expect(res.rockets.map((r) => r.key)).toEqual(['starship']);
    expect(res.fleet).toHaveLength(3);
  });
});

describe('flight replay model', () => {
  const flying = rockets.filter((r) => !r.failed);
  const max = maxTransitDays(rockets);

  it('every vehicle departs on day 0 and the slowest arrives exactly at the end', () => {
    for (const r of flying) {
      expect(vehicleState(r, 0, max)).toMatchObject({ progress: 0, day: 0 });
    }
    const slowest = flying.reduce((a, b) => (b.transit > a.transit ? b : a));
    expect(vehicleState(slowest, 0.999, max).status).toBe('transit');
    expect(vehicleState(slowest, 1, max)).toMatchObject({ status: 'arrived', progress: 1 });
    const fastest = flying.reduce((a, b) => (b.transit < a.transit ? b : a));
    expect(vehicleState(fastest, fastest.transit / max, max).status).toBe('arrived');
  });

  it('infeasible vehicles stay on the pad as no-go', () => {
    const failed = { key: 'x', failed: true, events: [] };
    expect(vehicleState(failed, 0.5, 200)).toEqual({ status: 'no-go', progress: 0, day: 0 });
  });

  it('propellant drops in steps at the burns, never linearly with distance (A15)', () => {
    for (const r of flying) {
      const full = propellantRemaining(r, 0, { started: false });
      const afterTmi = propellantRemaining(r, 1);
      const midCruise = propellantRemaining(r, r.transit / 2);
      const arrived = propellantRemaining(r, r.transit, { arrived: true });
      expect(full).toBeCloseTo(r.mission.mass.propellant, 6);
      expect(afterTmi).toBeLessThan(full);
      expect(midCruise).toBeCloseTo(afterTmi, 6); // flat during the coast
      expect(arrived).toBeLessThanOrEqual(midCruise);
      expect(arrived).toBeGreaterThanOrEqual(0);
      if (r.mission.deltaV.capture === 0) expect(arrived).toBeCloseTo(midCruise, 6); // aerocapture
    }
  });

  it('outbound dose at arrival equals the engine outbound dose plus outbound solar events', () => {
    for (const r of flying) {
      const eventDose = r.events
        .filter((e) => e.phase === 'outbound')
        .reduce((s, e) => s + e.effects.extraDose, 0);
      expect(doseSoFar(r, r.transit)).toBeCloseTo(
        toMilliSieverts(r.mission.dose.outbound + eventDose),
        9,
      );
      expect(doseSoFar(r, 0)).toBeCloseTo(
        toMilliSieverts(outboundEventsUntil(r, 0).reduce((s, e) => s + e.effects.extraDose, 0)),
        9,
      );
    }
  });

  it('finds the abort day when engine faults exceed the reserve', () => {
    const mission = {
      deltaV: { planned: 1100, total: 1000 },
      eventSummary: { abort: true },
      events: [
        { day: 0, effects: { deltaVPenalty: 60 } },
        { day: 150, effects: { deltaVPenalty: 60 } },
      ],
    };
    expect(abortDay(mission)).toBe(150);
    expect(abortDay({ ...mission, eventSummary: { abort: false } })).toBeNull();
    const rocket = { key: 'a', failed: false, transit: 200, events: mission.events, mission };
    expect(vehicleState(rocket, 1, 200)).toMatchObject({ status: 'aborted', day: 150 });
    expect(vehicleState(rocket, 0.5, 200).status).toBe('transit');
  });
});
