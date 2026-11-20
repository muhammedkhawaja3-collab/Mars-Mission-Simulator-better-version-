"""Reality-check fixes mirrored from the JS tests (scoring, framing, success).

Covers: the radiation score is live although every conjunction-class mission
exceeds NASA's 600 mSv career limit; every achievement is earnable; launch
reliability follows the launcher's reliability class; comparison framing and
the cheapest-compatible-launcher helper.
"""

from __future__ import annotations

import pytest

from app.physics.launch_vehicles import (
    LAUNCH_RELIABILITY_BY_CLASS,
    LAUNCH_VEHICLE_IDS,
    LAUNCH_VEHICLES,
)
from app.physics.mission import CAREER_LIMIT_NOTE, simulate_mission
from app.physics.scoring import (
    ACHIEVEMENTS,
    RADIATION_ROOKIE_SV,
    RADIATION_SCORE_FULL_SV,
    RADIATION_SCORE_ZERO_SV,
    score_mission,
)
from app.physics.success import LAUNCH_RELIABILITY, success_estimate
from app.physics.tradeoffs import cheapest_compatible_launcher, comparison_framing
from app.physics.vehicles import VEHICLE_IDS, VEHICLES, create_custom_vehicle
from app.physics.windows import BEST_WINDOW_ID, WINDOW_IDS

DAY = 86400


def _rad(m: dict) -> dict:
    return next(c for c in m["score"]["components"] if c["id"] == "radiation")


def _ids(m: dict) -> list[str]:
    return [a["id"] for a in m["score"]["achievements"]]


@pytest.fixture(scope="module")
def grid() -> list[dict]:
    out = []
    for window_id in WINDOW_IDS:
        for vehicle in VEHICLE_IDS:
            for kind in ("fastest", "hohmann"):
                m = simulate_mission(
                    vehicle=vehicle, window_id=window_id, transfer_choice={"kind": kind}
                )
                if m["feasible"]:
                    out.append(m)
    return out


def test_every_reference_mission_exceeds_career_limit_and_says_so(grid):
    assert len(grid) > 20
    for m in grid:
        assert m["dose"]["exceedsCareerLimit"] is True
        assert m["dose"]["careerLimit"] == 0.6
        assert "career-limit" in [f["id"] for f in m["framing"]]


def test_radiation_points_are_live(grid):
    pts = [_rad(m)["points"] for m in grid]
    assert max(pts) > 50
    assert min(pts) < max(pts) - 50
    assert all(p > 0 for p in pts)


def test_radiation_scale_is_linear(grid):
    m = grid[0]

    def at(total: float) -> float:
        mm = {**m, "dose": {**m["dose"], "total": total}}
        return _rad({"score": score_mission(mm)})["points"]

    assert at(RADIATION_SCORE_FULL_SV) == pytest.approx(200, abs=1e-9)
    assert at(0.3) == 200
    assert at(RADIATION_SCORE_ZERO_SV) == pytest.approx(0, abs=1e-9)
    assert at(2) == 0
    assert _rad(m)["value"] == m["dose"]["total"]


def test_heavy_shielding_can_get_under_the_limit():
    v = create_custom_vehicle(
        name="bunker",
        isp=900,
        stage_dry_mass=60_000,
        propellant_capacity=300_000,
        gcr_shielding_factor=0.1,
    )
    m = simulate_mission(vehicle=v, window_id="2035-07")
    assert m["feasible"]
    assert m["dose"]["exceedsCareerLimit"] is False
    assert "career-limit" not in [f["id"] for f in m["framing"]]


SHIELDED = create_custom_vehicle(
    name="s", isp=900, stage_dry_mass=60_000, propellant_capacity=200_000, gcr_shielding_factor=0.6
)
BIG = create_custom_vehicle(name="big", isp=460, stage_dry_mass=60_000, propellant_capacity=600_000)
WITNESSES = {
    "fuel-miser": {
        "vehicle": "chemical",
        "window_id": "2028-12",
        "transfer_choice": {"kind": "hohmann"},
    },
    "perfect-window": {"vehicle": "chemical", "window_id": BEST_WINDOW_ID},
    "radiation-rookie": {"vehicle": "nuclear", "window_id": "2035-07"},
    "shielded": {
        "vehicle": SHIELDED,
        "window_id": "2031-01",
        "transfer_choice": {"kind": "hohmann"},
    },
    "heavy-lifter": {"vehicle": BIG, "window_id": "2028-12"},
    "speed-demon": {"vehicle": "nuclear", "window_id": "2033-03"},
    "full-crew": {
        "vehicle": "chemical",
        "crew_size": 8,
        "window_id": "2028-12",
        "transfer_choice": {"kind": "hohmann"},
    },
}


