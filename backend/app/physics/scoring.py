"""Mission score (0-1000), letter grade and achievements: GAMEPLAY LAYER.

Mirror of ``frontend/src/physics/scoring.js``.

Pure functions of a MissionResult. Every component is shown with its points,
maximum and a plain-language explanation, so the score is transparent rather
than a black box. The weights are design choices, not physics.

Components (max points):
  success     300  heuristic success probability × 300 (0 if the event model aborted the mission)
  radiation   200  200 × (1 − mission dose / 600 mSv career limit), floored at 0
  propellant  150  150 × (propellant on the minimum-energy transfer / propellant used), capped at 1
  cost        150  150 × (1 − log₁₀(cost / $1 B) / log₁₀(30)), clamped 0-1: $1 B → 150, $30 B → 0
  transit     200  200 × (330 d − transit) / (330 d − 120 d), clamped 0-1
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from .constants import DAY


def _clamp01(x: float) -> float:
    return min(1, max(0, x))


#: Letter grades by minimum score, best first.
GRADE_THRESHOLDS: tuple[tuple[str, int], ...] = (
    ("A+", 900),
    ("A", 800),
    ("B", 650),
    ("C", 500),
    ("D", 350),
    ("F", 0),
)


def grade_for(score: float) -> str:
    """Letter grade for a 0-1000 score."""
    return next(g for g, lo in GRADE_THRESHOLDS if score >= lo)


@dataclass(frozen=True)
class Achievement:
    """An achievement; ``test`` is a pure predicate on a feasible MissionResult."""

    id: str
    label: str
    description: str
    test: Callable[[Mapping, Mapping], bool]


#: Achievement catalogue.
ACHIEVEMENTS: tuple[Achievement, ...] = (
    Achievement(
        "fuel-miser",
        "Fuel Miser",
        "Used no more than 2% more propellant than the minimum-energy transfer.",
        lambda m, ctx: m["mass"]["propellant"] <= 1.02 * m["mass"]["hohmannPropellant"],
    ),
    Achievement(
        "perfect-window",
        "Perfect Window",
        "Flew in the cheapest of the fixed launch windows (lowest minimum-energy v∞).",
        lambda m, ctx: m["windowId"] is not None and m["windowId"] == ctx["bestWindowId"],
    ),
    Achievement(
        "radiation-rookie",
        "Radiation Rookie",
        "Whole-mission dose under half of the 600 mSv career limit.",
        lambda m, ctx: m["dose"]["careerFraction"] < 0.5,
    ),
    Achievement(
        "shielded",
        "Shielded",
        "Vehicle shielding cuts the deep-space dose rate by at least 25%.",
        lambda m, ctx: m["vehicle"]["gcrShieldingFactor"] <= 0.75,
    ),
    Achievement(
        "heavy-lifter",
        "Heavy Lifter",
        "Assembled more than 500 t in low Earth orbit.",
        lambda m, ctx: m["mass"]["initialMassInLEO"] > 500_000,
    ),
    Achievement(
        "speed-demon",
        "Speed Demon",
        "Outbound transit under 180 days.",
        lambda m, ctx: m["transitTime"] < 180 * DAY,
    ),
    Achievement(
        "full-crew",
        "Full Crew",
        "Flew the maximum crew of 8.",
        lambda m, ctx: m["inputs"]["crewSize"] == 8,
    ),
    Achievement(
        "risk-taker",
        "Risk Taker Survives",
        "Risk tolerance 8 or higher, events on, and no abort.",
        lambda m, ctx: (
            m["inputs"]["riskTolerance"] >= 8
            and m["inputs"]["seed"] is not None
            and not m["eventSummary"]["abort"]
        ),
    ),
)


def score_mission(m: Mapping | None, ctx: Mapping | None = None) -> dict:
    """Score a mission result (feasible or not): total, max, grade, components, achievements."""
    ctx = ctx or {}
    if not m or not m.get("feasible"):
        return {"total": 0, "max": 1000, "grade": "F", "components": [], "achievements": []}
    aborted = bool(m.get("eventSummary") and m["eventSummary"]["abort"])
    transit_days = m["transitTime"] / DAY
    propellant_ratio = m["mass"]["hohmannPropellant"] / m["mass"]["propellant"]
    cost_b = m["cost"]["total"] / 1e9
    probability = m["success"]["probability"]

    components = [
        {
            "id": "success",
            "label": "Success probability",
            "max": 300,
            "value": probability,
            "points": 0 if aborted else 300 * probability,
            "explanation": "The gameplay event model aborted this flight, so no success points."
            if aborted
            else "300 × the heuristic success probability.",
        },
        {
            "id": "radiation",
            "label": "Crew radiation dose",
            "max": 200,
            "value": m["dose"]["careerFraction"],
            "points": 200 * _clamp01(1 - m["dose"]["careerFraction"]),
            "explanation": "200 × (1 − mission dose ÷ 600 mSv career limit).",
        },
        {
            "id": "propellant",
            "label": "Propellant efficiency",
            "max": 150,
            "value": propellant_ratio,
            "points": 150 * _clamp01(propellant_ratio),
            "explanation": (
                "150 × (propellant the minimum-energy transfer needs ÷ propellant used)."
            ),
        },
        {
            "id": "cost",
            "label": "Transportation cost",
            "max": 150,
            "value": m["cost"]["total"],
            "points": 150 * _clamp01(1 - math.log10(max(cost_b, 1e-9)) / math.log10(30)),
            "explanation": "Full marks at $1 B or less, zero at $30 B (logarithmic).",
        },
        {
            "id": "transit",
            "label": "Transit time",
            "max": 200,
            "value": m["transitTime"],
            "points": 200 * _clamp01((330 - transit_days) / (330 - 120)),
            "explanation": "Full marks at 120 days or less, zero at 330 days.",
        },
    ]
    total = 0
    for c in components:
        total = total + c["points"]
    context = {"bestWindowId": ctx.get("bestWindowId")}
    achievements = [
        {"id": a.id, "label": a.label, "description": a.description}
        for a in ACHIEVEMENTS
        if a.test(m, context)
    ]
    return {
        "total": total,
        "max": 1000,
        "grade": grade_for(total),
        "components": components,
        "achievements": achievements,
    }
