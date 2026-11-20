import { describe, it, expect } from 'vitest';
import { successEstimate, LAUNCH_RELIABILITY, REFLIGHT_DELAY_DAYS } from '../success.js';
import { VEHICLES } from '../vehicles.js';
import { LAUNCH_VEHICLES } from '../launchVehicles.js';
import { simulateMission } from '../mission.js';

const SLS = LAUNCH_VEHICLES['sls-block1'];
const SHIP = LAUNCH_VEHICLES.starship;

describe('success heuristic (Decision 2: uncrewed launch failures are recoverable)', () => {
  it('returns explained factors whose product is the probability', () => {
    const s = successEstimate({ vehicle: VEHICLES.nuclear, launchVehicle: SLS, launches: 4, margin: 0.07 });
    const ids = s.factors.map((f) => f.id);
    expect(ids).toEqual(['crewed-launch', 'crew-dockings', 'propulsive-burns', 'aerocapture', 'edl', 'delta-v-margin']);
    for (const f of s.factors) {
      expect(f.probability).toBeGreaterThan(0);
      expect(f.probability).toBeLessThanOrEqual(1);
      expect(f.label.length).toBeGreaterThan(3);
      expect(f.explanation.length).toBeGreaterThan(10);
    }
    expect(s.probability).toBeCloseTo(s.factors.reduce((p, f) => p * f.probability, 1), 15);
  });

  it('a crewed launch failure ends the mission: the crewed launch is always a factor', () => {
    const s = successEstimate({ vehicle: VEHICLES.chemical, launchVehicle: SLS, launches: 1, margin: 0.07 });
    expect(s.factors.find((f) => f.id === 'crewed-launch').probability).toBe(LAUNCH_RELIABILITY);
  });

  it('a tanker launch failure does not: more tankers add expected re-flights and cost, not launch-loss risk', () => {
    const few = successEstimate({ vehicle: VEHICLES.starship, launchVehicle: SHIP, launches: 3, margin: 0.07 });
    const many = successEstimate({ vehicle: VEHICLES.starship, launchVehicle: SHIP, launches: 13, margin: 0.07 });
    const launchFactor = (s) => s.factors.find((f) => f.id === 'crewed-launch').probability;
    expect(launchFactor(many)).toBe(launchFactor(few));
    // Expected extra launches = U(1 − p)/p for U uncrewed tankers.
    expect(many.recoverable.expectedReflights).toBeCloseTo((12 * (1 - LAUNCH_RELIABILITY)) / LAUNCH_RELIABILITY, 12);
    expect(many.recoverable.costPenaltyUsd).toBeCloseTo(many.recoverable.expectedReflights * SHIP.costPerLaunchUsd, 3);
    expect(many.recoverable.delayDays).toBeCloseTo(many.recoverable.expectedReflights * REFLIGHT_DELAY_DAYS, 9);
    // Propellant transfers dock with the crewed ship, so they stay mission-critical.
    expect(many.factors.find((f) => f.id === 'crew-dockings').probability)
      .toBeCloseTo(VEHICLES.starship.operationReliability ** 12, 15);
  });

  it('assembled stacks: one crew docking whatever N is; uncrewed elements re-fly on launch or docking failure', () => {
    const s = successEstimate({ vehicle: VEHICLES.chemical, launchVehicle: SLS, launches: 5, margin: 0.07 });
    expect(s.factors.find((f) => f.id === 'crew-dockings').probability).toBe(VEHICLES.chemical.operationReliability);
    const q = LAUNCH_RELIABILITY * VEHICLES.chemical.operationReliability;
    expect(s.recoverable.expectedReflights).toBeCloseTo((4 * (1 - q)) / q, 12);
  });

  it('aerocapture only counts for aerocapture vehicles', () => {
    const chem = successEstimate({ vehicle: VEHICLES.chemical, launchVehicle: SLS, launches: 2, margin: 0.07 });
    const ship = successEstimate({ vehicle: VEHICLES.starship, launchVehicle: SHIP, launches: 2, margin: 0.07 });
    expect(chem.factors.find((f) => f.id === 'aerocapture').probability).toBe(1);
    expect(ship.factors.find((f) => f.id === 'aerocapture').probability).toBe(VEHICLES.starship.aerocaptureReliability);
  });

  it('simulateMission exposes successFactors and adds the re-flight reserve to the cost', () => {
    const m = simulateMission({ vehicle: 'starship', windowId: '2028-12' });
    expect(m.successFactors.length).toBe(6);
    expect(m.success.probability).toBeCloseTo(m.successFactors.reduce((p, f) => p * f.probability, 1), 15);
    expect(m.cost.reflightReserve).toBeGreaterThan(0);
    expect(m.launchPlan.expectedLaunches).toBeCloseTo(m.launches + m.launchPlan.expectedReflights, 12);
  });
});
