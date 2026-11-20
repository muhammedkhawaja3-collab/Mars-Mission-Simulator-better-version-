import { describe, it, expect } from 'vitest';
import { lifeSupportMass, dailyConsumables, BVAD_RATES, DEFAULT_CLOSURE, CONTINGENCY_DAYS } from '../lifeSupport.js';
import { simulateMission, crewPayloadMass } from '../mission.js';
import { DAY } from '../constants.js';

const base = { outboundTime: 200 * DAY, surfaceTime: 450 * DAY, returnTime: 200 * DAY };

describe('BVAD rates', () => {
  it('uses the NASA BVAD Rev2 table values', () => {
    expect(BVAD_RATES.oxygen).toBe(0.895); // Table 3-31
    expect(BVAD_RATES.waterTransit).toBe(3.2); // Table 4-20 transit vehicle
    expect(BVAD_RATES.waterSurface).toBe(4.48); // Table 4-20 early planetary base
    expect(BVAD_RATES.food).toBe(2.39); // ISS packaged food planning value
  });

  it('closed-loop daily mass = food + water·(1−cw) + O₂·(1−co)', () => {
    const d = dailyConsumables('transit', { water: 0.9, oxygen: 0.5 });
    expect(d.openLoop).toBeCloseTo(2.39 + 3.2 + 0.895, 12);
    expect(d.closedLoop).toBeCloseTo(2.39 + 3.2 * 0.1 + 0.895 * 0.5, 12);
  });
});

describe('lifeSupportMass', () => {
  it('is linear in crew size', () => {
    const m2 = lifeSupportMass({ crewSize: 2, ...base });
    const m4 = lifeSupportMass({ crewSize: 4, ...base });
    const m8 = lifeSupportMass({ crewSize: 8, ...base });
    expect(m4.total.openLoop).toBeCloseTo(2 * m2.total.openLoop, 9);
    expect(m8.total.closedLoop).toBeCloseTo(4 * m2.total.closedLoop, 9);
  });

  it('closure 0 gives the open-loop mass; recycling makes closed-loop lighter', () => {
    const open = lifeSupportMass({ crewSize: 4, ...base, closure: { water: 0, oxygen: 0 } });
    expect(open.total.closedLoop).toBeCloseTo(open.total.openLoop, 9);
    const closed = lifeSupportMass({ crewSize: 4, ...base });
    expect(closed.total.closedLoop).toBeLessThan(closed.total.openLoop);
    expect(closed.closure).toEqual({ water: DEFAULT_CLOSURE.water, oxygen: DEFAULT_CLOSURE.oxygen });
  });

  it('phases add up, the outbound phase carries the contingency, and the surface uses base water rates', () => {
    const m = lifeSupportMass({ crewSize: 4, ...base });
    expect(m.outbound.days).toBe(200 + CONTINGENCY_DAYS);
    expect(m.total.food).toBeCloseTo(m.outbound.food + m.surface.food + m.return.food, 9);
    expect(m.surface.water).toBeCloseTo(4 * 450 * 4.48, 9);
    expect(m.return.water).toBeCloseTo(4 * 200 * 3.2, 9);
  });

  it('rejects crew outside 2–8 and bad closures', () => {
    expect(() => lifeSupportMass({ crewSize: 1, ...base })).toThrow(RangeError);
    expect(() => lifeSupportMass({ crewSize: 9, ...base })).toThrow(RangeError);
    expect(() => lifeSupportMass({ crewSize: 4, ...base, closure: { water: 1, oxygen: 0.5 } })).toThrow(RangeError);
    expect(() => lifeSupportMass({ crewSize: 4, outboundTime: -1 })).toThrow(RangeError);
    expect(() => dailyConsumables('orbit')).toThrow(TypeError);
  });
});

describe('integration with the mission model', () => {
  it('outbound crew consumables equal the closed-loop outbound life-support mass', () => {
    const m = simulateMission({ vehicle: 'nuclear', windowId: '2028-12', transferChoice: { kind: 'hohmann' } });
    expect(m.mass.consumables).toBeCloseTo(m.lifeSupport.outbound.closedLoop, 6);
    expect(m.lifeSupport.surface.days).toBeCloseTo(m.duration.surfaceStay / DAY, 9);
    expect(crewPayloadMass({ crewSize: 4, transitTime: m.transitTime }).consumables).toBeCloseTo(m.mass.consumables, 6);
  });
});
