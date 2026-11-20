"""Life-support consumables: food, water and oxygen per crew member per day,
scaled by crew size and by mission phase (outbound cruise, surface stay,
return cruise), with and without recycling.

Mirror of ``frontend/src/physics/lifeSupport.js``.

Per-person rates come from the NASA Life Support Baseline Values and
Assumptions Document (BVAD), NASA/TP-2015-218570/REV2 (February 2022):
  - Oxygen: Table 3-31 "Summary of Nominal Human Metabolic Interface
    Values", Oxygen Consumed = 0.895 kg/CM-d (82 kg reference crew member
    exercising daily on a long mission).
  - Water: Table 4-20 "Typical Steady-State Water Usage Rates for Various
    Missions", Total Water Consumption = 3.2 kg/CM-d for a Transit Vehicle
    (2.0 drinking + 0.5 food rehydration + 0.7 hygiene/flush) and
    4.48 kg/CM-d for an Early Planetary Base (adds a 1.08 kg/CM-d shower and
    more flush water). Medical water (Table 4-20: 0.5 kg/CM-d + 5 kg) is not
    included.
  - Food: 2.39 kg/CM-d of individually packaged food, the ISS food supply
    planning value including packaging (BVAD Rev2 text under Table 3-31,
    citing Table 4-47 and Ewert et al. 2019).

Recycling (ASSUMPTION, adjustable):
  - Water recovery 93 %: the ISS ECLSS total water recovery before the Brine
    Processor Assembly was 93-94 %; NASA reported 98 % demonstrated with the
    BPA in 2023 ("NASA Achieves Water Recovery Milestone on International
    Space Station", NASA, 2023). 93 % is used as the sustained, conservative
    value for a multi-year mission.
  - Oxygen recovery 50 %: Sabatier-based CO₂ reduction on ISS is limited to
    ≈ 50 % O₂ recovery because half of the hydrogen leaves as methane (NASA
    Exploration ECLSS overviews, e.g. ICES-2021-384).
  - Food is never recycled (no crop growth modelled).
Closed-loop mass = food + water × (1 − water closure) + O₂ × (1 − O₂ closure).
The mass of the recycling hardware and its spares is part of the habitat
allowance in mission.py, not counted here.

SI units: kg, s. "CM-d" = crew-member-day.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from types import MappingProxyType

from .constants import DAY
from .jscompat import RangeError

#: Per-crew-member daily rates [kg/CM-d]. See module docstring for table references.
BVAD_RATES = MappingProxyType(
    {
        "oxygen": 0.895,  # BVAD Rev2 Table 3-31
        "waterTransit": 3.2,  # BVAD Rev2 Table 4-20, Transit Vehicle column
        "waterSurface": 4.48,  # BVAD Rev2 Table 4-20, Early Planetary Base column
        "food": 2.39,  # BVAD Rev2 §3.3 text under Table 3-31 / Table 4-47 (ISS, with packaging)
    }
)

#: Default recycling closure fractions (ASSUMPTION, see module docstring).
DEFAULT_CLOSURE = MappingProxyType({"water": 0.93, "oxygen": 0.5})

#: Crew sizes supported by the life-support and mission model.
LIFE_SUPPORT_CREW_RANGE = MappingProxyType({"min": 2, "max": 8})

#: Days of extra consumables carried beyond the planned mission (ASSUMPTION, planning reserve).
CONTINGENCY_DAYS = 30


def _validate_crew(crew_size) -> None:
    lo, hi = LIFE_SUPPORT_CREW_RANGE["min"], LIFE_SUPPORT_CREW_RANGE["max"]
    if isinstance(crew_size, bool) or not isinstance(crew_size, int) or not lo <= crew_size <= hi:
        raise RangeError(f"crewSize must be an integer {lo}–{hi} (got {crew_size})")


def _validate_closure(closure: Mapping) -> None:
    for k in ("water", "oxygen"):
        v = closure.get(k)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (v >= 0 and v < 1):
            raise RangeError(f"closure.{k} must be in [0, 1) (got {v})")


def daily_consumables(environment: str, closure: Mapping = DEFAULT_CLOSURE) -> dict:
    """Daily consumables for one crew member in 'transit' or 'surface' [kg/CM-d].

    food/water/oxygen are open-loop demands; closedLoop is the resupply mass
    after recycling.
    """
    if environment not in ("transit", "surface"):
        raise TypeError("environment must be 'transit' or 'surface'")
    _validate_closure(closure)
    food = BVAD_RATES["food"]
    water = BVAD_RATES["waterTransit"] if environment == "transit" else BVAD_RATES["waterSurface"]
    oxygen = BVAD_RATES["oxygen"]
    return {
        "food": food,
        "water": water,
        "oxygen": oxygen,
        "openLoop": food + water + oxygen,
        "closedLoop": food + water * (1 - closure["water"]) + oxygen * (1 - closure["oxygen"]),
    }


def _phase_mass(crew_size: int, days: float, environment: str, closure: Mapping) -> dict:
    """Consumables for one mission phase."""
    d = daily_consumables(environment, closure)
    cmd = crew_size * days
    return {
        "days": days,
        "crewDays": cmd,
        "food": d["food"] * cmd,
        "water": d["water"] * cmd,
        "oxygen": d["oxygen"] * cmd,
        "openLoop": d["openLoop"] * cmd,
        "closedLoop": d["closedLoop"] * cmd,
    }


def life_support_mass(
    *,
    crew_size: int,
    outbound_time: float,
    surface_time: float = 0,
    return_time: float = 0,
    closure: Mapping = DEFAULT_CLOSURE,
) -> dict:
    """Life-support consumables for a whole conjunction-class mission [kg].

    The outbound phase includes CONTINGENCY_DAYS of reserve. Masses are
    linear in crew size and in each phase's length. Times in seconds; each
    phase object has days, crewDays, food, water, oxygen, openLoop, closedLoop.
    """
    _validate_crew(crew_size)
    _validate_closure(closure)
    for k, v in (
        ("outboundTime", outbound_time),
        ("surfaceTime", surface_time),
        ("returnTime", return_time),
    ):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0:
            raise RangeError(f"{k} must be a non-negative finite number of seconds")
    outbound = _phase_mass(crew_size, outbound_time / DAY + CONTINGENCY_DAYS, "transit", closure)
    surface = _phase_mass(crew_size, surface_time / DAY, "surface", closure)
    ret = _phase_mass(crew_size, return_time / DAY, "transit", closure)

    def total(k: str) -> float:
        return outbound[k] + surface[k] + ret[k]

    return {
        "crewSize": crew_size,
        "closure": {"water": closure["water"], "oxygen": closure["oxygen"]},
        "contingencyDays": CONTINGENCY_DAYS,
        "ratesPerCrewDay": {
            "transit": daily_consumables("transit", closure),
            "surface": daily_consumables("surface", closure),
        },
        "outbound": outbound,
        "surface": surface,
        "return": ret,
        "total": {k: total(k) for k in ("food", "water", "oxygen", "openLoop", "closedLoop")},
    }
