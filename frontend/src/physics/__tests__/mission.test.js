import { describe, it, expect } from 'vitest';
import {
  simulateMission, crewPayloadMass, deltaVMargin, successEstimate, crewHealthIndex, CREW_PAYLOAD,
} from '../mission.js';
import { VEHICLES, VEHICLE_IDS, createCustomVehicle } from '../vehicles.js';
import { launchWindows } from '../ephemeris.js';
import { summarizeTradeoffs } from '../tradeoffs.js';
import { DAY, GCR_CRUISE_DOSE_RATE, MARS_SURFACE_DOSE_RATE, CAREER_DOSE_LIMIT } from '../constants.js';

// Fixed reference date so results never depend on when the tests run.
const [NEXT_WINDOW] = launchWindows({ after: new Date(Date.UTC(2026, 10, 20)), count: 1 });
const launchDate = NEXT_WINDOW.departureDate;
const HOHMANN = { kind: 'hohmann' };
const days = (s) => s / DAY;

/** Two custom vehicles that differ only in Isp (same 300 t wet stage). */
const twin = (isp) => createCustomVehicle({ name: `isp${isp}`, isp, stageDryMass: 40_000, propellantCapacity: 260_000 });

describe('default mission (4 crew, next window, fastest transfer each vehicle can fly)', () => {
  const results = Object.fromEntries(VEHICLE_IDS.map((id) => [id, simulateMission({ vehicle: id, crewSize: 4, launchDate })]));

  it('is feasible for every reference vehicle, with sane magnitudes', () => {
    for (const m of Object.values(results)) {
      expect(m.feasible).toBe(true);
      expect(days(m.transitTime)).toBeGreaterThan(90);
      expect(days(m.transitTime)).toBeLessThanOrEqual(days(m.hohmannTransitTime) + 1e-6);
      expect(m.deltaV.total).toBeGreaterThan(3000);
      expect(m.mass.propellant).toBeGreaterThan(0);
      expect(m.launches).toBeGreaterThanOrEqual(1);
      expect(m.success.probability).toBeGreaterThan(0);
      expect(m.success.probability).toBeLessThan(1);
      expect(m.crewHealthIndex).toBeGreaterThanOrEqual(0);
      expect(m.crewHealthIndex).toBeLessThanOrEqual(100);
    }
  });

  it('every vehicle carries the same crew payload per day of transit', () => {
    for (const m of Object.values(results)) {
      const expected = crewPayloadMass({ crewSize: 4, transitTime: m.transitTime });
      expect(m.mass.payload).toBeCloseTo(expected.total, 6);
    }
  });

  it('no vehicle exceeds its tank capacity, and the planned Δv includes the margin', () => {
    for (const [id, m] of Object.entries(results)) {
      expect(m.mass.propellant).toBeLessThanOrEqual(VEHICLES[id].propellantCapacity * (1 + 1e-9));
      expect(m.deltaV.planned).toBeCloseTo(m.deltaV.total * (1 + deltaVMargin(5)), 6);
    }
  });

  it('Starship skips the capture burn (aerocapture); the others brake propulsively', () => {
    expect(results.starship.deltaV.capture).toBe(0);
    expect(results.chemical.deltaV.capture).toBeGreaterThan(0);
    expect(results.nuclear.deltaV.capture).toBeGreaterThan(0);
  });

  it('cost = hardware + launches × cost per launch, and Starship counts the ship plus its tankers', () => {
    for (const [id, m] of Object.entries(results)) {
      const v = VEHICLES[id];
      expect(m.cost.total).toBeCloseTo(v.hardwareCost + m.launches * v.launch.costPerLaunch, 0);
    }
    const s = results.starship;
    expect(s.launches).toBe(1 + Math.ceil(s.mass.propellant / VEHICLES.starship.launch.capacityPerLaunch - 1e-9));
  });

  it('dose = measured rate × time for each phase', () => {
    for (const m of Object.values(results)) {
      expect(m.dose.transit).toBeCloseTo(GCR_CRUISE_DOSE_RATE * m.transitTime, 9);
      expect(m.dose.surface).toBeCloseTo(MARS_SURFACE_DOSE_RATE * m.duration.surfaceStay, 9);
      expect(m.dose.mission).toBeCloseTo(m.dose.transit + m.dose.surface + m.dose.return, 9);
      expect(m.dose.careerFraction).toBeCloseTo(m.dose.mission / CAREER_DOSE_LIMIT, 9);
    }
  });

  it('a 1.84 mSv/day cruise rate over ~200+ days is hundreds of mSv (RAD-scale numbers)', () => {
    const msv = results.chemical.dose.transit * 1000;
    expect(msv).toBeGreaterThan(200);
    expect(msv).toBeLessThan(600);
  });

  it('produces a genuine trade-off: no single vehicle wins every metric', () => {
    const summary = summarizeTradeoffs(results);
    const winners = new Set(summary.map((s) => s.bestId));
    expect(winners.size).toBeGreaterThan(1);
  });
});

