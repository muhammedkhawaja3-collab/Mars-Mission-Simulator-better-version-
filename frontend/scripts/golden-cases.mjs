/**
 * Golden-fixture case definitions, shared by the generator (gen-golden.mjs)
 * and the Vitest check (src/physics/__tests__/golden.test.js). The Python
 * mirror reads the same inputs from shared/golden_cases.json.
 *
 * Input format (plain JSON):
 *   vehicle         'chemical' | 'nuclear' | 'starship' | { custom: createCustomVehicle() params }
 *   launchVehicle   launch-vehicle id (optional; stage default if absent)
 *   crewSize, riskTolerance, windowId, seed (uint32 or null)
 *   transferChoice  { kind: 'fastest' | 'hohmann' } or { kind: 'timeOfFlight', timeOfFlight: seconds }
 *   habitatMass     optional [kg]
 */
import { createCustomVehicle } from '../src/physics/vehicles.js';

const DAY = 86400;

export const GOLDEN_CASES = [
  { id: 'chem-sls1-default', description: 'Chemical on SLS Block 1, default mission, no events',
    input: { vehicle: 'chemical', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: null } },
  { id: 'ntr-sls1-default', description: 'Nuclear thermal on SLS Block 1, default mission, no events',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: null } },
  { id: 'ship-default', description: 'Starship with tankers, default mission, no events',
    input: { vehicle: 'starship', launchVehicle: 'starship', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: null } },
  { id: 'chem-sls1-default-s42', description: 'Chemical default mission with events, seed 42',
    input: { vehicle: 'chemical', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: 42 } },
  { id: 'chem-sls1-default-s43', description: 'Same as above, seed 43 (different events, same physics)',
    input: { vehicle: 'chemical', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: 43 } },
  { id: 'chem-fh-c2-r1-2026-hoh', description: 'Chemical on Falcon Heavy, 2 crew, risk 1, 2027 window, Hohmann',
    input: { vehicle: 'chemical', launchVehicle: 'falcon-heavy', crewSize: 2, riskTolerance: 1, windowId: '2026-11', transferChoice: { kind: 'hohmann' }, seed: 42 } },
  { id: 'ntr-sls2-c8-r10-2031-hoh', description: 'Nuclear on SLS Block 2 (planned), 8 crew, risk 10, 2031 window, Hohmann',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block2', crewSize: 8, riskTolerance: 10, windowId: '2031-01', transferChoice: { kind: 'hohmann' }, seed: 7 } },
  { id: 'ship-c8-r10-2033-hoh', description: 'Starship, 8 crew, risk 10, 2033 window, Hohmann',
    input: { vehicle: 'starship', launchVehicle: 'starship', crewSize: 8, riskTolerance: 10, windowId: '2033-03', transferChoice: { kind: 'hohmann' }, seed: 123456789 } },
  { id: 'chem-ng-c6-r3-2035-tof200', description: 'Chemical on New Glenn, 6 crew, risk 3, 2035 window, fixed 200-day transfer',
    input: { vehicle: 'chemical', launchVehicle: 'new-glenn', crewSize: 6, riskTolerance: 3, windowId: '2035-07', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 200 * DAY }, seed: 1 } },
  { id: 'ntr-ng-c2-r8-2026-fast', description: 'Nuclear on New Glenn, 2 crew, risk 8, 2027 window, fastest, max seed',
    input: { vehicle: 'nuclear', launchVehicle: 'new-glenn', crewSize: 2, riskTolerance: 8, windowId: '2026-11', transferChoice: { kind: 'fastest' }, seed: 4294967295 } },
  { id: 'chem-sls2-c8-r1-2033-fast', description: 'Chemical on SLS Block 2, 8 crew, risk 1, 2033 window, fastest',
    input: { vehicle: 'chemical', launchVehicle: 'sls-block2', crewSize: 8, riskTolerance: 1, windowId: '2033-03', transferChoice: { kind: 'fastest' }, seed: 2024 } },
  { id: 'ntr-fh-c4-r10-2035-fast', description: 'Nuclear on Falcon Heavy, 4 crew, risk 10, 2035 window, fastest',
    input: { vehicle: 'nuclear', launchVehicle: 'falcon-heavy', crewSize: 4, riskTolerance: 10, windowId: '2035-07', transferChoice: { kind: 'fastest' }, seed: 99 } },
  { id: 'ship-c2-r1-2031-fast', description: 'Starship, 2 crew, risk 1, 2031 window, fastest, seed 0',
    input: { vehicle: 'starship', launchVehicle: 'starship', crewSize: 2, riskTolerance: 1, windowId: '2031-01', transferChoice: { kind: 'fastest' }, seed: 0 } },
  { id: 'ship-2035-hoh-s42', description: 'Starship, 4 crew, 2035 window, Hohmann, seed 42',
    input: { vehicle: 'starship', launchVehicle: 'starship', crewSize: 4, riskTolerance: 5, windowId: '2035-07', transferChoice: { kind: 'hohmann' }, seed: 42 } },
  { id: 'ntr-sls1-c6-2031-hoh-s42', description: 'Nuclear on SLS Block 1, 6 crew, 2031 window, Hohmann, seed 42',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block1', crewSize: 6, riskTolerance: 5, windowId: '2031-01', transferChoice: { kind: 'hohmann' }, seed: 42 } },
  { id: 'ntr-sls2-r7-2033-tof220', description: 'Nuclear on SLS Block 2, risk 7, 2033 window, fixed 220-day transfer',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block2', crewSize: 4, riskTolerance: 7, windowId: '2033-03', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 220 * DAY }, seed: 5 } },
  { id: 'chem-fh-c8-r10-2031-hoh', description: 'Chemical on Falcon Heavy, 8 crew, risk 10, 2031 window, Hohmann',
    input: { vehicle: 'chemical', launchVehicle: 'falcon-heavy', crewSize: 8, riskTolerance: 10, windowId: '2031-01', transferChoice: { kind: 'hohmann' }, seed: 77777 } },
  { id: 'ntr-sls1-r1-2026-fast', description: 'Nuclear on SLS Block 1, risk 1, 2027 window, fastest',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 1, windowId: '2026-11', transferChoice: { kind: 'fastest' }, seed: 31337 } },
  { id: 'custom-shielded-ng', description: 'Custom shielded NTR-class build on New Glenn with its own habitat mass',
    input: { vehicle: { custom: { name: 'Custom shielded', isp: 845, stageDryMass: 25_000, propellantCapacity: 200_000, trl: 5, gcrShieldingFactor: 0.6 } },
      launchVehicle: 'new-glenn', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'fastest' }, seed: 8, habitatMass: 20_000 } },
  { id: 'custom-chem-default-lv', description: 'Custom chemical build, default launcher, Hohmann',
    input: { vehicle: { custom: { name: 'Custom chem', isp: 465, stageDryMass: 12_000, propellantCapacity: 400_000, trl: 7 } },
      crewSize: 3, riskTolerance: 4, windowId: '2033-03', transferChoice: { kind: 'hohmann' }, seed: 2 } },
  { id: 'ntr-sls1-r10-2033-hoh-abort', description: 'Nuclear, risk 10 (2% reserve), seed 35: an engine fault exceeds the reserve (event-model abort)',
    input: { vehicle: 'nuclear', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 10, windowId: '2033-03', transferChoice: { kind: 'hohmann' }, seed: 35 } },
  { id: 'ship-tof150-infeasible', description: 'Starship 150-day transfer: exceeds the aerocapture entry-speed limit (infeasible)',
    input: { vehicle: 'starship', launchVehicle: 'starship', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 150 * DAY }, seed: null } },
  { id: 'chem-tof150-infeasible', description: 'Chemical 150-day transfer: needs more propellant than the tanks hold (infeasible)',
    input: { vehicle: 'chemical', launchVehicle: 'sls-block1', crewSize: 4, riskTolerance: 5, windowId: '2028-12', transferChoice: { kind: 'timeOfFlight', timeOfFlight: 150 * DAY }, seed: null } },
];

/** Converts a golden input into simulateMission() arguments. */
export function toSimulateArgs(input) {
  const { vehicle, ...rest } = input;
  return {
    ...rest,
    vehicle: typeof vehicle === 'string' ? vehicle : createCustomVehicle(vehicle.custom),
  };
}
