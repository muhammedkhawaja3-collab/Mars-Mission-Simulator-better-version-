"""Neutral, data-driven trade-offs between several MissionResults.

Mirror of ``frontend/src/physics/tradeoffs.js``: which vehicle is best on
each metric, and by how much. There is no built-in winner; the copy is
generated from whatever the physics produces.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass


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
