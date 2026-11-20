"""Neutral, data-driven trade-offs between several MissionResults.

Mirror of ``frontend/src/physics/tradeoffs.js``: which vehicle is best on
each metric, and by how much. There is no built-in winner; the copy is
generated from whatever the physics produces. Also provides comparison
framing and a helper that re-flies a stage on its cheapest compatible
launcher, so stages can be compared on equal launch terms.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from .launch_vehicles import LAUNCH_VEHICLE_IDS, launch_compatibility
from .mission import simulate_mission
from .vehicles import VEHICLES


@dataclass(frozen=True)
class TradeoffMetric:
    """One compared metric with its direction; ``get`` reads it from a MissionResult (SI)."""

    key: str
    label: str
    better: str  # 'lower' | 'higher'
    get: Callable[[Mapping], float]


TRADEOFF_METRICS: tuple[TradeoffMetric, ...] = (
    TradeoffMetric("transitTime", "transit time", "lower", lambda m: m["transitTime"]),
    TradeoffMetric(
        "missionDose", "total mission radiation dose", "lower", lambda m: m["dose"]["total"]
    ),
    TradeoffMetric(
        "initialMassInLEO",
        "mass in low Earth orbit",
        "lower",
        lambda m: m["mass"]["initialMassInLEO"],
    ),
    TradeoffMetric("launches", "number of launches", "lower", lambda m: m["launches"]),
    TradeoffMetric("cost", "transportation cost", "lower", lambda m: m["cost"]["total"]),
    TradeoffMetric(
        "success",
        "estimated success probability",
        "higher",
        lambda m: m["success"]["probability"],
    ),
    TradeoffMetric(
        "deltaVReserve", "spare Δv capability", "higher", lambda m: m["deltaV"]["reserve"]
    ),
)


def summarize_tradeoffs(missions: Mapping[str, Mapping]) -> list[dict]:
    """One entry per metric: best and runner-up vehicle among feasible missions."""
    if not isinstance(missions, Mapping):
        raise TypeError("missions must be an object")
    feasible = [(vid, m) for vid, m in missions.items() if m and m.get("feasible")]
    if not feasible:
        return []
    out = []
    for metric in TRADEOFF_METRICS:
        values = [{"id": vid, "value": metric.get(m)} for vid, m in feasible]
        values.sort(key=lambda x: x["value"], reverse=metric.better == "higher")
        best = values[0]
        second = values[1] if len(values) > 1 else None
        out.append(
            {
                "key": metric.key,
                "label": metric.label,
                "better": metric.better,
                "bestId": best["id"],
                "bestValue": best["value"],
                "runnerUpId": second["id"] if second else None,
                "runnerUpValue": second["value"] if second else None,
                "tie": abs(second["value"] - best["value"]) <= 1e-9 * max(1, abs(best["value"]))
                if second
                else False,
            }
        )
    return out


def comparison_framing(missions: Mapping[str, Mapping]) -> list[dict]:
    """Framing notes for a side-by-side comparison, as ``[{id, text}]``.

    ``launchers``: which launcher each feasible mission's cost assumes;
    ``capture-method``: present when the capture methods differ.
    """
    if not isinstance(missions, Mapping):
        raise TypeError("missions must be an object")
    feasible = [(vid, m) for vid, m in missions.items() if m and m.get("feasible")]
    if not feasible:
        return []
    names: list[str] = []
    for _, m in feasible:
        if m["launchVehicle"]["name"] not in names:
            names.append(m["launchVehicle"]["name"])
    if len(names) == 1:
        text = f"All costs shown with {names[0]}."
    else:
        pairs = ", ".join(f"{vid} on {m['launchVehicle']['name']}" for vid, m in feasible)
        text = (
            f"Costs use different launchers: {pairs}. "
            "Launch cost depends on the launcher as much as on the stage."
        )
    notes = [{"id": "launchers", "text": text}]
    if len({m["vehicle"]["marsCapture"] for _, m in feasible}) > 1:
        notes.append(
            {
                "id": "capture-method",
                "text": "Capture methods differ (engine burn vs aerocapture). That is an "
                "architecture choice, not a property of the propellant: NASA's DRA 5.0 also "
                "studied aerocapture for the chemical option.",
            }
        )
    return notes


def cheapest_compatible_launcher(**params) -> dict:
    """Fly a stage on every compatible launcher; return the lowest total-cost feasible one.

    ``params`` are ``simulate_mission`` keyword arguments; ``launch_vehicle`` is
    ignored. Ties keep catalog order. Returns ``{"launchVehicleId", "mission",
    "candidates": [{"launchVehicleId", "feasible", "costTotal"}]}``.
    """
    vehicle = params.get("vehicle")
    stage = VEHICLES.get(vehicle) if isinstance(vehicle, str) else vehicle
    if not stage:
        raise TypeError(f"Unknown vehicle: {vehicle}")
    candidates = []
    best = None
    for lv_id in LAUNCH_VEHICLE_IDS:
        if not launch_compatibility(stage, lv_id)["ok"]:
            continue
        m = simulate_mission(**{**params, "launch_vehicle": lv_id})
        candidates.append(
            {
                "launchVehicleId": lv_id,
                "feasible": m["feasible"],
                "costTotal": m["cost"]["total"] if m["feasible"] else None,
            }
        )
        if m["feasible"] and (best is None or m["cost"]["total"] < best["cost"]["total"]):
            best = m
    return {
        "launchVehicleId": best["launchVehicleId"] if best else None,
        "mission": best,
        "candidates": candidates,
    }
