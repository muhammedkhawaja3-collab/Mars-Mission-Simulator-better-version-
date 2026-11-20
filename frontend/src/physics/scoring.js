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
 *   radiation   200  200 × (1.4 Sv − mission dose) / (1.4 Sv − 0.8 Sv), clamped 0–1
 *   propellant  150  150 × (propellant on the minimum-energy transfer / propellant used), capped at 1
 *   cost        150  150 × (1 − log₁₀(cost / $1 B) / log₁₀(30)), clamped 0–1: $1 B → 150, $30 B → 0
 *   transit     200  200 × (330 d − transit) / (330 d − 120 d), clamped 0–1
 *
 * Why the radiation scale is not "fraction of the 600 mSv career limit":
 * every conjunction-class mission exceeds that limit (two cruise legs at
 * 1.84 mSv/day plus a 13–25 month surface stay at 0.64 mSv/day give
 * ≈ 0.84–1.26 Sv for the reference vehicles), so a limit-based score would be
 * 0 for every mission. The scale instead spans the doses real missions reach:
 * 0.8 Sv is just below the lowest unshielded mission in this model (a fast
 * transit in a good window), 1.4 Sv is above the slowest minimum-energy
 * mission plus several solar particle events. As a cross-check, Hassler et
 * al. (Science 343, 2014) estimated ≈ 1.01 Sv for a 180 d + 500 d + 180 d
 * mission; this model gives ≈ 0.98 Sv for those durations. The limit itself
 * is reported, not hidden: see `dose.exceedsCareerLimit` and `framing` in
 * mission.js.
 */
import { DAY } from './constants.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Mission dose that earns full radiation points [Sv] (design choice, see header). */
export const RADIATION_SCORE_FULL_SV = 0.8;
/** Mission dose that earns zero radiation points [Sv] (design choice, see header). */
export const RADIATION_SCORE_ZERO_SV = 1.4;
/** Mission dose below which "Radiation Rookie" is earned [Sv]. */
export const RADIATION_ROOKIE_SV = 0.9;

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
  { id: 'radiation-rookie', label: 'Radiation Rookie', description: 'Whole-mission dose under 0.9 Sv (needs a fast transit or extra shielding).',
    test: (m) => m.dose.total < RADIATION_ROOKIE_SV },
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
      value: m.dose.total,
      points: 200 * clamp01((RADIATION_SCORE_ZERO_SV - m.dose.total) / (RADIATION_SCORE_ZERO_SV - RADIATION_SCORE_FULL_SV)),
      explanation: 'Full marks at 0.8 Sv or less, zero at 1.4 Sv. Every conjunction-class mission exceeds NASA\'s 0.6 Sv career limit, so the scale ranks the doses real missions reach.',
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
