"""Mission score (0-1000), letter grade and achievements: GAMEPLAY LAYER.

Mirror of ``frontend/src/physics/scoring.js``.

Pure functions of a MissionResult. Every component is shown with its points,
maximum and a plain-language explanation, so the score is transparent rather
than a black box. The weights are design choices, not physics.

Components (max points):
  success     300  heuristic success probability × 300 (0 if the event model aborted the mission)
  radiation   200  200 × (1.4 Sv − mission dose) / (1.4 Sv − 0.8 Sv), clamped 0-1
  propellant  150  150 × (propellant on the minimum-energy transfer / propellant used), capped at 1
  cost        150  150 × (1 − log₁₀(cost / $1 B) / log₁₀(30)), clamped 0-1: $1 B → 150, $30 B → 0
  transit     200  200 × (330 d − transit) / (330 d − 120 d), clamped 0-1

Why the radiation scale is not "fraction of the 600 mSv career limit": every
conjunction-class mission exceeds that limit (two cruise legs at 1.84 mSv/day
plus a 13-25 month surface stay at 0.64 mSv/day give ≈ 0.84-1.26 Sv for the
reference vehicles), so a limit-based score would be 0 for every mission. The
scale instead spans the doses real missions reach: 0.8 Sv is just below the
lowest unshielded mission in this model, 1.4 Sv is above the slowest
minimum-energy mission plus several solar particle events. Cross-check:
Hassler et al. (Science 343, 2014) estimated ≈ 1.01 Sv for a 180 d + 500 d +
180 d mission; this model gives ≈ 0.98 Sv for those durations. The limit is
reported, not hidden: see ``dose.exceedsCareerLimit`` and ``framing``.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from .constants import DAY


def _clamp01(x: float) -> float:
    return min(1, max(0, x))


#: Mission dose that earns full radiation points [Sv] (design choice, see header).
RADIATION_SCORE_FULL_SV = 0.8
#: Mission dose that earns zero radiation points [Sv] (design choice, see header).
RADIATION_SCORE_ZERO_SV = 1.4
#: Mission dose below which "Radiation Rookie" is earned [Sv].
RADIATION_ROOKIE_SV = 0.9


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
        "Whole-mission dose under 0.9 Sv (needs a fast transit or extra shielding).",
        lambda m, ctx: m["dose"]["total"] < RADIATION_ROOKIE_SV,
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
            "value": m["dose"]["total"],
            "points": 200
            * _clamp01(
                (RADIATION_SCORE_ZERO_SV - m["dose"]["total"])
                / (RADIATION_SCORE_ZERO_SV - RADIATION_SCORE_FULL_SV)
            ),
            "explanation": "Full marks at 0.8 Sv or less, zero at 1.4 Sv. Every "
            "conjunction-class mission exceeds NASA's 0.6 Sv career limit, so the scale "
            "ranks the doses real missions reach.",
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
