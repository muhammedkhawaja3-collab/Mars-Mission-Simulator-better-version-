import { describe, it, expect } from 'vitest';
import { mulberry32, createRng, validateSeed } from '../rng.js';
import { scheduleEvents, summarizeEvents, riskFactor, EVENT_TYPES } from '../events.js';
import { simulateMission } from '../mission.js';
import { DAY } from '../constants.js';

describe('mulberry32', () => {
  it('first five outputs for seed 42 are pinned (bit-exact port reference)', () => {
    const r = mulberry32(42);
    expect([r(), r(), r(), r(), r()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423,
    ]);
  });

  it('same seed → same sequence; different seed → different sequence; outputs in [0, 1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const c = mulberry32(124);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('accepts the full uint32 range and rejects anything else', () => {
    expect(() => mulberry32(0)).not.toThrow();
    expect(() => mulberry32(0xffffffff)).not.toThrow();
    for (const bad of [-1, 2 ** 32, 1.5, NaN, '1']) expect(() => validateSeed(bad)).toThrow(RangeError);
  });

  it('helpers stay in range', () => {
    const r = createRng(9);
    for (let i = 0; i < 200; i++) {
      const k = r.int(1, 14);
      expect(Number.isInteger(k) && k >= 1 && k <= 14).toBe(true);
      const u = r.uniform(2, 3);
      expect(u >= 2 && u < 3).toBe(true);
    }
  });
});

const timeline = {
  outboundTime: 200 * DAY, surfaceTime: 450 * DAY, returnTime: 200 * DAY,
  burns: [{ id: 'tmi', label: 'TMI', deltaV: 3600 }, { id: 'capture', label: 'Capture', deltaV: 900 }],
};

describe('scheduleEvents (gameplay model)', () => {
  it('same seed → identical events', () => {
    const a = scheduleEvents({ seed: 2024, riskTolerance: 7, ...timeline });
    const b = scheduleEvents({ seed: 2024, riskTolerance: 7, ...timeline });
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(0);
  });

  it('events are labelled gameplay, sorted in time, inside their phase, with grounded magnitudes', () => {
    const evs = scheduleEvents({ seed: 5, riskTolerance: 10, ...timeline });
    let prev = -1;
    for (const e of evs) {
      expect(e.model).toBe('gameplay');
      expect(e.day).toBeGreaterThanOrEqual(prev);
      prev = e.day;
      expect(EVENT_TYPES[e.type].phases).toContain(e.phase);
      if (e.type === 'solar-particle-event') {
        expect(e.effects.extraDose).toBeGreaterThanOrEqual(1.2e-3);
        expect(e.effects.extraDose).toBeLessThanOrEqual(19.5e-3);
        expect(e.phase).not.toBe('surface');
      }
      if (e.type === 'engine-fault') expect(e.effects.deltaVPenalty).toBeGreaterThan(0);
    }
  });

  it('higher risk → more events on average over 1,000 seeds', () => {
    const avg = (risk) => {
      let n = 0;
      for (let s = 0; s < 1000; s++) n += scheduleEvents({ seed: s, riskTolerance: risk, ...timeline }).length;
      return n / 1000;
    };
    const low = avg(1);
    const high = avg(10);
    expect(high).toBeGreaterThan(2.5 * low);
  });

  it('risk factor spans 0.5 (risk 1) to 2.0 (risk 10)', () => {
    expect(riskFactor(1)).toBe(0.5);
    expect(riskFactor(10)).toBe(2);
    expect(() => riskFactor(0)).toThrow(RangeError);
  });

  it('summarizeEvents totals effects and aborts only when faults exceed the Δv reserve', () => {
    const events = [
      { type: 'engine-fault', effects: { extraDose: 0, deltaVPenalty: 120, consumablesLossKg: 0, commsOutageDays: 0 } },
      { type: 'solar-particle-event', effects: { extraDose: 0.01, deltaVPenalty: 0, consumablesLossKg: 0, commsOutageDays: 0 } },
    ];
    const ok = summarizeEvents(events, { deltaVReserve: 200 });
    expect(ok.abort).toBe(false);
    expect(ok.extraDose).toBe(0.01);
    expect(ok.byType['engine-fault']).toBe(1);
    expect(summarizeEvents(events, { deltaVReserve: 100 }).abort).toBe(true);
  });
});

describe('events inside simulateMission', () => {
  it('no seed → no events; a seed adds event dose to the total and is reproducible', () => {
    const none = simulateMission({ vehicle: 'chemical', windowId: '2028-12', riskTolerance: 10 });
    expect(none.events).toEqual([]);
    const a = simulateMission({ vehicle: 'chemical', windowId: '2028-12', seed: 77, riskTolerance: 10 });
    const b = simulateMission({ vehicle: 'chemical', windowId: '2028-12', seed: 77, riskTolerance: 10 });
    expect(b.events).toEqual(a.events);
    expect(a.dose.events).toBeCloseTo(a.eventSummary.extraDose, 15);
    expect(a.dose.total).toBeCloseTo(none.dose.total + a.dose.events, 12);
    // Physics (trajectory, propellant) never depends on the seed.
    expect(a.transitTime).toBe(none.transitTime);
    expect(a.mass.propellant).toBe(none.mass.propellant);
  });
});
