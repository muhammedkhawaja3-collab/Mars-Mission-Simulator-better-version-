/**
 * Optional server cross-check. The UI computes everything locally with the JS
 * physics engine; this call never blocks or changes what the user sees.
 * It uses the RELATIVE /api path (same origin in production; the Vite dev
 * server proxies it to the FastAPI backend on :8000).
 */
import { toDays } from '../physics/index.js';
import { transferOptionFor } from '../model/fleet.js';

export const API_TIMEOUT_MS = 4000;

/**
 * Request body for POST /api/mission (backend/app/schemas.py MissionRequest,
 * strict: unknown fields are rejected). `launchVehicleId` is the launcher the
 * local engine actually used (Starship always flies on Starship).
 */
export function missionRequestBody(config, vehicle, launchVehicleId = config.launchVehicleId) {
  const choice = transferOptionFor(config.transferChoice).choice;
  return {
    vehicle,
    launch_vehicle: launchVehicleId,
    crew_size: config.crewSize,
    risk_tolerance: config.riskTolerance,
    window_id: config.windowId,
    transfer:
      choice.kind === 'timeOfFlight'
        ? { kind: 'timeOfFlight', time_of_flight: choice.timeOfFlight }
        : { kind: choice.kind },
    seed: config.seed,
  };
}

/**
 * Asks the backend to fly the same mission and compares outbound transit time.
 * Resolves to 'agrees' | 'differs' | 'offline'; never rejects.
 * @param {object} config MissionConfig
 * @param {object} rocket A feasible fleet DisplayRocket computed locally.
 * @param {{signal?: AbortSignal}} [opts]
 */
export async function crossCheckMission(config, rocket, opts = {}) {
  if (!rocket || rocket.failed || rocket.key === 'player') return 'offline';
  try {
    // Loaded on demand so axios stays out of the initial bundle.
    const { default: axios } = await import('axios');
    const res = await axios.post(
      '/api/mission',
      missionRequestBody(config, rocket.key, rocket.mission.launchVehicleId),
      {
        timeout: API_TIMEOUT_MS,
        signal: opts.signal,
      },
    );
    const serverTransit = Number(res?.data?.transitTime);
    if (!Number.isFinite(serverTransit)) return 'offline';
    const localTransit = rocket.mission.transitTime;
    return Math.abs(serverTransit - localTransit) <= 1e-6 * Math.max(1, localTransit) ||
      Math.abs(toDays(serverTransit) - rocket.transit) < 0.05
      ? 'agrees'
      : 'differs';
  } catch {
    return 'offline';
  }
}
