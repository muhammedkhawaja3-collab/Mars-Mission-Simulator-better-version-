"""The Python mirror must reproduce every JS golden fixture.

shared/golden_cases.json is generated from the JS engine by
frontend/scripts/gen-golden.mjs. Numbers must match within rel 1e-9 /
abs 1e-12; strings, booleans, nulls, key sets and key order exactly.
"""

from __future__ import annotations

import math

import pytest

from app.physics import MISSION_SCHEMA_VERSION, simulate_mission
from app.physics.jscompat import to_js_json
from app.physics.vehicles import create_custom_vehicle

from .conftest import load_golden

GOLDEN = load_golden()
REL = GOLDEN["tolerance"]["relative"]
ABS = GOLDEN["tolerance"]["absolute"]
CASES = GOLDEN["cases"]


def to_kwargs(inp: dict) -> dict:
    """Golden input (JS option names) → simulate_mission keyword arguments."""
    vehicle = inp["vehicle"]
    if not isinstance(vehicle, str):
        c = vehicle["custom"]
        vehicle = create_custom_vehicle(
            name=c.get("name"),
            isp=c["isp"],
            stage_dry_mass=c["stageDryMass"],
            propellant_capacity=c["propellantCapacity"],
            trl=c.get("trl", 5),
            gcr_shielding_factor=c.get("gcrShieldingFactor", 1),
        )
    return {
        "vehicle": vehicle,
        "launch_vehicle": inp.get("launchVehicle"),
        "crew_size": inp["crewSize"],
        "risk_tolerance": inp["riskTolerance"],
        "window_id": inp["windowId"],
        "transfer_choice": inp["transferChoice"],
        "seed": inp["seed"],
        "habitat_mass": inp.get("habitatMass"),
    }


def assert_matches(actual, expected, path: str = "$") -> None:
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected object, got {actual!r}"
        assert list(actual) == list(expected), f"{path}: keys {list(actual)} != {list(expected)}"
        for k, v in expected.items():
            assert_matches(actual[k], v, f"{path}.{k}")
    elif isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected array, got {actual!r}"
        assert len(actual) == len(expected), f"{path}: length {len(actual)} != {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected, strict=True)):
            assert_matches(a, e, f"{path}[{i}]")
    elif isinstance(expected, bool) or expected is None or isinstance(expected, str):
        assert actual == expected and type(actual) is type(expected), (
            f"{path}: {actual!r} != {expected!r}"
        )
    else:
        assert isinstance(actual, (int, float)) and not isinstance(actual, bool), (
            f"{path}: expected number, got {actual!r}"
        )
        assert math.isclose(actual, expected, rel_tol=REL, abs_tol=ABS), (
            f"{path}: {actual!r} != {expected!r}"
        )


def test_schema_version_matches_js() -> None:
    assert GOLDEN["schemaVersion"] == MISSION_SCHEMA_VERSION == 2


def test_fixture_covers_23_cases() -> None:
    assert len(CASES) == 23


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_golden_case(case: dict) -> None:
    result = to_js_json(simulate_mission(**to_kwargs(case["input"])))
    assert_matches(result, case["expected"])


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_integer_typed_values_stay_integers(case: dict) -> None:
    """JSON.stringify prints 30000, not 30000.0: integral values must serialise as ints."""
    result = to_js_json(simulate_mission(**to_kwargs(case["input"])))

    def walk(a, e, path="$"):
        if isinstance(e, dict):
            for k in e:
                walk(a[k], e[k], f"{path}.{k}")
        elif isinstance(e, list):
            for i, (x, y) in enumerate(zip(a, e, strict=True)):
                walk(x, y, f"{path}[{i}]")
        elif isinstance(e, int) and not isinstance(e, bool):
            assert isinstance(a, int), f"{path}: {a!r} should be an int like the JS output"

    walk(result, case["expected"])