describe('monotonicity', () => {
  it('more crew → more payload, more propellant and more mass in LEO', () => {
    const run = (crewSize) => simulateMission({ vehicle: 'nuclear', crewSize, launchDate, transferChoice: HOHMANN });
    const masses = [2, 4, 6, 8].map(run);
    for (let i = 1; i < masses.length; i++) {
      expect(masses[i].mass.payload).toBeGreaterThan(masses[i - 1].mass.payload);
      expect(masses[i].mass.propellant).toBeGreaterThan(masses[i - 1].mass.propellant);
      expect(masses[i].mass.initialMassInLEO).toBeGreaterThan(masses[i - 1].mass.initialMassInLEO);
    }
  });

  it('faster transfer → more Δv and less transit radiation', () => {
    const slow = simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: HOHMANN });
    const tofs = [230, 210, 190];
    let prev = slow;
    for (const d of tofs) {
      const m = simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: { kind: 'timeOfFlight', timeOfFlight: d * DAY } });
      expect(m.feasible).toBe(true);
      expect(days(m.transitTime)).toBeCloseTo(d, 1);
      expect(m.deltaV.total).toBeGreaterThan(prev.deltaV.total);
      expect(m.dose.transit).toBeLessThan(prev.dose.transit);
      prev = m;
    }
  });

  it('higher Isp → less propellant on the same trajectory', () => {
    const props = [380, 460, 900].map((isp) =>
      simulateMission({ vehicle: twin(isp), launchDate, transferChoice: HOHMANN }).mass.propellant);
    expect(props[1]).toBeLessThan(props[0]);
    expect(props[2]).toBeLessThan(props[1]);
  });

  it('at equal stage mass, higher Isp buys a shorter transit in "fastest" mode', () => {
    const lo = simulateMission({ vehicle: twin(460), launchDate });
    const hi = simulateMission({ vehicle: twin(900), launchDate });
    expect(hi.transitTime).toBeLessThan(lo.transitTime);
    expect(hi.dose.transit).toBeLessThan(lo.dose.transit);
  });

  it('higher risk tolerance → thinner margin → transit no longer, but success estimate lower', () => {
    const safe = simulateMission({ vehicle: 'chemical', launchDate, riskTolerance: 1 });
    const bold = simulateMission({ vehicle: 'chemical', launchDate, riskTolerance: 10 });
    expect(bold.transitTime).toBeLessThanOrEqual(safe.transitTime);
    expect(bold.success.factors.deltaVMargin).toBeLessThan(safe.success.factors.deltaVMargin);
  });

  it('better GCR shielding lowers the cruise dose proportionally', () => {
    const base = simulateMission({ vehicle: createCustomVehicle({ name: 'a', isp: 900, stageDryMass: 60_000, propellantCapacity: 200_000 }), launchDate, transferChoice: HOHMANN });
    const shielded = simulateMission({ vehicle: createCustomVehicle({ name: 'b', isp: 900, stageDryMass: 60_000, propellantCapacity: 200_000, gcrShieldingFactor: 0.6 }), launchDate, transferChoice: HOHMANN });
    expect(shielded.dose.transit).toBeCloseTo(0.6 * base.dose.transit, 9);
  });
});

describe('same-mission comparisons', () => {
  it('on the Hohmann transfer every vehicle has the same transit time and dose', () => {
    const ms = VEHICLE_IDS.map((id) => simulateMission({ vehicle: id, launchDate, transferChoice: HOHMANN }));
    for (const m of ms) {
      expect(m.transitTime).toBeCloseTo(ms[0].transitTime, 6);
      expect(m.dose.mission).toBeCloseTo(ms[0].dose.mission, 9);
    }
  });
});

describe('feasibility limits', () => {
  it('flags transfers beyond the Starship aerocapture entry-speed limit', () => {
    const m = simulateMission({ vehicle: 'starship', launchDate, transferChoice: { kind: 'timeOfFlight', timeOfFlight: 150 * DAY } });
    expect(m.feasible).toBe(false);
    expect(m.infeasibleReason).toMatch(/aerocapture/);
    expect(m.transitTime).toBeNull();
  });

  it('flags transfers that need more propellant than the tanks hold', () => {
    const m = simulateMission({ vehicle: 'chemical', launchDate, transferChoice: { kind: 'timeOfFlight', timeOfFlight: 150 * DAY } });
    expect(m.feasible).toBe(false);
    expect(m.infeasibleReason).toMatch(/tanks hold/);
  });

  it('flags a fixed time slower than the minimum-energy transfer', () => {
    const m = simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: { kind: 'timeOfFlight', timeOfFlight: 400 * DAY } });
    expect(m.feasible).toBe(false);
  });

  it('a hopelessly heavy custom vehicle is infeasible even on Hohmann', () => {
    const brick = createCustomVehicle({ name: 'brick', isp: 300, stageDryMass: 500_000, propellantCapacity: 10_000 });
    const m = simulateMission({ vehicle: brick, launchDate });
    expect(m.feasible).toBe(false);
  });
});

