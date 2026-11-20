// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulateMission, MISSION_SCHEMA_VERSION } from '../index.js';
import { GOLDEN_CASES, toSimulateArgs } from '../../../scripts/golden-cases.mjs';

// shared/ lives at the repo root, outside the Vite root; read it from disk.
const golden = JSON.parse(readFileSync(new URL('../../../../shared/golden_cases.json', import.meta.url), 'utf8'));
const { relative: REL, absolute: ABS } = golden.tolerance;

/** Recursively compares a fresh result with the stored one; returns the first mismatch path or null. */
function diff(actual, expected, path = '$') {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return `${path}: expected number, got ${typeof actual}`;
    const tol = Math.max(ABS, REL * Math.max(Math.abs(actual), Math.abs(expected)));
    return Math.abs(actual - expected) <= tol ? null : `${path}: ${actual} ≠ ${expected}`;
  }
  if (expected === null || typeof expected !== 'object') {
    return actual === expected ? null : `${path}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return `${path}: array length ${actual?.length} ≠ ${expected.length}`;
    for (let i = 0; i < expected.length; i++) {
      const d = diff(actual[i], expected[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (actual === null || typeof actual !== 'object') return `${path}: expected object`;
  const ka = Object.keys(actual).sort();
  const ke = Object.keys(expected).sort();
  if (ka.join() !== ke.join()) return `${path}: keys [${ka}] ≠ [${ke}]`;
  for (const k of ke) {
    const d = diff(actual[k], expected[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

describe('golden fixtures (shared/golden_cases.json)', () => {
  it('match the current case list and schema version (run `npm run golden` after engine changes)', () => {
    expect(golden.schemaVersion).toBe(MISSION_SCHEMA_VERSION);
    expect(golden.cases.map((c) => c.id)).toEqual(GOLDEN_CASES.map((c) => c.id));
    expect(golden.cases.length).toBeGreaterThanOrEqual(20);
  });

  it('cover every stage, launcher, window, transfer kind, crew 2–8 and risk 1–10', () => {
    const inputs = golden.cases.map((c) => c.input);
    const set = (f) => new Set(inputs.map(f));
    expect(set((i) => (typeof i.vehicle === 'string' ? i.vehicle : 'custom'))).toEqual(new Set(['chemical', 'nuclear', 'starship', 'custom']));
    expect(set((i) => i.launchVehicle ?? 'default').size).toBeGreaterThanOrEqual(6);
    expect(set((i) => i.windowId).size).toBe(5);
    expect(set((i) => i.transferChoice.kind)).toEqual(new Set(['fastest', 'hohmann', 'timeOfFlight']));
    expect(set((i) => i.crewSize).has(2) && set((i) => i.crewSize).has(8)).toBe(true);
    expect(set((i) => i.riskTolerance).has(1) && set((i) => i.riskTolerance).has(10)).toBe(true);
    expect(golden.cases.some((c) => !c.expected.feasible)).toBe(true);
    expect(golden.cases.some((c) => c.expected.events && c.expected.events.length > 0)).toBe(true);
    expect(golden.cases.some((c) => c.expected.eventSummary?.abort)).toBe(true);
  });

  for (const c of golden.cases) {
    it(`reproduces ${c.id}`, () => {
      const actual = JSON.parse(JSON.stringify(simulateMission(toSimulateArgs(c.input))));
      expect(diff(actual, c.expected)).toBeNull();
    });
  }
});
