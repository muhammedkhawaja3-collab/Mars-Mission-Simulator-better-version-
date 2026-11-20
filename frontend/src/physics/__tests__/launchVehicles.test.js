import { describe, it, expect } from 'vitest';
import { LAUNCH_VEHICLES, LAUNCH_VEHICLE_IDS, getLaunchVehicle, launchCompatibility } from '../launchVehicles.js';
import { VEHICLES, VEHICLE_IDS, createCustomVehicle } from '../vehicles.js';
import { simulateMission } from '../mission.js';

const HOHMANN = { kind: 'hohmann' };

describe('launch-vehicle catalog', () => {
  it('has the five required launchers with sourced, positive figures', () => {
    expect([...LAUNCH_VEHICLE_IDS].sort()).toEqual(['falcon-heavy', 'new-glenn', 'sls-block1', 'sls-block2', 'starship']);
    for (const id of LAUNCH_VEHICLE_IDS) {
      const lv = LAUNCH_VEHICLES[id];
      expect(lv.id).toBe(id);
      expect(lv.payloadLeoKg).toBeGreaterThan(0);
      expect(lv.thrustN).toBeGreaterThan(0);
      expect(lv.costPerLaunchUsd).toBeGreaterThan(0);
      expect(typeof lv.source).toBe('string');
      expect(lv.source.length).toBeGreaterThan(10);
      expect(['operational', 'flight-test', 'planned']).toContain(lv.status);
      for (const isp of [lv.ispSeaLevelS, lv.ispVacS]) expect(isp === null || isp > 0).toBe(true);
    }
  });

  it('uses the correct SLS block figures (Block 1 ≈ 95 t; Block 2 130 t and planned)', () => {
    expect(LAUNCH_VEHICLES['sls-block1'].payloadLeoKg).toBe(95_000);
    expect(LAUNCH_VEHICLES['sls-block1'].status).toBe('operational');
    expect(LAUNCH_VEHICLES['sls-block2'].payloadLeoKg).toBe(130_000);
    expect(LAUNCH_VEHICLES['sls-block2'].status).toBe('planned');
    expect(LAUNCH_VEHICLES['falcon-heavy'].payloadLeoKg).toBe(63_800);
    expect(LAUNCH_VEHICLES['new-glenn'].payloadLeoKg).toBe(45_000);
  });

  it('getLaunchVehicle rejects unknown ids', () => {
    expect(() => getLaunchVehicle('saturn-v')).toThrow(TypeError);
    expect(getLaunchVehicle('starship').name).toMatch(/Starship/);
  });
});

describe('stage × launcher compatibility', () => {
  it('assembled stages fly on any launcher; the Starship stage needs the Starship launcher', () => {
    for (const lv of LAUNCH_VEHICLE_IDS) {
      expect(launchCompatibility(VEHICLES.chemical, lv).ok).toBe(true);
      expect(launchCompatibility(VEHICLES.nuclear, lv).ok).toBe(true);
      const s = launchCompatibility(VEHICLES.starship, lv);
      expect(s.ok).toBe(lv === 'starship');
      if (!s.ok) expect(s.reason).toMatch(/Starship/);
    }
  });

  it('simulateMission throws RangeError for an invalid combination', () => {
    expect(() => simulateMission({ vehicle: 'starship', launchVehicle: 'sls-block1' })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'starship', launchVehicle: 'falcon-heavy' })).toThrow(/can only launch on/);
  });

  it('every stage has a valid default launcher', () => {
    for (const id of VEHICLE_IDS) {
      const v = VEHICLES[id];
      expect(launchCompatibility(v, v.defaultLaunchVehicle).ok).toBe(true);
    }
    expect(createCustomVehicle({ name: 'c', isp: 450, stageDryMass: 20_000, propellantCapacity: 200_000 }).defaultLaunchVehicle).toBe('sls-block1');
  });

  it('nuclear stage is labelled as a never-flown advanced concept', () => {
    expect(VEHICLES.nuclear.name).toMatch(/advanced concept, never flown/);
  });
});

describe('launch count and cost', () => {
  const run = (launchVehicle) => simulateMission({ vehicle: 'chemical', launchVehicle, windowId: '2028-12', transferChoice: HOHMANN });

  it('assembled stacks need ceil(mass in LEO / launcher payload) launches, priced by the launcher', () => {
    for (const lvId of ['sls-block1', 'sls-block2', 'falcon-heavy', 'new-glenn', 'starship']) {
      const m = run(lvId);
      const lv = LAUNCH_VEHICLES[lvId];
      expect(m.launches).toBe(Math.ceil(m.mass.initialMassInLEO / lv.payloadLeoKg - 1e-9));
      expect(m.cost.launches).toBeCloseTo(m.launches * lv.costPerLaunchUsd, 0);
    }
  });

  it('more payload per launch → no more launches (monotonic)', () => {
    const byPayload = [...LAUNCH_VEHICLE_IDS].sort((a, b) => LAUNCH_VEHICLES[a].payloadLeoKg - LAUNCH_VEHICLES[b].payloadLeoKg);
    const counts = byPayload.map((id) => run(id).launches);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBeGreaterThan(counts[counts.length - 1]);
  });

  it('the launcher changes launches and cost but not the trajectory or propellant', () => {
    const a = run('sls-block1');
    const b = run('new-glenn');
    expect(b.transitTime).toBe(a.transitTime);
    expect(b.mass.propellant).toBe(a.mass.propellant);
    expect(b.launches).toBeGreaterThan(a.launches);
  });
});
