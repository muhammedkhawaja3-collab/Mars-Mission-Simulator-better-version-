/**
 * Turns several MissionResults into a neutral, data-driven list of trade-offs:
 * which vehicle is best on each metric, and by how much. There is no built-in
 * winner. The UI copy is generated from whatever the physics produces.
 */

/**
 * Metrics compared, with a direction. Values come straight from MissionResult (SI).
 * @type {ReadonlyArray<{key:string, label:string, better:'lower'|'higher', get:(m:object)=>number}>}
 */
export const TRADEOFF_METRICS = Object.freeze([
  { key: 'transitTime', label: 'transit time', better: 'lower', get: (m) => m.transitTime },
  { key: 'missionDose', label: 'total mission radiation dose', better: 'lower', get: (m) => m.dose.mission },
  { key: 'initialMassInLEO', label: 'mass in low Earth orbit', better: 'lower', get: (m) => m.mass.initialMassInLEO },
  { key: 'launches', label: 'number of launches', better: 'lower', get: (m) => m.launches },
  { key: 'cost', label: 'transportation cost', better: 'lower', get: (m) => m.cost.total },
  { key: 'success', label: 'estimated success probability', better: 'higher', get: (m) => m.success.probability },
  { key: 'deltaVReserve', label: 'spare Δv capability', better: 'higher', get: (m) => m.deltaV.reserve },
]);

/**
 * @param {Record<string, object>} missions Map of vehicle id → MissionResult.
 * @returns {Array<{key:string, label:string, better:string, bestId:string, bestValue:number,
 *   runnerUpId:string|null, runnerUpValue:number|null, tie:boolean}>}
 *   One entry per metric. Only feasible missions are compared, and metrics with
 *   fewer than one feasible mission are omitted.
 */
export function summarizeTradeoffs(missions) {
  if (!missions || typeof missions !== 'object') throw new TypeError('missions must be an object');
  const feasible = Object.entries(missions).filter(([, m]) => m && m.feasible);
  if (feasible.length === 0) return [];
  return TRADEOFF_METRICS.map((metric) => {
    const sorted = feasible
      .map(([id, m]) => ({ id, value: metric.get(m) }))
      .sort((a, b) => (metric.better === 'lower' ? a.value - b.value : b.value - a.value));
    const [best, second] = sorted;
    return {
      key: metric.key,
      label: metric.label,
      better: metric.better,
      bestId: best.id,
      bestValue: best.value,
      runnerUpId: second?.id ?? null,
      runnerUpValue: second?.value ?? null,
      tie: second ? Math.abs(second.value - best.value) <= 1e-9 * Math.max(1, Math.abs(best.value)) : false,
    };
  });
}