describe('inputs', () => {
  it('launchYear picks the window nearest mid-year', () => {
    const m = simulateMission({ vehicle: 'nuclear', launchYear: 2033, transferChoice: HOHMANN });
    expect(m.departureDate.getUTCFullYear()).toBe(2033);
  });

  it('rejects invalid input', () => {
    expect(() => simulateMission({ vehicle: 'warp-drive', launchDate })).toThrow(TypeError);
    expect(() => simulateMission({ vehicle: 'nuclear', crewSize: 0, launchDate })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear', crewSize: 2.5, launchDate })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear', crewSize: '4', launchDate })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear', riskTolerance: 0, launchDate })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear', riskTolerance: 11, launchDate })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: { kind: 'teleport' } })).toThrow(TypeError);
    expect(() => simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: { kind: 'timeOfFlight', timeOfFlight: -1 } })).toThrow(RangeError);
    expect(() => simulateMission({ vehicle: 'nuclear' })).toThrow(TypeError);
    expect(() => simulateMission({ vehicle: 'nuclear', launchDate: new Date('nope') })).toThrow(TypeError);
    expect(() => simulateMission()).toThrow(TypeError);
  });

  it('createCustomVehicle validates its parts', () => {
    expect(() => createCustomVehicle({ name: 'x', isp: 0, stageDryMass: 1, propellantCapacity: 1 })).toThrow(RangeError);
    expect(() => createCustomVehicle({ name: 'x', isp: 400, stageDryMass: 1, propellantCapacity: 1, gcrShieldingFactor: 1.5 })).toThrow(RangeError);
  });
});

describe('component models', () => {
  it('crew payload: habitat + crew + consumables', () => {
    const p = crewPayloadMass({ crewSize: 4, transitTime: 200 * DAY });
    const P = CREW_PAYLOAD;
    expect(p.habitat).toBe(P.habitatBaseMass + 4 * P.habitatMassPerCrew);
    expect(p.consumables).toBeCloseTo(P.consumablesPerCrewDay * 4 * (200 + P.contingencyDays), 6);
    expect(p.total).toBeCloseTo(p.habitat + p.crew + p.consumables, 6);
  });

  it('Δv margin spans 12% (risk 1) to 2% (risk 10)', () => {
    expect(deltaVMargin(1)).toBeCloseTo(0.12, 12);
    expect(deltaVMargin(10)).toBeCloseTo(0.02, 12);
    expect(() => deltaVMargin(NaN)).toThrow(RangeError);
  });

  it('success estimate is the product of its factors, and more launches lower it', () => {
    const v = VEHICLES.chemical;
    const a = successEstimate({ vehicle: v, launches: 2, burns: 2, margin: 0.07 });
    const b = successEstimate({ vehicle: v, launches: 6, burns: 2, margin: 0.07 });
    const product = Object.values(a.factors).reduce((p, f) => p * f, 1);
    expect(a.probability).toBeCloseTo(product, 12);
    expect(b.probability).toBeLessThan(a.probability);
  });

  it('crew health index falls with dose and zero-g time and stays within 0–100', () => {
    const low = crewHealthIndex({ missionDose: 0.3, microgravityTime: 200 * DAY });
    const high = crewHealthIndex({ missionDose: 1.2, microgravityTime: 500 * DAY });
    expect(high).toBeLessThan(low);
    expect(crewHealthIndex({ missionDose: 0, microgravityTime: 0 })).toBe(100);
    expect(crewHealthIndex({ missionDose: 10, microgravityTime: 0 })).toBe(0);
  });
});

describe('summarizeTradeoffs', () => {
  it('ignores infeasible missions and reports the best per metric', () => {
    const ok = simulateMission({ vehicle: 'nuclear', launchDate, transferChoice: HOHMANN });
    const ok2 = simulateMission({ vehicle: 'chemical', launchDate, transferChoice: HOHMANN });
    const bad = { feasible: false };
    const s = summarizeTradeoffs({ nuclear: ok, chemical: ok2, broken: bad });
    const prop = s.find((x) => x.key === 'initialMassInLEO');
    expect(prop.bestId).toBe('nuclear'); // higher Isp, same trajectory
    expect(s.every((x) => x.bestId !== 'broken')).toBe(true);
    const transit = s.find((x) => x.key === 'transitTime');
    expect(transit.tie).toBe(true);
    expect(summarizeTradeoffs({ broken: bad })).toEqual([]);
    expect(() => summarizeTradeoffs(null)).toThrow(TypeError);
  });
});