def test_every_achievement_has_a_witness():
    assert sorted([*WITNESSES, "risk-taker"]) == sorted(a.id for a in ACHIEVEMENTS)
    assert RADIATION_SCORE_FULL_SV < RADIATION_ROOKIE_SV < RADIATION_SCORE_ZERO_SV


@pytest.mark.parametrize("achievement_id", sorted(WITNESSES))
def test_achievement_is_earnable(achievement_id):
    m = simulate_mission(**WITNESSES[achievement_id])
    assert m["feasible"]
    assert achievement_id in _ids(m)


def test_risk_taker_is_earnable_by_some_seed():
    found = None
    for seed in range(1, 51):
        m = simulate_mission(vehicle="chemical", window_id="2028-12", risk_tolerance=9, seed=seed)
        if "risk-taker" in _ids(m):
            found = seed
            break
    assert found is not None


def test_launch_reliability_follows_class():
    p = {i: LAUNCH_VEHICLES[i]["launchReliability"] for i in LAUNCH_VEHICLE_IDS}
    assert p["falcon-heavy"] > p["sls-block1"] > p["sls-block2"] > p["starship"]
    assert p["new-glenn"] == LAUNCH_RELIABILITY_BY_CLASS["limited"]
    for lv_id in LAUNCH_VEHICLE_IDS:
        lv = LAUNCH_VEHICLES[lv_id]
        assert lv["launchReliability"] == LAUNCH_RELIABILITY_BY_CLASS[lv["reliabilityClass"]]
        s = success_estimate(
            vehicle=VEHICLES["chemical"], launch_vehicle=lv, launches=3, margin=0.07
        )
        f = s["factors"][0]
        assert f["probability"] == lv["launchReliability"]
        assert lv["reliabilityClass"] in f["explanation"]
        assert lv["reliabilityBasis"] in f["explanation"]
    bare = {"id": "x", "name": "X", "costPerLaunchUsd": 1e8}
    s = success_estimate(vehicle=VEHICLES["chemical"], launch_vehicle=bare, launches=1, margin=0.07)
    assert s["factors"][0]["probability"] == LAUNCH_RELIABILITY


def test_mission_framing():
    m = simulate_mission(vehicle="chemical", window_id="2028-12")
    by_id = {f["id"]: f["text"] for f in m["framing"]}
    assert list(by_id) == ["launcher-cost", "capture-method", "career-limit"]
    assert "SLS Block 1" in by_id["launcher-cost"]
    assert "$2.2 B per launch" in by_id["launcher-cost"]
    assert "DRA 5.0" in by_id["capture-method"]
    assert by_id["career-limit"] == CAREER_LIMIT_NOTE
    ship = simulate_mission(vehicle="starship", window_id="2028-12")
    assert "$150 M per launch" in ship["framing"][0]["text"]


def test_comparison_framing():
    chem = simulate_mission(vehicle="chemical", window_id="2028-12")
    nuc = simulate_mission(vehicle="nuclear", window_id="2028-12")
    ship = simulate_mission(vehicle="starship", window_id="2028-12")
    assert comparison_framing({"chemical": chem, "nuclear": nuc}) == [
        {"id": "launchers", "text": "All costs shown with SLS Block 1."}
    ]
    f = comparison_framing({"chemical": chem, "nuclear": nuc, "starship": ship})
    assert [x["id"] for x in f] == ["launchers", "capture-method"]
    assert "starship on Starship" in f[0]["text"]
    assert comparison_framing({"x": {"feasible": False}}) == []
    with pytest.raises(TypeError):
        comparison_framing(None)


def test_cheapest_compatible_launcher():
    r = cheapest_compatible_launcher(vehicle="chemical", window_id="2028-12")
    assert [c["launchVehicleId"] for c in r["candidates"]] == list(LAUNCH_VEHICLE_IDS)
    costs = [c["costTotal"] for c in r["candidates"] if c["feasible"]]
    assert r["mission"]["cost"]["total"] == min(costs)
    assert r["launchVehicleId"] != "sls-block1"
    s = cheapest_compatible_launcher(
        vehicle="starship", window_id="2028-12", launch_vehicle="sls-block1"
    )
    assert [c["launchVehicleId"] for c in s["candidates"]] == ["starship"]
    none = cheapest_compatible_launcher(
        vehicle="chemical",
        window_id="2028-12",
        transfer_choice={"kind": "timeOfFlight", "timeOfFlight": 90 * DAY},
    )
    assert none["launchVehicleId"] is None
    with pytest.raises(TypeError):
        cheapest_compatible_launcher(vehicle="warp")
