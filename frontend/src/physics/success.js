/**
 * Mission success estimate: a documented HEURISTIC, not a reliability
 * analysis.
 *
 * Binding rule (PLAN.md Decision 2): a failed UNCREWED launch, or a failed
 * docking of an uncrewed element, is recoverable. The element is re-flown,
 * which adds expected cost and schedule, not mission loss. Only these are
 * mission-critical and multiply into the success probability:
 *   - the crewed launch,
 *   - dockings / propellant transfers that involve the crewed vehicle,
 *   - in-space propulsive burns (trans-Mars injection, Mars capture),
 *   - aerocapture (if used) and Mars entry, descent and landing (EDL),
 *   - a Δv-margin term: thin reserves leave less room for dispersions.
 *
 * Launch architecture assumed (simplified):
 *   - 'assembled' stacks: N launches. N − 1 carry uncrewed elements, which
 *     each launch and dock on their own (recoverable). The crew rides the last
 *     launch with the habitat and docks once with the assembled stack
 *     (critical, if N > 1).
 *   - 'tanker' (Starship): the crewed ship launches first; each of the N − 1
 *     tanker launches is uncrewed (recoverable), but every propellant
 *     transfer docks with the crewed ship (critical). An architecture that
 *     fills the ship before the crew arrives would move these transfers to the
 *     recoverable column.
 *
 * Expected re-flights: if each uncrewed element succeeds with probability q
 * (launch × docking for assembled elements; launch only for tankers), the
 * expected number of attempts to get U successes is U/q (negative binomial),
 * so expected extra launches = U(1 − q)/q. Cost penalty = that × cost per
 * launch. Schedule penalty = that × REFLIGHT_DELAY_DAYS.
 *
 * Every per-event probability below is a HEURISTIC chosen to reflect flight
 * heritage (operational launchers succeed ≈ 98–99+ % of the time; new,
 * never-flown systems get lower values). None is measured data. The launch
 * term depends on the launcher's reliability class (launchVehicles.js):
 * proven 0.99, limited history 0.97, planned/never flown 0.96, flight test 0.95.
 */

/**
 * Heuristic per-launch success probability of a proven launcher. Used only
 * when a launch vehicle carries no `launchReliability` of its own.
 */
export const LAUNCH_RELIABILITY = 0.99;

/** Heuristic probability of Mars entry, descent and landing (same lander assumption for every architecture). */
export const EDL_RELIABILITY = 0.98;

/**
 * Schedule cost of one re-flight [days]. ASSUMPTION: failure review plus a
 * replacement vehicle; real return-to-flight stand-downs range from weeks to
 * many months.
 */
export const REFLIGHT_DELAY_DAYS = 30;

/**
 * Δv-margin factor: 1 − 0.10·exp(−margin / 0.04). Heuristic shape: at a 2 %
 * margin it costs ≈ 6 %, at 12 % ≈ 0.5 %.
 * @param {number} margin Fractional Δv margin.
 */
export function marginReliability(margin) {
  return 1 - 0.1 * Math.exp(-margin / 0.04);
}

/**
 * @typedef {object} SuccessFactor
 * @property {string} id
 * @property {string} label
 * @property {number} probability  Contribution to the product (1 = no effect).
 * @property {string} explanation  Plain-language reason, for the UI.
 */

/**
 * Builds the success estimate.
 * @param {object} p
 * @param {import('./vehicles.js').Vehicle} p.vehicle
 * @param {import('./launchVehicles.js').LaunchVehicle} p.launchVehicle
 * @param {number} p.launches   Total launches (integer ≥ 1).
 * @param {number} p.margin     Fractional Δv margin.
 * @returns {{probability:number, factors:SuccessFactor[],
 *   recoverable:{uncrewedLaunches:number, elementReliability:number, expectedReflights:number,
 *   costPenaltyUsd:number, delayDays:number, explanation:string}}}
 */
export function successEstimate({ vehicle, launchVehicle, launches, margin }) {
  if (!Number.isInteger(launches) || launches < 1) throw new RangeError('launches must be an integer ≥ 1');
  const tanker = vehicle.launchMode === 'tanker';
  const uncrewed = launches - 1;
  const crewDockings = tanker ? uncrewed : (launches > 1 ? 1 : 0);
  const propulsive = vehicle.marsCapture === 'propulsive';
  const burns = propulsive ? 2 : 1;
  const launchReliability = launchVehicle.launchReliability ?? LAUNCH_RELIABILITY;
  const basis = launchVehicle.reliabilityBasis ? `; ${launchVehicle.reliabilityBasis}` : '';

  const factors = [
    {
      id: 'crewed-launch',
      label: 'Crewed launch',
      probability: launchReliability,
      explanation: `The one launch carrying the crew must succeed: heuristic ${(launchReliability * 100).toFixed(0)}% per launch for ${launchVehicle.name} (${launchVehicle.reliabilityClass ?? 'proven'}${basis}).`,
    },
    {
      id: 'crew-dockings',
      label: tanker ? 'Propellant transfers to the crewed ship' : 'Crew vehicle docks with the stack',
      probability: vehicle.operationReliability ** crewDockings,
      explanation: tanker
        ? `${crewDockings} tanker transfers each dock with the crewed ship (heuristic ${(vehicle.operationReliability * 100).toFixed(1)}% each).`
        : crewDockings > 0
          ? `The crew docks once with the stack assembled from ${uncrewed} uncrewed launches.`
          : 'Single launch: no docking needed.',
    },
    {
      id: 'propulsive-burns',
      label: propulsive ? 'Trans-Mars injection and Mars capture burns' : 'Trans-Mars injection burn',
      probability: vehicle.burnReliability ** burns,
      explanation: `${burns} major burn${burns > 1 ? 's' : ''} at a heuristic ${(vehicle.burnReliability * 100).toFixed(0)}% each, reflecting the engine's flight heritage (TRL ${vehicle.trl}).`,
    },
    {
      id: 'aerocapture',
      label: 'Mars aerocapture',
      probability: propulsive ? 1 : (vehicle.aerocaptureReliability ?? 1),
      explanation: propulsive
        ? 'Not used: this vehicle brakes with an engine burn.'
        : 'Braking into Mars orbit with the heat shield; never attempted at crewed scale.',
    },
    {
      id: 'edl',
      label: 'Mars entry, descent and landing',
      probability: EDL_RELIABILITY,
      explanation: 'Same landing assumption for every architecture (heuristic).',
    },
    {
      id: 'delta-v-margin',
      label: 'Δv reserve',
      probability: marginReliability(margin),
      explanation: `${(margin * 100).toFixed(0)}% Δv reserve; thinner reserves leave less room for dispersions and engine underperformance.`,
    },
  ];
  const probability = factors.reduce((p, f) => p * f.probability, 1);

  const elementReliability = tanker ? launchReliability : launchReliability * vehicle.operationReliability;
  const expectedReflights = (uncrewed * (1 - elementReliability)) / elementReliability;
  return {
    probability,
    factors,
    recoverable: {
      uncrewedLaunches: uncrewed,
      elementReliability,
      expectedReflights,
      costPenaltyUsd: expectedReflights * launchVehicle.costPerLaunchUsd,
      delayDays: expectedReflights * REFLIGHT_DELAY_DAYS,
      explanation: 'Failed uncrewed launches are re-flown: they add expected cost and schedule, not mission loss.',
    },
  };
}
