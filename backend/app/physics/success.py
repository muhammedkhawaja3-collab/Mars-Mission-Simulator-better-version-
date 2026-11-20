"""Mission success estimate: a documented HEURISTIC, not a reliability analysis.

Mirror of ``frontend/src/physics/success.js``.

Binding rule (PLAN.md Decision 2): a failed UNCREWED launch, or a failed
docking of an uncrewed element, is recoverable. The element is re-flown,
which adds expected cost and schedule, not mission loss. Only these are
mission-critical and multiply into the success probability:
  - the crewed launch,
  - dockings / propellant transfers that involve the crewed vehicle,
  - in-space propulsive burns (trans-Mars injection, Mars capture),
  - aerocapture (if used) and Mars entry, descent and landing (EDL),
  - a Δv-margin term: thin reserves leave less room for dispersions.

Launch architecture assumed (simplified):
  - 'assembled' stacks: N launches. N − 1 carry uncrewed elements, which each
    launch and dock on their own (recoverable). The crew rides the last
    launch with the habitat and docks once with the assembled stack
    (critical, if N > 1).
  - 'tanker' (Starship): the crewed ship launches first; each of the N − 1
    tanker launches is uncrewed (recoverable), but every propellant transfer
    docks with the crewed ship (critical). An architecture that fills the
    ship before the crew arrives would move these transfers to the
    recoverable column.

Expected re-flights: if each uncrewed element succeeds with probability q
(launch × docking for assembled elements; launch only for tankers), the
expected number of attempts to get U successes is U/q (negative binomial),
so expected extra launches = U(1 − q)/q. Cost penalty = that × cost per
launch. Schedule penalty = that × REFLIGHT_DELAY_DAYS.

Every per-event probability below is a HEURISTIC chosen to reflect flight
heritage (operational launchers succeed ≈ 98-99+ % of the time; new,
never-flown systems get lower values). None is measured data. The launch
term depends on the launcher's reliability class (launch_vehicles.py):
proven 0.99, limited history 0.97, planned/never flown 0.96, flight test 0.95.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

from .jscompat import RangeError, js_str, to_fixed

#: Heuristic per-launch success probability of a proven launcher. Used only
#: when a launch vehicle carries no ``launchReliability`` of its own.
LAUNCH_RELIABILITY = 0.99

#: Heuristic probability of Mars entry, descent and landing (same lander for every architecture).
EDL_RELIABILITY = 0.98

#: Schedule cost of one re-flight [days]. ASSUMPTION: failure review plus a
#: replacement vehicle; real return-to-flight stand-downs range from weeks to
#: many months.
REFLIGHT_DELAY_DAYS = 30


def margin_reliability(margin: float) -> float:
    """Δv-margin factor: 1 − 0.10·exp(−margin / 0.04).

    Heuristic shape: at a 2 % margin it costs ≈ 6 %, at 12 % ≈ 0.5 %.
    """
    return 1 - 0.1 * math.exp(-margin / 0.04)


def success_estimate(
    *, vehicle: Mapping, launch_vehicle: Mapping, launches: int, margin: float
) -> dict:
    """Build the success estimate: probability, factors and the recoverable re-flight terms."""
    if isinstance(launches, bool) or not isinstance(launches, int) or launches < 1:
        raise RangeError("launches must be an integer ≥ 1")
    tanker = vehicle["launchMode"] == "tanker"
    uncrewed = launches - 1
    crew_dockings = uncrewed if tanker else (1 if launches > 1 else 0)
    propulsive = vehicle["marsCapture"] == "propulsive"
    burns = 2 if propulsive else 1
    op_rel = vehicle["operationReliability"]
    burn_rel = vehicle["burnReliability"]
    launch_rel = launch_vehicle.get("launchReliability")
    if launch_rel is None:
        launch_rel = LAUNCH_RELIABILITY
    basis = (
        f"; {launch_vehicle['reliabilityBasis']}" if launch_vehicle.get("reliabilityBasis") else ""
    )
    rel_class = launch_vehicle.get("reliabilityClass") or "proven"

    if tanker:
        docking_expl = (
            f"{crew_dockings} tanker transfers each dock with the crewed ship "
            f"(heuristic {to_fixed(op_rel * 100, 1)}% each)."
        )
    elif crew_dockings > 0:
        docking_expl = (
            f"The crew docks once with the stack assembled from {uncrewed} uncrewed launches."
        )
    else:
        docking_expl = "Single launch: no docking needed."

    aero = vehicle.get("aerocaptureReliability")
    factors = [
        {
            "id": "crewed-launch",
            "label": "Crewed launch",
            "probability": launch_rel,
            "explanation": "The one launch carrying the crew must succeed: heuristic "
            f"{to_fixed(launch_rel * 100, 0)}% per launch for {launch_vehicle.get('name')} "
            f"({rel_class}{basis}).",
        },
        {
            "id": "crew-dockings",
            "label": "Propellant transfers to the crewed ship"
            if tanker
            else "Crew vehicle docks with the stack",
            "probability": op_rel**crew_dockings,
            "explanation": docking_expl,
        },
        {
            "id": "propulsive-burns",
            "label": "Trans-Mars injection and Mars capture burns"
            if propulsive
            else "Trans-Mars injection burn",
            "probability": burn_rel**burns,
            "explanation": f"{burns} major burn{'s' if burns > 1 else ''} at a heuristic "
            f"{to_fixed(burn_rel * 100, 0)}% each, reflecting the engine's flight heritage "
            f"(TRL {js_str(vehicle['trl'])}).",
        },
        {
            "id": "aerocapture",
            "label": "Mars aerocapture",
            "probability": 1 if propulsive else (aero if aero is not None else 1),
            "explanation": "Not used: this vehicle brakes with an engine burn."
            if propulsive
            else "Braking into Mars orbit with the heat shield; never attempted at crewed scale.",
        },
        {
            "id": "edl",
            "label": "Mars entry, descent and landing",
            "probability": EDL_RELIABILITY,
            "explanation": "Same landing assumption for every architecture (heuristic).",
        },
        {
            "id": "delta-v-margin",
            "label": "Δv reserve",
            "probability": margin_reliability(margin),
            "explanation": f"{to_fixed(margin * 100, 0)}% Δv reserve; thinner reserves leave "
            "less room for dispersions and engine underperformance.",
        },
    ]
    probability = 1
    for f in factors:
        probability = probability * f["probability"]

    element_reliability = launch_rel if tanker else launch_rel * op_rel
    expected_reflights = (uncrewed * (1 - element_reliability)) / element_reliability
    return {
        "probability": probability,
        "factors": factors,
        "recoverable": {
            "uncrewedLaunches": uncrewed,
            "elementReliability": element_reliability,
            "expectedReflights": expected_reflights,
            "costPenaltyUsd": expected_reflights * launch_vehicle["costPerLaunchUsd"],
            "delayDays": expected_reflights * REFLIGHT_DELAY_DAYS,
            "explanation": "Failed uncrewed launches are re-flown: they add expected cost and "
            "schedule, not mission loss.",
        },
    }
