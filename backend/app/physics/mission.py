"""Mission model: flies one in-space stage, lifted to LEO by a chosen launch
vehicle, from LEO to Mars in a real launch window, and reports transit time,
Δv, propellant, launches, cost, radiation, life support, success factors,
seeded gameplay events and a score.

Mirror of ``frontend/src/physics/mission.js`` (the JS engine is the source of
truth; ``shared/golden_cases.json`` pins both to rel 1e-9).

What is modelled with physics:
  - Launch-window phasing on Mars' real eccentric orbit (ephemeris.py, windows.py)
  - Heliocentric transfer: minimum-energy, or faster tangential-departure
    transfers that trade Δv for time (orbits.py)
  - Patched-conic burns: Earth departure from 400 km LEO, then Mars capture
    into the DRA 5.0 1-sol ellipse (or aerocapture with an entry-speed cap)
  - Propellant via the rocket equation, and launch counts (rocket.py)
  - Radiation dose from measured Curiosity/RAD dose rates × time
  - Life-support consumables from NASA BVAD rates (life_support.py)

What is a documented HEURISTIC or GAMEPLAY model, not rigorous engineering:
  - success probability and its factors (success.py)
  - crewHealthIndex: illustrative 0-100 score from dose and zero-g time
  - in-flight events (events.py) and the score (scoring.py)

Scope: the propulsive model covers the crewed outbound leg. The return leg is
assumed to be a mirror-image transfer. It counts toward mission duration,
radiation dose and life support, but its propulsion is not sized: as in NASA
DRA 5.0, the return vehicle/propellant is assumed pre-deployed or made on
Mars (ISRU).

Inputs and outputs are SI (m, s, kg, m/s, Sv, USD). Output dates are ISO 8601
strings and keys are camelCase, so the result is the same plain JSON the JS
engine returns (schemaVersion 3).
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from datetime import datetime
from types import MappingProxyType

from .constants import (
    CAREER_DOSE_LIMIT,
    DAY,
    GCR_CRUISE_DOSE_RATE,
    LEO_ALTITUDE,
    MARS_CAPTURE_APOAPSIS_ALTITUDE,
    MARS_CAPTURE_PERIAPSIS_ALTITUDE,
    MARS_ENTRY_INTERFACE_ALTITUDE,
    MARS_SURFACE_DOSE_RATE,
    MU_EARTH,
    MU_MARS,
    R_EARTH,
    R_MARS,
)
from .ephemeris import conjunction_stay_time, solve_transfer_window
from .events import schedule_events, summarize_events
from .jscompat import RangeError, iso_from_ms, ms_from_iso, ms_from_utc, to_fixed
from .launch_vehicles import get_launch_vehicle, launch_compatibility
from .life_support import (
    CONTINGENCY_DAYS,
    DEFAULT_CLOSURE,
    LIFE_SUPPORT_CREW_RANGE,
    daily_consumables,
    life_support_mass,
)
from .orbits import (
    capture_burn_delta_v,
    departure_burn_delta_v,
    max_v_inf_for_entry_speed,
    transfer_arc_length,
)
from .rng import validate_seed
from .rocket import launches_required, max_delta_v, propellant_for_delta_v
from .scoring import score_mission
from .success import success_estimate
from .vehicles import VEHICLES
from .windows import BEST_WINDOW_ID, DEFAULT_WINDOW_ID, get_window

#: Output format version (bump when keys change; must equal the JS MISSION_SCHEMA_VERSION).
MISSION_SCHEMA_VERSION = 3

#: Plain-language note for missions whose dose exceeds the 600 mSv career
#: limit (NASA-STD-3001). With the measured RAD dose rates, every
#: conjunction-class mission with MSL-like shielding exceeds it: the two cruise
#: legs alone give ≈ 0.4-1.0 Sv and the surface stay ≈ 0.25-0.5 Sv more.
CAREER_LIMIT_NOTE = (
    "NASA's career limit is 600 mSv (NASA-STD-3001). Every conjunction-class Mars mission "
    "with today's shielding exceeds it: the two cruise legs and the long surface stay "
    "together give about 0.8–1.3 Sv. A crewed Mars mission would need much better "
    "shielding, a much shorter trip, or an exception to the standard."
)


def _format_usd(usd: float) -> str:
    """Format a launch price for framing notes: '$2.2 B' or '$150 M'."""
    return f"${to_fixed(usd / 1e9, 1)} B" if usd >= 1e9 else f"${to_fixed(usd / 1e6, 0)} M"


def mission_framing(vehicle: Mapping, launch_vehicle: Mapping, dose: Mapping) -> list[dict]:
    """Framing notes the UI can show next to the numbers, as ``[{id, text}]``.

    ``launcher-cost`` (which launcher the costs assume), ``capture-method``
    (propulsive vs aerocapture is an architecture choice) and, only if
    exceeded, ``career-limit``.
    """
    if vehicle["launchMode"] == "tanker":
        fly = "This stage can only fly on its own launcher."
    else:
        fly = "This stage can fly on any launcher, and the launch cost changes with that choice."
    if vehicle["marsCapture"] == "aerocapture":
        capture = (
            "Stops at Mars by aerocapture (heat shield, no braking burn); the entry-speed "
            "limit caps how fast it can arrive."
        )
    else:
        capture = (
            "Stops at Mars with an engine burn. That is an architecture choice: NASA's DRA 5.0 "
            "also studied aerocapture for the chemical option, which would remove most of "
            "that burn."
        )
    notes = [
        {
            "id": "launcher-cost",
            "text": f"Costs shown with {launch_vehicle['name']} at "
            f"{_format_usd(launch_vehicle['costPerLaunchUsd'])} per launch. {fly}",
        },
        {"id": "capture-method", "text": capture},
    ]
    if dose["exceedsCareerLimit"]:
        notes.append({"id": "career-limit", "text": CAREER_LIMIT_NOTE})
    return notes


# ── Common crew payload (identical for every vehicle) ──────────────────────

#: Crew payload assumptions (ESTIMATES), cross-checked against the DRA 5.0
#: transit habitat (≈ 40 t class for 6 crew → 15 t + 4.5 t/crew = 42 t at 6).
#: The habitat allowance includes life-support hardware and spares.
#: Consumables come from life_support.py (NASA BVAD rates with recycling):
#: outbound transit + CONTINGENCY_DAYS. The surface and return consumables are
#: reported in ``lifeSupport`` but assumed pre-deployed with the return vehicle
#: (DRA 5.0), so they are not carried by the outbound stage.
CREW_PAYLOAD = MappingProxyType(
    {
        "habitatBaseMass": 15_000,  # kg
        "habitatMassPerCrew": 4_500,  # kg/person
        "crewMassPerPerson": 100,  # kg/person (body + personal kit)
        # extra days of consumables carried on the outbound leg
        "contingencyDays": CONTINGENCY_DAYS,
    }
)

#: Closed-loop transit consumables per crew-day with default recycling [kg] (for display).
CONSUMABLES_PER_CREW_DAY = daily_consumables("transit", DEFAULT_CLOSURE)["closedLoop"]

#: Allowed crew sizes (integer 2-8, the range BVAD-based life support is scaled for).
CREW_SIZE_RANGE = LIFE_SUPPORT_CREW_RANGE

TRANSFER_KINDS = ("fastest", "hohmann", "timeOfFlight")


def crew_payload_mass(
    *,
    crew_size: int,
    transit_time: float,
    habitat_mass: float | None = None,
    closure: Mapping = DEFAULT_CLOSURE,
) -> dict:
    """Crew payload mass for the outbound leg: {habitat, crew, consumables, total} [kg]."""
    _validate_crew_size(crew_size)
    if not (transit_time > 0):
        raise RangeError("transitTime must be positive")
    p = CREW_PAYLOAD
    habitat = (
        habitat_mass
        if habitat_mass is not None
        else p["habitatBaseMass"] + p["habitatMassPerCrew"] * crew_size
    )
    if not (habitat > 0):
        raise RangeError("habitatMass must be positive")
    crew = p["crewMassPerPerson"] * crew_size
    consumables = life_support_mass(
        crew_size=crew_size, outbound_time=transit_time, closure=closure
    )["outbound"]["closedLoop"]
    return {
        "habitat": habitat,
        "crew": crew,
        "consumables": consumables,
        "total": habitat + crew + consumables,
    }


def delta_v_margin(risk_tolerance: float) -> float:
    """Δv margin (reserve) from the 1-10 risk-tolerance slider.

    12% of the planned Δv at 1 (conservative) down to 2% at 10 (aggressive).
    Typical mission design carries a few percent to ~10%, so this spans that
    range. Returns a fraction, e.g. 0.07 means +7%.
    """
    _validate_risk(risk_tolerance)
    return 0.12 - ((risk_tolerance - 1) / 9) * 0.1


def crew_health_index(*, mission_dose: float, microgravity_time: float) -> float:
    """Illustrative crew-health index (0-100). NOT a medical model.

    100 − 25 × (mission dose / 600 mSv career limit) − 1 × (months in zero-g).
    It only shows the direction of two real effects: radiation (cancer risk)
    and weightlessness (bone and muscle loss; LeBlanc et al., J. Musculoskelet.
    Neuronal Interact. 1(2):157-160, 2000, measured ≈ 1.0-1.6 % per month hip
    bone-density loss on long Mir flights). The UI does not show a bone-loss
    percentage.
    """
    months = microgravity_time / (30.44 * DAY)
    score = 100 - 25 * (mission_dose / CAREER_DOSE_LIMIT) - months
    return min(100, max(0, score))


# ── Validation ─────────────────────────────────────────────────────────────


def _validate_crew_size(crew_size) -> None:
    lo, hi = CREW_SIZE_RANGE["min"], CREW_SIZE_RANGE["max"]
    if isinstance(crew_size, bool) or not isinstance(crew_size, int) or not lo <= crew_size <= hi:
        raise RangeError(f"crewSize must be an integer {lo}–{hi} (got {crew_size})")


def _validate_risk(risk) -> None:
    if isinstance(risk, bool) or not isinstance(risk, (int, float)) or not (1 <= risk <= 10):
        raise RangeError(f"riskTolerance must be a number 1–10 (got {risk})")


def _resolve_vehicle(vehicle) -> Mapping:
    v = VEHICLES.get(vehicle) if isinstance(vehicle, str) else vehicle
    if not v or not isinstance(v.get("isp"), (int, float)):
        raise TypeError(f"Unknown vehicle: {vehicle}")
    return v


def _resolve_launch(window_id, launch_date, launch_year) -> tuple[int, str | None]:
    """Date to search from: windowId, then launchDate, then launchYear, then the default."""
    if window_id is not None:
        w = get_window(window_id)
        return ms_from_iso(w["departureDate"]), w["id"]
    if launch_date is not None:
        if not isinstance(launch_date, datetime) or launch_date.tzinfo is None:
            raise TypeError("launchDate must be a valid timezone-aware datetime")
        return int(launch_date.timestamp() * 1000), None
    if launch_year is not None:
        if (
            isinstance(launch_year, bool)
            or not isinstance(launch_year, int)
            or not 1900 <= launch_year <= 2100
        ):
            raise RangeError(
                "launchYear must be an integer 1900–2100 (orbital elements are valid ~1800–2050)"
            )
        return ms_from_utc(launch_year, 6, 1), None
    w = get_window(DEFAULT_WINDOW_ID)
    return ms_from_iso(w["departureDate"]), w["id"]


# ── The simulation ─────────────────────────────────────────────────────────


def simulate_mission(
    *,
    vehicle,
    launch_vehicle: str | None = None,
    crew_size: int = 4,
    window_id: str | None = None,
    launch_date: datetime | None = None,
    launch_year: int | None = None,
    transfer_choice: Mapping | None = None,
    risk_tolerance: float = 5,
    habitat_mass: float | None = None,
    seed: int | None = None,
    closure: Mapping = DEFAULT_CLOSURE,
) -> dict:
    """Simulate a crewed Earth→Mars mission for one in-space stage.

    Arguments mirror the JS ``simulateMission`` options (snake_case):
      vehicle          stage id ('chemical' | 'nuclear' | 'starship') or a vehicle mapping
      launch_vehicle   launch-vehicle id; defaults to the stage's defaultLaunchVehicle
      crew_size        integer 2-8
      window_id        fixed window id (e.g. '2028-12'); takes precedence over dates
      launch_date      aware datetime near the desired window (closest within ±390 days)
      launch_year      alternative to launch_date: 1 July of that year
      transfer_choice  {'kind': 'fastest'} (default) | {'kind': 'hohmann'} |
                       {'kind': 'timeOfFlight', 'timeOfFlight': seconds}
      risk_tolerance   1 (conservative, 12% Δv margin) … 10 (aggressive, 2%)
      habitat_mass     override the common habitat mass [kg] (custom builds)
      seed             uint32 for gameplay events; None = nominal flight, no events
      closure          life-support recycling closure (default ISS-class)

    Returns the MissionResult dict (camelCase keys, schemaVersion 3). Raises
    RangeError for out-of-range inputs or a launch vehicle that cannot lift
    this stage, TypeError for unknown ids.
    """
    if transfer_choice is None:
        transfer_choice = {"kind": "fastest"}
    v = _resolve_vehicle(vehicle)
    _validate_crew_size(crew_size)
    _validate_risk(risk_tolerance)
    if seed is not None:
        validate_seed(seed)
    launch_vehicle_id = launch_vehicle if launch_vehicle is not None else v["defaultLaunchVehicle"]
    lv = get_launch_vehicle(launch_vehicle_id)
    compat = launch_compatibility(v, launch_vehicle_id)
    if not compat["ok"]:
        raise RangeError(compat["reason"])
    near_date, resolved_window_id = _resolve_launch(window_id, launch_date, launch_year)
    kind = transfer_choice.get("kind") if transfer_choice else None
    if kind not in TRANSFER_KINDS:
        raise TypeError("transferChoice.kind must be 'fastest', 'hohmann' or 'timeOfFlight'")
    if kind == "timeOfFlight":
        tof_req = transfer_choice.get("timeOfFlight")
        if isinstance(tof_req, bool) or not isinstance(tof_req, (int, float)) or not tof_req > 0:
            raise RangeError("transferChoice.timeOfFlight must be a positive number of seconds")

    margin = delta_v_margin(risk_tolerance)
    r_leo = R_EARTH + LEO_ALTITUDE
    r_cap_peri = R_MARS + MARS_CAPTURE_PERIAPSIS_ALTITUDE
    r_cap_apo = R_MARS + MARS_CAPTURE_APOAPSIS_ALTITUDE
    max_arrival_v_inf = (
        max_v_inf_for_entry_speed(
            v["maxEntrySpeed"], MU_MARS, R_MARS + MARS_ENTRY_INTERFACE_ALTITUDE
        )
        if v["marsCapture"] == "aerocapture"
        else math.inf
    )

    def evaluate(spec: Mapping, near: int) -> dict | None:
        """Size the vehicle for one transfer; None if the geometry is impossible."""
        try:
            w = solve_transfer_window(transfer=spec, near_date=near)
        except RangeError:
            return None
        departure = departure_burn_delta_v(w["vInfDeparture"], MU_EARTH, r_leo)
        capture = (
            capture_burn_delta_v(w["vInfArrival"], MU_MARS, r_cap_peri, r_cap_apo)
            if v["marsCapture"] == "propulsive"
            else 0
        )
        total = departure + capture
        planned = total * (1 + margin)
        payload = crew_payload_mass(
            crew_size=crew_size,
            transit_time=w["timeOfFlight"],
            habitat_mass=habitat_mass,
            closure=closure,
        )
        dry = v["stageDryMass"] + payload["total"]
        propellant = propellant_for_delta_v(planned, dry, v["isp"])
        capability = max_delta_v(v["isp"], dry, v["propellantCapacity"])
        reason = None
        if w["vInfArrival"] > max_arrival_v_inf:
            reason = (
                f"Arrival v∞ {to_fixed(w['vInfArrival'] / 1000, 2)} km/s exceeds the "
                f"{to_fixed(max_arrival_v_inf / 1000, 2)} km/s aerocapture limit"
            )
        elif propellant > v["propellantCapacity"]:
            reason = (
                f"Needs {to_fixed(propellant / 1000, 0)} t of propellant; tanks hold "
                f"{to_fixed(v['propellantCapacity'] / 1000, 0)} t"
            )
        return {
            "w": w,
            "departure": departure,
            "capture": capture,
            "total": total,
            "planned": planned,
            "payload": payload,
            "dry": dry,
            "propellant": propellant,
            "capability": capability,
            "reason": reason,
        }

    ctx = {
        "vehicle": v,
        "launchVehicle": lv,
        "transferChoice": transfer_choice,
        "crewSize": crew_size,
        "riskTolerance": risk_tolerance,
        "seed": seed,
        "windowId": resolved_window_id,
        "margin": margin,
        "habitatMass": habitat_mass,
        "closure": closure,
    }

    # The minimum-energy transfer anchors the window and serves as a reference.
    hohmann = evaluate({"kind": "hohmann"}, near_date)
    if not hohmann:
        raise RangeError("Could not solve the launch window for this date")
    window_date = hohmann["w"]["departureDate"]

    if kind == "hohmann":
        chosen = hohmann
    elif kind == "timeOfFlight":
        tof_req = transfer_choice["timeOfFlight"]
        chosen = evaluate({"kind": "timeOfFlight", "timeOfFlight": tof_req}, window_date)
        if not chosen:
            return _infeasible_result(
                ctx,
                hohmann,
                f"A {to_fixed(tof_req / DAY, 0)}-day transfer is outside the range this model "
                "can fly in this window (must be faster than the "
                f"{to_fixed(hohmann['w']['timeOfFlight'] / DAY, 0)}-day minimum-energy transfer)",
            )
    elif hohmann["reason"]:
        # 'fastest' when even the minimum-energy transfer does not fit.
        chosen = hohmann
    else:
        # 'fastest': bisection on transit time between a near-parabolic floor and Hohmann.
        hi = hohmann["w"]["timeOfFlight"]  # known feasible
        lo = 60 * DAY  # faster than any feasible design here
        best = hohmann
        i = 0
        while i < 40 and hi - lo > 0.01 * DAY:
            mid = (lo + hi) / 2
            trial = evaluate({"kind": "timeOfFlight", "timeOfFlight": mid}, window_date)
            if trial and not trial["reason"]:
                best = trial
                hi = mid
            else:
                lo = mid
            i += 1
        chosen = best
    if chosen["reason"]:
        return _infeasible_result(ctx, hohmann, chosen["reason"], chosen)

    return _build_result(ctx, chosen, hohmann)


def _launch_count(
    vehicle: Mapping, launch_vehicle: Mapping, initial_mass_in_leo: float, propellant: float
) -> int:
    """Launch count for a stack.

    assembled: ceil(mass in LEO / launcher payload)
    tanker:    1 (the crewed ship) + ceil(propellant / propellant per tanker)
    """
    if vehicle["launchMode"] == "tanker":
        return 1 + launches_required(propellant, launch_vehicle["payloadLeoKg"])
    return launches_required(initial_mass_in_leo, launch_vehicle["payloadLeoKg"])


def _vehicle_summary(v: Mapping) -> dict:
    keys = (
        "id",
        "name",
        "isp",
        "stageDryMass",
        "propellantCapacity",
        "marsCapture",
        "gcrShieldingFactor",
        "launchMode",
        "trl",
        "hardwareCost",
    )
    return {k: v[k] for k in keys}


def _launch_vehicle_summary(lv: Mapping) -> dict:
    keys = (
        "id",
        "name",
        "payloadLeoKg",
        "costPerLaunchUsd",
        "status",
        "reliabilityClass",
        "launchReliability",
    )
    return {k: lv[k] for k in keys}


def _transfer_summary(tc: Mapping) -> dict:
    if tc["kind"] == "timeOfFlight":
        return {"kind": "timeOfFlight", "timeOfFlight": tc["timeOfFlight"]}
    return {"kind": tc["kind"]}


def _inputs_summary(ctx: Mapping) -> dict:
    return {
        "vehicleId": ctx["vehicle"]["id"],
        "launchVehicleId": ctx["launchVehicle"]["id"],
        "crewSize": ctx["crewSize"],
        "riskTolerance": ctx["riskTolerance"],
        "windowId": ctx["windowId"],
        "seed": ctx["seed"],
        "transferChoice": _transfer_summary(ctx["transferChoice"]),
        "habitatMass": ctx["habitatMass"],
        "closure": {"water": ctx["closure"]["water"], "oxygen": ctx["closure"]["oxygen"]},
    }


def _build_result(ctx: Mapping, chosen: Mapping, hohmann: Mapping) -> dict:
    vehicle = ctx["vehicle"]
    lv = ctx["launchVehicle"]
    crew_size = ctx["crewSize"]
    seed = ctx["seed"]
    margin = ctx["margin"]
    closure = ctx["closure"]
    w = chosen["w"]
    path_length = transfer_arc_length(w)
    initial_mass_in_leo = chosen["dry"] + chosen["propellant"]
    launches = _launch_count(vehicle, lv, initial_mass_in_leo, chosen["propellant"])
    launch_cost = launches * lv["costPerLaunchUsd"]

    outbound = w["timeOfFlight"]
    surface_stay = conjunction_stay_time(transfer_angle=w["transferAngle"], time_of_flight=outbound)
    return_time = outbound  # mirror-image return leg
    total_duration = outbound + surface_stay + return_time

    success = success_estimate(vehicle=vehicle, launch_vehicle=lv, launches=launches, margin=margin)
    recoverable = success["recoverable"]

    # Gameplay events (only with a seed). The Δv reserve is the margin carried
    # beyond the required Δv.
    burns = [{"id": "tmi", "label": "Trans-Mars injection", "deltaV": chosen["departure"]}]
    if vehicle["marsCapture"] == "propulsive":
        burns.append({"id": "capture", "label": "Mars capture burn", "deltaV": chosen["capture"]})
    events = (
        []
        if seed is None
        else schedule_events(
            seed=seed,
            risk_tolerance=ctx["riskTolerance"],
            outbound_time=outbound,
            surface_time=surface_stay,
            return_time=return_time,
            burns=burns,
        )
    )
    event_summary = summarize_events(events, delta_v_reserve=chosen["planned"] - chosen["total"])

    cruise_rate = GCR_CRUISE_DOSE_RATE * vehicle["gcrShieldingFactor"]
    dose = {
        "outbound": cruise_rate * outbound,
        "surface": MARS_SURFACE_DOSE_RATE * surface_stay,
        "return": cruise_rate * return_time,
        "events": event_summary["extraDose"],
    }
    dose["total"] = dose["outbound"] + dose["surface"] + dose["return"] + dose["events"]
    dose["careerFraction"] = dose["total"] / CAREER_DOSE_LIMIT
    dose["careerLimit"] = CAREER_DOSE_LIMIT
    dose["exceedsCareerLimit"] = dose["total"] > CAREER_DOSE_LIMIT

    result = {
        "schemaVersion": MISSION_SCHEMA_VERSION,
        "inputs": _inputs_summary(ctx),
        "vehicleId": vehicle["id"],
        "launchVehicleId": lv["id"],
        "windowId": ctx["windowId"],
        "vehicle": _vehicle_summary(vehicle),
        "launchVehicle": _launch_vehicle_summary(lv),
        "feasible": True,
        "infeasibleReason": None,
        "transferChoice": _transfer_summary(ctx["transferChoice"]),
        "departureDate": iso_from_ms(w["departureDate"]),
        "arrivalDate": iso_from_ms(w["arrivalDate"]),
        "transitTime": outbound,
        "hohmannTransitTime": hohmann["w"]["timeOfFlight"],
        "transferAngle": w["transferAngle"],
        "pathLength": path_length,
        "averageSpeed": path_length / outbound,
        "vInfDeparture": w["vInfDeparture"],
        "vInfArrival": w["vInfArrival"],
        "deltaV": {
            "departure": chosen["departure"],
            "capture": chosen["capture"],
            "total": chosen["total"],
            "planned": chosen["planned"],
            "capability": chosen["capability"],
            "reserve": chosen["capability"] - chosen["total"],
            "margin": margin,
            "hohmannTotal": hohmann["total"],
        },
        "mass": {
            "habitat": chosen["payload"]["habitat"],
            "crew": chosen["payload"]["crew"],
            "consumables": chosen["payload"]["consumables"],
            "payload": chosen["payload"]["total"],
            "stageDry": vehicle["stageDryMass"],
            "dry": chosen["dry"],
            "propellant": chosen["propellant"],
            "initialMassInLEO": initial_mass_in_leo,
            "hohmannPropellant": hohmann["propellant"],
        },
        "launches": launches,
        "launchPlan": {
            "launchVehicleId": lv["id"],
            "capacityPerLaunch": lv["payloadLeoKg"],
            "crewedLaunches": 1,
            "uncrewedLaunches": launches - 1,
            "expectedReflights": recoverable["expectedReflights"],
            "expectedLaunches": launches + recoverable["expectedReflights"],
            "reflightDelayDays": recoverable["delayDays"],
        },
        "cost": {
            "hardware": vehicle["hardwareCost"],
            "launches": launch_cost,
            "reflightReserve": recoverable["costPenaltyUsd"],
            "total": vehicle["hardwareCost"] + launch_cost + recoverable["costPenaltyUsd"],
        },
        "duration": {
            "outbound": outbound,
            "surfaceStay": surface_stay,
            "return": return_time,
            "total": total_duration,
        },
        "dose": dose,
        "lifeSupport": life_support_mass(
            crew_size=crew_size,
            outbound_time=outbound,
            surface_time=surface_stay,
            return_time=return_time,
            closure=closure,
        ),
        "success": {"probability": success["probability"], "recoverable": recoverable},
        "successFactors": success["factors"],
        "crewHealthIndex": crew_health_index(
            mission_dose=dose["total"], microgravity_time=outbound + return_time
        ),
        "events": events,
        "eventSummary": event_summary,
        "framing": mission_framing(vehicle, lv, dose),
    }
    result["score"] = score_mission(result, {"bestWindowId": BEST_WINDOW_ID})
    return result


def _infeasible_result(
    ctx: Mapping, hohmann: Mapping, reason: str, attempted: Mapping | None = None
) -> dict:
    w = attempted["w"] if attempted else hohmann["w"]
    return {
        "schemaVersion": MISSION_SCHEMA_VERSION,
        "inputs": _inputs_summary(ctx),
        "vehicleId": ctx["vehicle"]["id"],
        "launchVehicleId": ctx["launchVehicle"]["id"],
        "windowId": ctx["windowId"],
        "vehicle": _vehicle_summary(ctx["vehicle"]),
        "launchVehicle": _launch_vehicle_summary(ctx["launchVehicle"]),
        "feasible": False,
        "infeasibleReason": reason,
        "transferChoice": _transfer_summary(ctx["transferChoice"]),
        "departureDate": iso_from_ms(w["departureDate"]),
        "arrivalDate": iso_from_ms(w["arrivalDate"]),
        "transitTime": None,
        "hohmannTransitTime": hohmann["w"]["timeOfFlight"],
        "deltaV": {
            "departure": attempted["departure"],
            "capture": attempted["capture"],
            "total": attempted["total"],
            "capability": attempted["capability"],
        }
        if attempted
        else None,
        "successFactors": [],
        "events": [],
        "score": score_mission(None),
    }
