"""In-flight events: GAMEPLAY MODEL.

Mirror of ``frontend/src/physics/events.js``.

Seeded, reproducible events along the mission timeline: solar particle
events, engine faults at burns, micrometeoroid strikes and comms blackouts.
Same seed + same mission → identical events.

Gameplay model means: the event ODDS are illustrative, chosen so a typical
mission sees a handful of events, and they scale with the risk-tolerance
slider (risk 1 → ×0.5, risk 10 → ×2.0). They are NOT reliability data. The
MAGNITUDES are grounded where a source exists (see each type below).

Determinism contract (shared with the JS engine), RNG = mulberry32(seed):
  1. TMI burn (day 0): one draw for an engine fault; if it fires, one more
     draw for its magnitude.
  2. Outbound cruise, for each whole day d = 0 … floor(outboundDays) − 1, for
     each cruise type in order [solar-particle-event, micrometeoroid,
     comms-blackout]: one draw; if it fires, one magnitude draw.
  3. Mars capture burn (propulsive capture only), day = outboundDays: same as
     step 1.
  4. Surface stay, each whole day: [comms-blackout] only.
  5. Return cruise, each whole day: same types as step 2.
  An event fires when draw < baseOdds × riskFactor(risk).

SI units: Sv, m/s, kg, days for event timing (day counted from TMI).
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from types import MappingProxyType

from .constants import DAY
from .jscompat import RangeError
from .rng import create_rng, validate_seed

MSV = 1e-3  # Sv

#: Event types. baseOdds are per day (cruise/surface types) or per burn
#: (engine-fault) at risk factor 1.
EVENT_TYPES: Mapping[str, Mapping] = MappingProxyType(
    {
        "solar-particle-event": MappingProxyType(
            {
                "label": "Solar particle event",
                "phases": ("outbound", "return"),
                # GAMEPLAY ODDS, grounded: Curiosity/RAD recorded 5 significant SPEs in
                # ≈ 221 days of cruise near solar maximum (2011-12), ≈ 0.023/day.
                # Halved as a rough solar-cycle average (ESTIMATE).
                "baseOdds": 0.01,
                # Dose equivalent per event: uniform 1.2-19.5 mSv, the range of per-event
                # values RAD measured behind MSL cruise-stage shielding (Hassler, NOAA
                # Space Weather Workshop 2016; Zeitlin et al., Science 340, 2013). The
                # 1.84 mSv/day cruise rate is GCR only, so this does not double count.
                # A dedicated storm shelter would lower these; extreme events such as
                # August 1972 are not represented. Surface SPEs are not modelled: Mars'
                # atmosphere attenuates them strongly.
                "doseRange": (1.2 * MSV, 19.5 * MSV),
            }
        ),
        "engine-fault": MappingProxyType(
            {
                "label": "Engine fault during burn",
                "phases": ("burn",),
                "baseOdds": 0.03,  # GAMEPLAY ODDS per burn
                # GAMEPLAY MAGNITUDE: the fault costs 1-5 % of that burn's Δv (restart,
                # off-nominal thrust, gravity losses), comparable to the 2-12 % Δv
                # reserve, so risk tolerance matters. If the total penalty exceeds the
                # reserve carried, the mission aborts.
                "penaltyFractionRange": (0.01, 0.05),
            }
        ),
        "micrometeoroid": MappingProxyType(
            {
                "label": "Micrometeoroid strike",
                "phases": ("outbound", "return"),
                "baseOdds": 0.001,  # GAMEPLAY ODDS per day (a strike that needs a repair)
                # GAMEPLAY MAGNITUDE: 10-100 kg of consumables lost (e.g. a punctured
                # water line), drawn from the 30-day contingency reserve.
                "consumablesLossRange": (10, 100),
            }
        ),
        "comms-blackout": MappingProxyType(
            {
                "label": "Communications blackout",
                "phases": ("outbound", "surface", "return"),
                "baseOdds": 0.002,  # GAMEPLAY ODDS per day
                # Grounded magnitude: Mars missions observe a ≈ 2-week command moratorium
                # around solar conjunction (NASA/JPL); blackouts last 1-14 days.
                "outageDaysRange": (1, 14),
            }
        ),
    }
)

_CRUISE_ORDER = ("solar-particle-event", "micrometeoroid", "comms-blackout")
_SURFACE_ORDER = ("comms-blackout",)


def risk_factor(risk_tolerance: float) -> float:
    """Multiplier on event odds from the 1-10 risk slider: 0.5 at 1, 2.0 at 10.

    GAMEPLAY: aggressive plans accept more exposure (fewer conservative holds,
    thinner maintenance margins).
    """
    if (
        isinstance(risk_tolerance, bool)
        or not isinstance(risk_tolerance, (int, float))
        or not (risk_tolerance >= 1 and risk_tolerance <= 10)
    ):
        raise RangeError(f"riskTolerance must be a number 1–10 (got {risk_tolerance})")
    return 0.5 + (1.5 * (risk_tolerance - 1)) / 9


def _no_effects() -> dict:
    return {"extraDose": 0, "deltaVPenalty": 0, "consumablesLossKg": 0, "commsOutageDays": 0}


def schedule_events(
    *,
    seed: int,
    risk_tolerance: float,
    outbound_time: float,
    surface_time: float,
    return_time: float,
    burns: Sequence[Mapping],
) -> list[dict]:
    """Schedule events along the mission timeline (see the determinism contract above).

    ``burns`` are the propulsive burns in order ({id, label, deltaV}); 'tmi'
    happens at day 0 and 'capture' at arrival. Each event is
    {id, type, label, phase, burn, day, model, effects, description}.
    """
    validate_seed(seed)
    factor = risk_factor(risk_tolerance)
    rng = create_rng(seed)
    events: list[dict] = []
    t_ = EVENT_TYPES

    def push(etype, phase, day, effects, description, burn=None):
        events.append(
            {
                "id": f"{etype}-{len(events) + 1}",
                "type": etype,
                "label": t_[etype]["label"],
                "phase": phase,
                "burn": burn,
                "day": day,
                "model": "gameplay",
                "effects": {**_no_effects(), **effects},
                "description": description,
            }
        )

    def burn_check(burn, day):
        t = t_["engine-fault"]
        if rng.next() < t["baseOdds"] * factor:
            fraction = rng.uniform(t["penaltyFractionRange"][0], t["penaltyFractionRange"][1])
            penalty = fraction * burn["deltaV"]
            push(
                "engine-fault",
                "burn",
                day,
                {"deltaVPenalty": penalty},
                f"{burn['label']}: engine fault; extra Δv needed to complete the burn.",
                burn["id"],
            )

    def day_check(etype, phase, day):
        t = t_[etype]
        if not (rng.next() < t["baseOdds"] * factor):
            return
        if etype == "solar-particle-event":
            dose = rng.uniform(t["doseRange"][0], t["doseRange"][1])
            push(
                etype,
                phase,
                day,
                {"extraDose": dose},
                "Solar particle event: crew moves to the storm shelter; extra radiation dose.",
            )
        elif etype == "micrometeoroid":
            kg = rng.uniform(t["consumablesLossRange"][0], t["consumablesLossRange"][1])
            push(
                etype,
                phase,
                day,
                {"consumablesLossKg": kg},
                "Micrometeoroid strike: hull repaired; some consumables lost.",
            )
        else:
            days = rng.int(t["outageDaysRange"][0], t["outageDaysRange"][1])
            push(
                etype,
                phase,
                day,
                {"commsOutageDays": days},
                "Communications blackout: the crew works autonomously until contact returns.",
            )

    outbound_days = outbound_time / DAY
    surface_days = surface_time / DAY
    return_days = return_time / DAY
    tmi = next((b for b in burns if b["id"] == "tmi"), None)
    capture = next((b for b in burns if b["id"] == "capture"), None)

    if tmi:
        burn_check(tmi, 0)
    for d in range(math.floor(outbound_days)):
        for etype in _CRUISE_ORDER:
            day_check(etype, "outbound", d)
    if capture:
        burn_check(capture, outbound_days)
    for d in range(math.floor(surface_days)):
        for etype in _SURFACE_ORDER:
            day_check(etype, "surface", outbound_days + d)
    for d in range(math.floor(return_days)):
        for etype in _CRUISE_ORDER:
            day_check(etype, "return", outbound_days + surface_days + d)
    return events


def summarize_events(events: Sequence[Mapping], *, delta_v_reserve: float) -> dict:
    """Total the effects of a list of events and decide whether the Δv reserve survives.

    ``delta_v_reserve`` is the Δv carried beyond the requirement [m/s]
    (planned − required).
    """
    by_type = {k: 0 for k in EVENT_TYPES}
    extra_dose = 0
    delta_v_penalty = 0
    consumables_loss_kg = 0
    comms_outage_days = 0
    for e in events:
        by_type[e["type"]] += 1
        extra_dose += e["effects"]["extraDose"]
        delta_v_penalty += e["effects"]["deltaVPenalty"]
        consumables_loss_kg += e["effects"]["consumablesLossKg"]
        comms_outage_days += e["effects"]["commsOutageDays"]
    delta_v_reserve_after = delta_v_reserve - delta_v_penalty
    abort = delta_v_reserve_after < 0
    return {
        "count": len(events),
        "byType": by_type,
        "extraDose": extra_dose,
        "deltaVPenalty": delta_v_penalty,
        "consumablesLossKg": consumables_loss_kg,
        "commsOutageDays": comms_outage_days,
        "deltaVReserveAfter": delta_v_reserve_after,
        "abort": abort,
        "abortReason": (
            "Engine faults used more Δv than the reserve carried: abort (gameplay model)."
            if abort
            else None
        ),
    }
