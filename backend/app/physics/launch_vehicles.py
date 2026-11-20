"""Launch vehicles: the rockets that lift the in-space stage, its propellant and
the crew payload from Earth to low Earth orbit (LEO).

Mirror of ``frontend/src/physics/launchVehicles.js``.

The in-space stages (vehicles.py) do the Mars burns. This catalog only decides
how many launches it takes to put the stack in LEO and what those launches
cost.

Fields (SI units):
  payloadLeoKg       Mass delivered to LEO per launch [kg]. For a tanker
                     launch this is the propellant delivered.
  ispSeaLevelS       First-stage/core engine Isp at sea level [s], or None if unpublished.
  ispVacS            Same engine in vacuum [s], or None if unpublished.
  firstStageEngine   Engine the Isp values refer to.
  thrustN            Total liftoff thrust [N].
  costPerLaunchUsd   Marginal cost per launch [USD]. Development is excluded.
  reusable           Whether the configuration modelled is reused.
  status             'operational' | 'flight-test' | 'planned'.
  reliabilityClass   'proven' | 'limited' | 'planned' | 'flight-test' (see below).
  launchReliability  HEURISTIC probability that one launch succeeds, from the class.
  reliabilityBasis   Plain-language reason for the class, shown in successFactors.
  source             Short citation string, shown in the UI.

Numbers marked ESTIMATE are not published by the operator. They are the
author's estimates, kept inside the range of public reporting. Isp values are
display-only: the launch count and cost use payloadLeoKg and costPerLaunchUsd.

Sources:
  [SPX-SS]  SpaceX, Starship vehicle page (spacex.com/vehicles/starship):
            payload 100-150 t (fully reusable); Super Heavy thrust 7,590 tf
            (later revisions of the page list 8,240 tf for the upgraded
            booster; thrust is display-only here). SpaceX publishes no
            Raptor Isp. Starship Users Guide Rev 1.0 (March 2020): 100+ t to LEO.
  [SPX-FH]  SpaceX, Falcon Heavy vehicle page (spacex.com/vehicles/falcon-heavy):
            63,800 kg to LEO (expendable); 5,130,000 lbf (22,819 kN) at liftoff.
  [NASA-SLS] NASA SLS reference / fact sheets: Block 1 > 95 t to LEO and
            8.8 million lbf (39,100 kN) maximum thrust; Block 2 130 t to LEO
            (NASA SLS fact sheet 2015; JANNAF 2024 SLS presentation) and
            9.5 million lbf (NASA SLS fact sheet, June 2023).
  [RS25]    Aerojet Rocketdyne / L3Harris RS-25 spec sheet: 366 s sea level,
            452 s vacuum (109% power level).
  [OIG22]   NASA OIG IG-22-003, "NASA's Management of the Artemis Missions"
            (15 Nov 2021): SLS production cost ≈ $2.2 B per launch (excluding
            Orion, service module and ground systems).
  [OIG24]   NASA OIG IG-24-001, "NASA's Transition of the Space Launch System
            to a Commercial Services Contract" (12 Oct 2023): "a single SLS
            Block 1B will cost at least $2.5 billion to produce" (Artemis IV,
            excluding SE&I and development).
  [BO-NG]   Blue Origin, New Glenn page (blueorigin.com/new-glenn): 45 t to LEO;
            BE-4: 550,000 lbf (2,450 kN) at sea level, seven on the first stage.
            Blue Origin (20 Nov 2025) announced BE-4 upgrades raising first-stage
            thrust from 3.9 to 4.5 Mlbf, phased in from the third flight, and a
            larger New Glenn 9x4 (70 t to LEO, no date). The 7x2 baseline
            figures are kept here.

Launch reliability (HEURISTIC, not per-vehicle data). Each launcher gets a
class from its flight record as of 2026-11-20:
  proven      0.99  long record in a mature family. Mature launchers succeed
                    ≈ 98-99+ % of the time (Falcon 9: > 99 % over hundreds of
                    flights; every Falcon Heavy flight has succeeded).
  limited     0.97  operational but only a handful of flights, so early-life
                    failures are still likely (SLS Block 1: 2 of 2; New Glenn:
                    3 flights, NG-3 left its payload in the wrong orbit).
  planned     0.96  never flown. First flights of new launchers fail far more
                    often than mature ones; credited slightly above
                    flight-test because SLS Block 2 reuses the flown core stage.
  flight-test 0.95  still in its test campaign with recent failures (Starship
                    lost several vehicles in 2025 test flights).
These are the author's heuristics, chosen to rank the launchers by heritage.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

#: Pound-force → newton (exact: 0.45359237 kg × 9.80665 m/s²).
LBF = 4.4482216152605
#: Tonne-force → newton (1,000 kg × 9.80665 m/s²).
TONNE_FORCE = 9806.65

#: Heuristic per-launch success probability by reliability class (see header).
LAUNCH_RELIABILITY_BY_CLASS: Mapping[str, float] = MappingProxyType(
    {
        "proven": 0.99,
        "limited": 0.97,
        "planned": 0.96,
        "flight-test": 0.95,
    }
)


def _freeze(d: dict) -> MappingProxyType:
    return MappingProxyType({k: tuple(v) if isinstance(v, list) else v for k, v in d.items()})


LAUNCH_VEHICLES: Mapping[str, Mapping] = MappingProxyType(
    {
        "starship": _freeze(
            {
                "id": "starship",
                "name": "Starship (Super Heavy + Starship, reusable)",
                # [SPX-SS] lists 100-150 t. The low end is used: no Starship has yet
                # delivered a full-scale payload, and this is also the propellant each
                # tanker flight delivers.
                "payloadLeoKg": 100_000,
                # ESTIMATE: SpaceX does not publish Raptor Isp. ≈ 327 s (sea level) and
                # ≈ 350 s (vacuum, sea-level nozzle) are widely reported secondary figures.
                "ispSeaLevelS": 327,
                "ispVacS": 350,
                "firstStageEngine": "33 × Raptor (CH₄/LOX)",
                "thrustN": 7590 * TONNE_FORCE,  # [SPX-SS] 7,590 tf ≈ 74.4 MN
                # ESTIMATE: no published price. $150 M reflects current-era cost
                # estimates; SpaceX's long-term target is far lower.
                "costPerLaunchUsd": 150e6,
                "reusable": True,
                # in flight test, not yet in operational service (as modelled)
                "status": "flight-test",
                "reliabilityClass": "flight-test",
                "launchReliability": LAUNCH_RELIABILITY_BY_CLASS["flight-test"],
                "reliabilityBasis": "still in flight test, with vehicle losses in 2025",
                "source": ("SpaceX Starship page: 100–150 t to LEO, 7,590 tf; cost is an estimate"),
                "notes": [
                    "Required for the Starship in-space stage "
                    "(the ship and its tankers are Starships)."
                ],
            }
        ),
        "sls-block1": _freeze(
            {
                "id": "sls-block1",
                "name": "SLS Block 1",
                "payloadLeoKg": 95_000,  # [NASA-SLS] "more than 95 t" to LEO
                "ispSeaLevelS": 366,  # [RS25]
                "ispVacS": 452,  # [RS25]
                "firstStageEngine": "4 × RS-25 core + 2 five-segment SRBs",
                "thrustN": 8.8e6 * LBF,  # [NASA-SLS] 8.8 million lbf ≈ 39.1 MN
                "costPerLaunchUsd": 2.2e9,  # [OIG22]
                "reusable": False,
                "status": "operational",
                "reliabilityClass": "limited",
                "launchReliability": LAUNCH_RELIABILITY_BY_CLASS["limited"],
                "reliabilityBasis": "operational, but only 2 flights "
                "(Artemis I 2022, Artemis II 2026, both successful)",
                "source": (
                    "NASA SLS: 95 t to LEO, 8.8 Mlbf; NASA OIG IG-22-003: ≈ $2.2 B per launch"
                ),
                "notes": ["Flown on Artemis I (2022) and the crewed Artemis II (April 2026)."],
            }
        ),
        "sls-block2": _freeze(
            {
                "id": "sls-block2",
                "name": "SLS Block 2 (planned)",
                "payloadLeoKg": 130_000,  # [NASA-SLS] 130 t to LEO (design goal)
                "ispSeaLevelS": 366,  # [RS25] same core engines
                "ispVacS": 452,  # [RS25]
                "firstStageEngine": "4 × RS-25 core + 2 advanced boosters",
                # [NASA-SLS] 9.5 million lbf ≈ 42.3 MN (June 2023 fact sheet)
                "thrustN": 9.5e6 * LBF,
                # ESTIMATE: no published Block 2 figure. Uses the OIG's Block 1B production
                # cost ("at least $2.5 billion", [OIG24]) as a floor for the larger Block 2.
                "costPerLaunchUsd": 2.5e9,
                "reusable": False,
                "status": "planned",
                "reliabilityClass": "planned",
                "launchReliability": LAUNCH_RELIABILITY_BY_CLASS["planned"],
                "reliabilityBasis": "planned and never flown (reuses the flown SLS core stage)",
                "source": (
                    "NASA SLS fact sheets: 130 t to LEO, 9.5 Mlbf (planned, never flown); "
                    "cost is an estimate"
                ),
                "notes": [
                    "Planned configuration that has never flown; "
                    "its future depends on NASA budgets."
                ],
            }
        ),
        "falcon-heavy": _freeze(
            {
                "id": "falcon-heavy",
                "name": "Falcon Heavy (expendable)",
                "payloadLeoKg": 63_800,  # [SPX-FH] fully expendable
                # ESTIMATE: SpaceX does not currently publish Merlin Isp. 282 s / 311 s
                # are the commonly cited Merlin 1D sea-level / vacuum figures.
                "ispSeaLevelS": 282,
                "ispVacS": 311,
                "firstStageEngine": "27 × Merlin 1D (RP-1/LOX)",
                "thrustN": 22_819e3,  # [SPX-FH] 22,819 kN
                # ESTIMATE: SpaceX lists ≈ $97 M for the reusable configuration; the
                # fully expendable price is not published.
                "costPerLaunchUsd": 150e6,
                "reusable": False,
                "status": "operational",
                "reliabilityClass": "proven",
                "launchReliability": LAUNCH_RELIABILITY_BY_CLASS["proven"],
                "reliabilityBasis": "every Falcon Heavy flight has succeeded, "
                "and it shares hardware with Falcon 9",
                "source": (
                    "SpaceX Falcon Heavy page: 63.8 t to LEO expendable, 22,819 kN; "
                    "cost is an estimate"
                ),
                "notes": [
                    "Expendable configuration (no booster recovery) gives the maximum LEO payload."
                ],
            }
        ),
        "new-glenn": _freeze(
            {
                "id": "new-glenn",
                "name": "New Glenn",
                "payloadLeoKg": 45_000,  # [BO-NG]
                "ispSeaLevelS": None,  # not published by Blue Origin
                "ispVacS": None,  # not published by Blue Origin
                "firstStageEngine": "7 × BE-4 (CH₄/LOX)",
                "thrustN": 7 * 2450e3,  # [BO-NG] 7 × 2,450 kN ≈ 17.2 MN (≈ 3.85 Mlbf)
                "costPerLaunchUsd": 110e6,  # ESTIMATE: no published price
                "reusable": True,  # reusable first stage
                # First orbital flight January 2025; third flight (April 2026) left its
                # payload in a lower-than-planned orbit; grounded after a pad hotfire
                # anomaly on 28 May 2026, return to flight targeted for late 2026.
                "status": "operational",
                "reliabilityClass": "limited",
                "launchReliability": LAUNCH_RELIABILITY_BY_CLASS["limited"],
                "reliabilityBasis": "operational, but only 3 flights; "
                "the third left its payload in the wrong orbit",
                "source": (
                    "Blue Origin New Glenn page: 45 t to LEO, 7 × BE-4 at 2,450 kN; "
                    "cost is an estimate"
                ),
                "notes": [
                    "BE-4 specific impulse is not published, so it is not shown.",
                    "Baseline 7×2 figures. Blue Origin announced BE-4 thrust upgrades "
                    "(Nov 2025) and a larger 9×4 version (70 t to LEO, no date); "
                    "neither is modelled.",
                ],
            }
        ),
    }
)

#: Launch-vehicle ids in display order.
LAUNCH_VEHICLE_IDS: tuple[str, ...] = (
    "starship",
    "sls-block1",
    "sls-block2",
    "falcon-heavy",
    "new-glenn",
)


def get_launch_vehicle(lv_id: str) -> Mapping:
    """Resolve a launch-vehicle id to its catalog entry. Raises TypeError for an unknown id."""
    lv = LAUNCH_VEHICLES.get(lv_id) if isinstance(lv_id, str) else None
    if not lv:
        raise TypeError(
            f"Unknown launch vehicle: {lv_id} (expected one of {', '.join(LAUNCH_VEHICLE_IDS)})"
        )
    return lv


def launch_compatibility(stage: Mapping, launch_vehicle_id: str) -> dict:
    """Whether an in-space stage can be lifted by a launch vehicle.

    Rule: an 'assembled' stage (chemical, nuclear, custom) can ride on any
    launcher; its stack is split into as many launches as needed and docked
    in LEO. A 'tanker' stage (Starship) IS the upper stage of the Starship
    launcher and is refuelled by Starship tankers, so it can only use the
    Starship launch vehicle. Other combinations are disallowed, not silently
    replaced, so the UI can explain why.

    Returns ``{"ok": bool, "reason": str | None}``.
    """
    get_launch_vehicle(launch_vehicle_id)
    allowed = stage.get("compatibleLaunchVehicles")
    if isinstance(allowed, (list, tuple)) and launch_vehicle_id not in allowed:
        names = " or ".join(LAUNCH_VEHICLES[i]["name"] for i in allowed)
        return {
            "ok": False,
            "reason": f"{stage.get('name') or 'This stage'} can only launch on {names}: "
            "the ship is the launcher's own upper stage and is refuelled by its tankers.",
        }
    return {"ok": True, "reason": None}
