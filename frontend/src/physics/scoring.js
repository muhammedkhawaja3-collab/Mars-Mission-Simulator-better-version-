/**
 * Mission score (0–1000), letter grade and achievements: GAMEPLAY LAYER.
 *
 * Pure functions of a MissionResult. Every component is shown with its
 * points, maximum and a plain-language explanation, so the score is
 * transparent rather than a black box. The weights are design choices, not
 * physics.
 *
 * Components (max points):
 *   success     300  heuristic success probability × 300 (0 if the event model aborted the mission)
 *   radiation   200  200 × (1 − mission dose / 600 mSv career limit), floored at 0
 *   propellant  150  150 × (propellant on the minimum-energy transfer / propellant used), capped at 1
 *   cost        150  150 × (1 − log₁₀(cost / $1 B) / log₁₀(30)), clamped 0–1: $1 B → 150, $30 B → 0
 *   transit     200  200 × (330 d − transit) / (330 d − 120 d), clamped 0–1
 */
import { DAY } from './constants.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Letter grades by minimum score, best first. */
export const GRADE_THRESHOLDS = Object.freeze([
  Object.freeze({ grade: 'A+', min: 900 }),
  Object.freeze({ grade: 'A', min: 800 }),
  Object.freeze({ grade: 'B', min: 650 }),
  Object.freeze({ grade: 'C', min: 500 }),
  Object.freeze({ grade: 'D', min: 350 }),
  Object.freeze({ grade: 'F', min: 0 }),
]);

/** @param {number} score 0–1000 @returns {string} */
export function gradeFor(score) {
  return GRADE_THRESHOLDS.find((g) => score >= g.min).grade;
}

/** Achievement catalogue. `test` is a pure predicate on a feasible MissionResult. */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'fuel-miser', label: 'Fuel Miser', description: 'Used no more than 2% more propellant than the minimum-energy transfer.',
    test: (m) => m.mass.propellant <= 1.02 * m.mass.hohmannPropellant },
  { id: 'perfect-window', label: 'Perfect Window', description: 'Flew in the cheapest of the fixed launch windows (lowest minimum-energy v∞).',
    test: (m, ctx) => m.windowId !== null && m.windowId === ctx.bestWindowId },
  { id: 'radiation-rookie', label: 'Radiation Rookie', description: 'Whole-mission dose under half of the 600 mSv career limit.',
    test: (m) => m.dose.careerFraction < 0.5 },
  { id: 'shielded', label: 'Shielded', description: 'Vehicle shielding cuts the deep-space dose rate by at least 25%.',
    test: (m) => m.vehicle.gcrShieldingFactor <= 0.75 },
  { id: 'heavy-lifter', label: 'Heavy Lifter', description: 'Assembled more than 500 t in low Earth orbit.',
    test: (m) => m.mass.initialMassInLEO > 500_000 },
  { id: 'speed-demon', label: 'Speed Demon', description: 'Outbound transit under 180 days.',
    test: (m) => m.transitTime < 180 * DAY },
  { id: 'full-crew', label: 'Full Crew', description: 'Flew the maximum crew of 8.',
    test: (m) => m.inputs.crewSize === 8 },
  { id: 'risk-taker', label: 'Risk Taker Survives', description: 'Risk tolerance 8 or higher, events on, and no abort.',
    test: (m) => m.inputs.riskTolerance >= 8 && m.inputs.seed !== null && !m.eventSummary.abort },
]);

/**
 * Scores a mission result.
 * @param {object} m MissionResult from simulateMission (feasible or not).
 * @param {{bestWindowId?: string|null}} [ctx]
 * @returns {{total:number, max:number, grade:string,
 *   components:Array<{id:string, label:string, points:number, max:number, value:number, explanation:string}>,
 *   achievements:Array<{id:string, label:string, description:string}>}}
 */
export function scoreMission(m, ctx = {}) {
  if (!m || !m.feasible) {
    return { total: 0, max: 1000, grade: 'F', components: [], achievements: [] };
  }
  const aborted = Boolean(m.eventSummary && m.eventSummary.abort);
  const transitDays = m.transitTime / DAY;
  const propellantRatio = m.mass.hohmannPropellant / m.mass.propellant;
  const costB = m.cost.total / 1e9;

  const components = [
    {
      id: 'success', label: 'Success probability', max: 300,
      value: m.success.probability,
      points: aborted ? 0 : 300 * m.success.probability,
      explanation: aborted
        ? 'The gameplay event model aborted this flight, so no success points.'
        : '300 × the heuristic success probability.',
    },
    {
      id: 'radiation', label: 'Crew radiation dose', max: 200,
      value: m.dose.careerFraction,
      points: 200 * clamp01(1 - m.dose.careerFraction),
      explanation: '200 × (1 − mission dose ÷ 600 mSv career limit).',
    },
    {
      id: 'propellant', label: 'Propellant efficiency', max: 150,
      value: propellantRatio,
      points: 150 * clamp01(propellantRatio),
      explanation: '150 × (propellant the minimum-energy transfer needs ÷ propellant used).',
    },
    {
      id: 'cost', label: 'Transportation cost', max: 150,
      value: m.cost.total,
      points: 150 * clamp01(1 - Math.log10(Math.max(costB, 1e-9)) / Math.log10(30)),
      explanation: 'Full marks at $1 B or less, zero at $30 B (logarithmic).',
    },
    {
      id: 'transit', label: 'Transit time', max: 200,
      value: m.transitTime,
      points: 200 * clamp01((330 - transitDays) / (330 - 120)),
      explanation: 'Full marks at 120 days or less, zero at 330 days.',
    },
  ];
  const total = components.reduce((s, c) => s + c.points, 0);
  const context = { bestWindowId: ctx.bestWindowId ?? null };
  const achievements = ACHIEVEMENTS
    .filter((a) => a.test(m, context))
    .map(({ id, label, description }) => ({ id, label, description }));
  return { total, max: 1000, grade: gradeFor(total), components, achievements };
}
