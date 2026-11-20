/**
 * Turns several MissionResults into a neutral, data-driven list of trade-offs:
 * which vehicle is best on each metric, and by how much. There is no built-in
 * winner. The UI copy is generated from whatever the physics produces.
 *
 * Also provides comparison framing (which launcher each cost assumes, and
 * that the Mars capture method is an architecture choice) and a helper that
 * re-flies a stage on its cheapest compatible launcher, so stages can be
 * compared on equal launch terms.
 */
import { simulateMission } from './mission.js';
import { LAUNCH_VEHICLE_IDS, launchCompatibility } from './launchVehicles.js';
import { VEHICLES } from './vehicles.js';

/**
 * Metrics compared, with a direction. Values come straight from MissionResult (SI).
 * @type {ReadonlyArray<{key:string, label:string, better:'lower'|'higher', get:(m:object)=>number}>}
 */
export const TRADEOFF_METRICS = Object.freeze([
  { key: 'transitTime', label: 'transit time', better: 'lower', get: (m) => m.transitTime },
  { key: 'missionDose', label: 'total mission radiation dose', better: 'lower', get: (m) => m.dose.total },
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

/**
 * Framing notes for a side-by-side comparison, as [{id, text}]:
 *   'launchers'      which launcher each feasible mission's cost assumes;
 *   'capture-method' present when the capture methods differ.
 * @param {Record<string, object>} missions Map of vehicle id → MissionResult.
 * @returns {Array<{id:string, text:string}>}
 */
export function comparisonFraming(missions) {
  if (!missions || typeof missions !== 'object') throw new TypeError('missions must be an object');
  const feasible = Object.entries(missions).filter(([, m]) => m && m.feasible);
  if (feasible.length === 0) return [];
  const notes = [];
  const launcherNames = [...new Set(feasible.map(([, m]) => m.launchVehicle.name))];
  notes.push({
    id: 'launchers',
    text: launcherNames.length === 1
      ? `All costs shown with ${launcherNames[0]}.`
      : `Costs use different launchers: ${feasible.map(([id, m]) => `${id} on ${m.launchVehicle.name}`).join(', ')}. ` +
        'Launch cost depends on the launcher as much as on the stage.',
  });
  const captures = new Set(feasible.map(([, m]) => m.vehicle.marsCapture));
  if (captures.size > 1) {
    notes.push({
      id: 'capture-method',
      text: 'Capture methods differ (engine burn vs aerocapture). That is an architecture choice, not a property of the ' +
        "propellant: NASA's DRA 5.0 also studied aerocapture for the chemical option.",
    });
  }
  return notes;
}

/**
 * Flies a stage on every compatible launcher and returns the one with the
 * lowest total cost among feasible results (ties keep catalog order).
 * @param {object} params simulateMission parameters; `launchVehicle` is ignored.
 * @returns {{launchVehicleId:string|null, mission:object|null,
 *   candidates:Array<{launchVehicleId:string, feasible:boolean, costTotal:number|null}>}}
 */
export function cheapestCompatibleLauncher(params) {
  const stage = typeof params.vehicle === 'string' ? VEHICLES[params.vehicle] : params.vehicle;
  if (!stage) throw new TypeError(`Unknown vehicle: ${String(params.vehicle)}`);
  const candidates = [];
  let best = null;
  for (const id of LAUNCH_VEHICLE_IDS) {
    if (!launchCompatibility(stage, id).ok) continue;
    const m = simulateMission({ ...params, launchVehicle: id });
    candidates.push({ launchVehicleId: id, feasible: m.feasible, costTotal: m.feasible ? m.cost.total : null });
    if (m.feasible && (best === null || m.cost.total < best.cost.total)) best = m;
  }
  return { launchVehicleId: best ? best.launchVehicleId : null, mission: best, candidates };
}
