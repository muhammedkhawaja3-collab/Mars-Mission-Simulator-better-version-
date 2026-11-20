import { describe, it, expect } from 'vitest';
import { simulateMission, CAREER_LIMIT_NOTE, missionFraming } from '../mission.js';
import { comparisonFraming, cheapestCompatibleLauncher } from '../tradeoffs.js';
import { LAUNCH_VEHICLES } from '../launchVehicles.js';
import { VEHICLES } from '../vehicles.js';

describe('mission framing notes', () => {
  it('names the launcher and its price, and explains the capture method', () => {
    const m = simulateMission({ vehicle: 'chemical', windowId: '2028-12' });
    const byId = Object.fromEntries(m.framing.map((f) => [f.id, f.text]));
    expect(Object.keys(byId)).toEqual(['launcher-cost', 'capture-method', 'career-limit']);
    expect(byId['launcher-cost']).toContain('SLS Block 1');
    expect(byId['launcher-cost']).toContain('$2.2 B per launch');
    expect(byId['capture-method']).toContain('DRA 5.0');
    expect(byId['career-limit']).toBe(CAREER_LIMIT_NOTE);
  });

  it('describes aerocapture and the fixed launcher for the Starship stage', () => {
    const m = simulateMission({ vehicle: 'starship', windowId: '2028-12' });
    const byId = Object.fromEntries(m.framing.map((f) => [f.id, f.text]));
    expect(byId['launcher-cost']).toContain('$150 M per launch');
    expect(byId['launcher-cost']).toContain('only fly on its own launcher');
    expect(byId['capture-method']).toContain('aerocapture');
  });

  it('is a pure function of vehicle, launcher and dose', () => {
    const f = missionFraming(VEHICLES.nuclear, LAUNCH_VEHICLES['falcon-heavy'], { exceedsCareerLimit: false });
    expect(f.map((x) => x.id)).toEqual(['launcher-cost', 'capture-method']);
    expect(f[0].text).toContain('Falcon Heavy');
  });

  it('exposes the launcher reliability class in the result', () => {
    const m = simulateMission({ vehicle: 'nuclear', launchVehicle: 'sls-block2', windowId: '2028-12' });
    expect(m.launchVehicle.reliabilityClass).toBe('planned');
    expect(m.launchVehicle.launchReliability).toBe(LAUNCH_VEHICLES['sls-block2'].launchReliability);
    expect(m.successFactors[0].probability).toBe(m.launchVehicle.launchReliability);
  });
});

describe('comparison framing', () => {
  const chem = simulateMission({ vehicle: 'chemical', windowId: '2028-12' });
  const nuc = simulateMission({ vehicle: 'nuclear', windowId: '2028-12' });
  const ship = simulateMission({ vehicle: 'starship', windowId: '2028-12' });

  it('says when every cost uses one launcher', () => {
    const f = comparisonFraming({ chemical: chem, nuclear: nuc });
    expect(f).toEqual([{ id: 'launchers', text: 'All costs shown with SLS Block 1.' }]);
  });

  it('lists each launcher and flags differing capture methods', () => {
    const f = comparisonFraming({ chemical: chem, nuclear: nuc, starship: ship });
    expect(f.map((x) => x.id)).toEqual(['launchers', 'capture-method']);
    expect(f[0].text).toContain('chemical on SLS Block 1');
    expect(f[0].text).toContain('starship on Starship');
  });

  it('ignores infeasible missions and validates input', () => {
    expect(comparisonFraming({ x: { feasible: false } })).toEqual([]);
    expect(() => comparisonFraming(null)).toThrow(TypeError);
  });
});

describe('cheapestCompatibleLauncher', () => {
  it('tries every launcher for an assembled stage and returns the lowest total cost', () => {
    const r = cheapestCompatibleLauncher({ vehicle: 'chemical', windowId: '2028-12' });
    expect(r.candidates.map((c) => c.launchVehicleId)).toEqual(['starship', 'sls-block1', 'sls-block2', 'falcon-heavy', 'new-glenn']);
    const feasible = r.candidates.filter((c) => c.feasible);
    expect(r.mission.cost.total).toBe(Math.min(...feasible.map((c) => c.costTotal)));
    expect(r.mission.launchVehicleId).toBe(r.launchVehicleId);
    expect(r.launchVehicleId).not.toBe('sls-block1');
  });

  it('only tries Starship for the Starship stage', () => {
    const r = cheapestCompatibleLauncher({ vehicle: 'starship', windowId: '2028-12', launchVehicle: 'sls-block1' });
    expect(r.candidates.map((c) => c.launchVehicleId)).toEqual(['starship']);
    expect(r.launchVehicleId).toBe('starship');
  });

  it('returns null when no launcher gives a feasible mission', () => {
    const r = cheapestCompatibleLauncher({ vehicle: 'chemical', windowId: '2028-12', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 90 * 86400 } });
    expect(r.launchVehicleId).toBeNull();
    expect(r.mission).toBeNull();
    expect(() => cheapestCompatibleLauncher({ vehicle: 'warp' })).toThrow(TypeError);
  });
});
