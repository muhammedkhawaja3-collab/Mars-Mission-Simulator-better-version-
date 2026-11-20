"""In-space propulsion stages for the three reference architectures.

Mirror of ``frontend/src/physics/vehicles.js``.

Every vehicle carries the same crew payload (habitat, crew, consumables),
which mission.py adds on top of ``stageDryMass``. Only the propulsion
differs. All three are fuelled in low Earth orbit (LEO) before departure.

A stage is lifted to LEO by a launch vehicle (launch_vehicles.py):
  - launchMode 'assembled' (chemical, nuclear, custom): the whole stack is
    split across ceil(stack mass / launcher payload) launches of any
    launcher and docked in LEO.
  - launchMode 'tanker' (Starship): the ship launches on Super Heavy with the
    crew payload, then Starship tankers refill it. Only the Starship launcher
    is compatible.

Numbers marked ESTIMATE are not published by any program. They are the
author's engineering estimates, chosen to fall within the range of public
sources, and they move the results.

Fairness rule for the two "assembled in LEO" vehicles: the chemical and
nuclear stages are both sized to the SAME 300 t wet mass, so the comparison
isolates the Isp-vs-dry-mass trade instead of who got the bigger tank.

SI units: kg, s, m/s, USD.

Sources:
  [RL10]  Aerojet Rocketdyne RL10B-2 data sheet: vacuum Isp 465.5 s
          (RL10C-3 ≈ 460 s).
  [DRA5]  NASA-SP-2009-566 and -ADD: NTR crew vehicle with three ~25 klbf
          engines, Isp ≈ 900 s assumed.
  [NERVA] Rover/NERVA ground tests 1955-1972 demonstrated ≈ 825-850 s
          (e.g. Pewee, NRX/XE). No NTR has flown.
  [SPX]   SpaceX Starship page / user's guide: ≈ 1,200 t propellant in the
          ship, Raptor Vacuum Isp ≈ 380 s.
Launch-vehicle figures (payload to LEO, cost per launch) live in
launch_vehicles.py with their own sources.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from types import MappingProxyType

from .jscompat import RangeError

#: Launch settings for stacks assembled in LEO from several launches (any launcher).
_ASSEMBLED = {
    "launchMode": "assembled",
    "defaultLaunchVehicle": "sls-block1",
    "compatibleLaunchVehicles": None,
}


def _freeze(d: dict) -> MappingProxyType:
    return MappingProxyType({k: tuple(v) if isinstance(v, list) else v for k, v in d.items()})


VEHICLES: Mapping[str, Mapping] = MappingProxyType(
    {
        "chemical": _freeze(
            {
                "id": "chemical",
                "name": "Chemical (LH₂/LOX)",
                "engine": "RL10-class expander-cycle LH₂/LOX",
                "isp": 460,  # [RL10]: RL10C-3 ≈ 460 s, RL10B-2 465.5 s
                # ESTIMATE: 10% inert fraction on a 300 t wet stage (Centaur-class
                # stages run ≈ 8-10%), plus engines and long-duration cryo insulation.
                "stageDryMass": 30_000,
                "propellantCapacity": 270_000,  # 300 t wet stage (fairness rule above)
                "marsCapture": "propulsive",
                "gcrShieldingFactor": 1.0,
                **_ASSEMBLED,
                "hardwareCost": 1.0e9,  # ESTIMATE
                "trl": 9,  # engines flight-proven; months-long LH₂ storage is not
                "burnReliability": 0.99,  # heuristic, flight-proven engines
                "operationReliability": 0.995,  # heuristic, ISS-style docking heritage
                "color": "#E24B4A",
                "notes": [
                    "Engines are flight-proven; storing liquid hydrogen for months without "
                    "boil-off is not yet demonstrated."
                ],
            }
        ),
        "nuclear": _freeze(
            {
                "id": "nuclear",
                "name": "Nuclear Thermal (advanced concept, never flown)",
                "engine": "NERVA-derived solid-core NTR, LH₂ propellant",
                # [DRA5] design assumption; [NERVA] demonstrated ≈ 850 s on the ground
                "isp": 900,
                # ESTIMATE: three ~3.5 t engines with internal shields, external
                # shadow shields, and large LH₂ tanks with cryocoolers. LH₂ is only
                # 71 kg/m³, so tankage is heavy. Same 300 t wet mass as chemical.
                "stageDryMass": 70_000,
                "propellantCapacity": 230_000,
                "marsCapture": "propulsive",
                "gcrShieldingFactor": 1.0,  # shadow shields block the reactor, not cosmic rays
                **_ASSEMBLED,
                "hardwareCost": 3.0e9,  # ESTIMATE; excludes reactor development (several $B)
                "trl": 5,  # ground-tested 1960s-70s, never flown
                "burnReliability": 0.95,  # heuristic, no flight heritage
                "operationReliability": 0.995,
                "color": "#3B8BD4",
                "notes": [
                    "Isp 900 s is the DRA 5.0 design value; ground tests in the 1960s–70s "
                    "reached ≈ 850 s.",
                    "No nuclear thermal rocket has ever flown; development cost is not included.",
                ],
            }
        ),
        "starship": _freeze(
            {
                "id": "starship",
                "name": "Starship (CH₄/LOX)",
                "engine": "Raptor Vacuum, CH₄/LOX full-flow staged combustion",
                "isp": 380,  # [SPX]
                # ESTIMATE: not published; public estimates span ≈ 100-150 t
                "stageDryMass": 120_000,
                "propellantCapacity": 1_200_000,  # [SPX]
                "marsCapture": "aerocapture",
                # ESTIMATE: about 7.5 km/s entry speed, from SpaceX public statements;
                # not demonstrated at Mars.
                "maxEntrySpeed": 7_500,
                "gcrShieldingFactor": 1.0,
                "launchMode": "tanker",
                "defaultLaunchVehicle": "starship",
                "compatibleLaunchVehicles": ("starship",),
                "hardwareCost": 0.2e9,  # ESTIMATE
                "trl": 7,
                # heuristic, in-space Raptor relights only briefly demonstrated
                "burnReliability": 0.97,
                # heuristic, ship-to-ship cryogenic transfer at scale is undemonstrated
                "operationReliability": 0.99,
                # heuristic, crewed-scale Mars aerocapture never attempted
                "aerocaptureReliability": 0.97,
                "color": "#1D9E75",
                "notes": [
                    "Relies on many tanker flights and ship-to-ship propellant transfer, "
                    "which is not yet demonstrated at scale.",
                    "Stops at Mars with its heat shield (aerocapture), so it needs no braking "
                    "burn but caps the arrival speed.",
                ],
            }
        ),
    }
)

#: Reference vehicle ids in display order.
VEHICLE_IDS: tuple[str, ...] = ("chemical", "nuclear", "starship")


def create_custom_vehicle(
    *,
    name: str | None = None,
    isp: float,
    stage_dry_mass: float,
    propellant_capacity: float,
    trl: float = 5,
    gcr_shielding_factor: float = 1,
    burn_reliability: float | None = None,
    color: str = "#E91E8C",
) -> Mapping:
    """Build a vehicle from custom parts (used by the "build your rocket" UI).

    Uses the assembled-in-LEO architecture (any launcher) and propulsive
    capture. ``burn_reliability`` defaults to a TRL-based heuristic (0.99 at
    TRL 9, −1% per level below).
    """
    for k, v in (
        ("isp", isp),
        ("stageDryMass", stage_dry_mass),
        ("propellantCapacity", propellant_capacity),
    ):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v <= 0:
            raise RangeError(f"{k} must be a positive finite number")
    if not (gcr_shielding_factor > 0 and gcr_shielding_factor <= 1):
        raise RangeError("gcrShieldingFactor must be in (0, 1]")
    if not (trl >= 1 and trl <= 9):
        raise RangeError("trl must be in 1–9")
    return _freeze(
        {
            "id": "custom",
            "name": name or "Custom rocket",
            "engine": "Custom",
            "isp": isp,
            "stageDryMass": stage_dry_mass,
            "propellantCapacity": propellant_capacity,
            "marsCapture": "propulsive",
            "gcrShieldingFactor": gcr_shielding_factor,
            **_ASSEMBLED,
            "hardwareCost": 2.0e9,  # ESTIMATE, flat placeholder for custom builds
            "trl": trl,
            "burnReliability": burn_reliability
            if burn_reliability is not None
            else 0.99 - 0.01 * (9 - trl),
            "operationReliability": 0.995,
            "color": color,
            "notes": ["Custom build: hardware cost is a flat placeholder estimate."],
        }
    )
