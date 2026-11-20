"""HTTP API tests: strict validation (never 500), error envelope, CORS, determinism."""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import load_golden
from .test_golden import assert_matches

BASE = {"vehicle": "chemical", "launch_vehicle": "sls-block1", "crew_size": 4, "risk": 5}
JSON = {"content-type": "application/json"}


def post_raw(client: TestClient, body: str, content_type: str = "application/json"):
    return client.post("/api/mission", content=body, headers={"content-type": content_type})


def assert_error(resp, status: int, code: str) -> dict:
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"error"}
    err = body["error"]
    assert set(err) == {"code", "message", "details"}
    assert err["code"] == code
    assert isinstance(err["message"], str) and err["message"]
    for d in err["details"]:
        assert set(d) == {"loc", "msg", "type"}
    return err


# ── Health and catalogs ────────────────────────────────────────────────────


def test_health(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "4.0.0", "schemaVersion": 2}
    assert resp.headers["x-request-id"]


def test_vehicles_catalog(client: TestClient) -> None:
    body = client.get("/api/vehicles").json()
    assert [s["id"] for s in body["stages"]] == ["chemical", "nuclear", "starship"]
    assert [lv["id"] for lv in body["launchVehicles"]] == [
        "starship",
        "sls-block1",
        "sls-block2",
        "falcon-heavy",
        "new-glenn",
    ]
    assert all(lv["source"] for lv in body["launchVehicles"])
    assert body["stages"][2]["compatibleLaunchVehicles"] == ["starship"]


def test_windows_catalog(client: TestClient) -> None:
    body = client.get("/api/windows").json()
    assert [w["id"] for w in body["windows"]] == [
        "2026-11",
        "2028-12",
        "2031-01",
        "2033-03",
        "2035-07",
    ]
    assert body["defaultWindowId"] == "2028-12"
    assert body["bestWindowId"] == "2033-03"


# ── Mission happy path ─────────────────────────────────────────────────────

API_CASES = [
    c
    for c in load_golden()["cases"]
    if isinstance(c["input"]["vehicle"], str) and "habitatMass" not in c["input"]
]


def golden_to_request(inp: dict) -> dict:
    tc = inp["transferChoice"]
    transfer = {"kind": tc["kind"]}
    if tc["kind"] == "timeOfFlight":
        transfer["time_of_flight"] = tc["timeOfFlight"]
    body = {
        "vehicle": inp["vehicle"],
        "crew_size": inp["crewSize"],
        "risk": inp["riskTolerance"],
        "window_id": inp["windowId"],
        "transfer": transfer,
        "seed": inp["seed"],
    }
    if "launchVehicle" in inp:
        body["launch_vehicle"] = inp["launchVehicle"]
    return body


@pytest.mark.parametrize("case", API_CASES, ids=[c["id"] for c in API_CASES])
def test_mission_json_matches_js_golden(client: TestClient, case: dict) -> None:
    resp = client.post("/api/mission", json=golden_to_request(case["input"]))
    assert resp.status_code == 200, resp.text
    assert_matches(resp.json(), case["expected"])


def test_camel_case_aliases_accepted(client: TestClient) -> None:
    snake = client.post("/api/mission", json={**BASE, "window_id": "2031-01", "seed": 3}).json()
    camel = client.post(
        "/api/mission",
        json={
            "vehicle": "chemical",
            "launchVehicle": "sls-block1",
            "crewSize": 4,
            "riskTolerance": 5,
            "windowId": "2031-01",
            "transferChoice": {"kind": "fastest"},
            "seed": 3,
        },
    ).json()
    assert snake == camel


def test_defaults_only_vehicle_required(client: TestClient) -> None:
    body = client.post("/api/mission", json={"vehicle": "nuclear"}).json()
    assert body["inputs"]["windowId"] == "2028-12"
    assert body["launchVehicleId"] == "sls-block1"
    assert body["events"] == []


def test_same_seed_same_events(client: TestClient) -> None:
    a = client.post("/api/mission", json={**BASE, "seed": 42}).json()
    b = client.post("/api/mission", json={**BASE, "seed": 42}).json()
    c = client.post("/api/mission", json={**BASE, "seed": 43}).json()
    assert a["events"] and a["events"] == b["events"]
    assert a["events"] != c["events"]
    assert a["transitTime"] == c["transitTime"]  # physics never depends on the seed


def test_risk_changes_result(client: TestClient) -> None:
    low = client.post("/api/mission", json={**BASE, "risk": 1}).json()
    high = client.post("/api/mission", json={**BASE, "risk": 10}).json()
    assert low["deltaV"]["margin"] == pytest.approx(0.12)
    assert high["deltaV"]["margin"] == pytest.approx(0.02)
    assert low["transitTime"] != high["transitTime"]
    assert low["success"]["probability"] != high["success"]["probability"]


def test_infeasible_transfer_is_200_with_reason(client: TestClient) -> None:
    resp = client.post(
        "/api/mission",
        json={**BASE, "transfer": {"kind": "timeOfFlight", "time_of_flight": 150 * 86400}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["feasible"] is False
    assert "propellant" in body["infeasibleReason"]
    assert "mass" not in body and body["transitTime"] is None


# ── Validation: always 422, never 500 ──────────────────────────────────────

BAD_BODIES = {
    "nan": '{"vehicle":"chemical","crew_size":NaN}',
    "infinity": '{"vehicle":"chemical","risk":Infinity}',
    "neg-infinity": '{"vehicle":"chemical","seed":-Infinity}',
    "nan-time-of-flight": (
        '{"vehicle":"chemical","transfer":{"kind":"timeOfFlight","time_of_flight":NaN}}'
    ),
    "string-int": '{"vehicle":"chemical","crew_size":"4"}',
    "bool-int": '{"vehicle":"chemical","crew_size":true}',
    "float-int": '{"vehicle":"chemical","crew_size":4.0}',
    "float-risk": '{"vehicle":"chemical","risk":5.5}',
    "extra-field": '{"vehicle":"chemical","year":2029}',
    "extra-nested": '{"vehicle":"chemical","transfer":{"kind":"hohmann","warp":9}}',
    "unknown-vehicle": '{"vehicle":"warp"}',
    "unknown-window": '{"vehicle":"chemical","window_id":"2030-01"}',
    "crew-too-small": '{"vehicle":"chemical","crew_size":1}',
    "crew-too-big": '{"vehicle":"chemical","crew_size":9}',
    "risk-zero": '{"vehicle":"chemical","risk":0}',
    "seed-negative": '{"vehicle":"chemical","seed":-1}',
    "seed-too-big": '{"vehicle":"chemical","seed":4294967296}',
    "tof-missing": '{"vehicle":"chemical","transfer":{"kind":"timeOfFlight"}}',
    "tof-not-allowed": '{"vehicle":"chemical","transfer":{"kind":"hohmann","time_of_flight":1}}',
    "tof-negative": '{"vehicle":"chemical","transfer":{"kind":"timeOfFlight","time_of_flight":-5}}',
    "duplicate-spelling": '{"vehicle":"chemical","crew_size":4,"crewSize":4}',
    "null-field": '{"vehicle":null}',
    "null-body": "null",
    "array-body": "[]",
    "array-of-objects": '[{"vehicle":"chemical"}]',
    "string-body": '"chemical"',
    "number-body": "4",
    "empty-object": "{}",
    "empty-body": "",
    "malformed": '{"vehicle":',
    "missing-vehicle": '{"crew_size":4}',
}


@pytest.mark.parametrize("body", BAD_BODIES.values(), ids=BAD_BODIES.keys())
def test_bad_bodies_are_422_with_envelope(client: TestClient, body: str) -> None:
    err = assert_error(post_raw(client, body), 422, "validation_error")
    assert err["details"]
    for d in err["details"]:
        assert "nan" not in str(d["loc"]).lower()


def test_text_plain_is_422(client: TestClient) -> None:
    assert_error(post_raw(client, '{"vehicle":"chemical"}', "text/plain"), 422, "validation_error")


def test_422_never_echoes_input(client: TestClient) -> None:
    resp = post_raw(client, '{"vehicle":"chemical","crew_size":"<script>"}')
    assert "<script>" not in resp.text


def test_disallowed_combination_422_with_reason(client: TestClient) -> None:
    resp = client.post(
        "/api/mission", json={"vehicle": "starship", "launch_vehicle": "falcon-heavy"}
    )
    err = assert_error(resp, 422, "unsupported_combination")
    assert "can only launch on Starship" in err["message"]
    assert err["details"][0]["loc"] == ["body", "launch_vehicle"]


def test_assembled_stage_on_any_launcher(client: TestClient) -> None:
    for lv in ("starship", "sls-block2", "falcon-heavy", "new-glenn"):
        resp = client.post("/api/mission", json={"vehicle": "nuclear", "launch_vehicle": lv})
        assert resp.status_code == 200, (lv, resp.text)


def test_oversized_body_is_413(client: TestClient) -> None:
    resp = post_raw(client, '{"vehicle":"chemical","pad":"' + "x" * 20_000 + '"}')
    assert_error(resp, 413, "payload_too_large")


def test_404_and_405_use_envelope(client: TestClient) -> None:
    assert_error(client.get("/api/nope"), 404, "not_found")
    assert_error(client.get("/api/mission"), 405, "method_not_allowed")


def test_numbers_in_response_are_finite(client: TestClient) -> None:
    body = client.post("/api/mission", json={**BASE, "seed": 1}).json()

    def walk(x):
        if isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
        elif isinstance(x, float):
            assert math.isfinite(x)

    walk(body)


# ── CORS ───────────────────────────────────────────────────────────────────


def preflight(client: TestClient, origin: str):
    return client.options(
        "/api/mission",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )


def test_cors_dev_origins_allowed(client: TestClient) -> None:
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        resp = preflight(client, origin)
        assert resp.headers.get("access-control-allow-origin") == origin
        assert "access-control-allow-credentials" not in resp.headers
        assert "DELETE" not in resp.headers.get("access-control-allow-methods", "")


@pytest.mark.parametrize(
    "origin",
    ["https://evil.example", "http://localhost:5174", "null", "http://localhost:5173.evil.example"],
)
def test_cors_disallowed_origin_not_echoed(client: TestClient, origin: str) -> None:
    pre = preflight(client, origin)
    assert "access-control-allow-origin" not in pre.headers
    simple = client.get("/api/health", headers={"Origin": origin})
    assert "access-control-allow-origin" not in simple.headers
    assert simple.headers.get("access-control-allow-origin") != "*"


def test_production_is_same_origin_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    prod = TestClient(create_app())
    resp = prod.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" not in resp.headers
    assert prod.get("/api/docs").status_code == 404  # Swagger UI needs a CDN the CSP blocks


def test_cors_origins_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://preview.example")
    app_client = TestClient(create_app())
    ok = preflight(app_client, "https://preview.example")
    assert ok.headers.get("access-control-allow-origin") == "https://preview.example"
    assert (
        "access-control-allow-origin" not in preflight(app_client, "http://localhost:5173").headers
    )


def test_request_id_echoed_when_safe(client: TestClient) -> None:
    assert (
        client.get("/api/health", headers={"X-Request-ID": "abc-123"}).headers["x-request-id"]
        == "abc-123"
    )
    generated = client.get("/api/health", headers={"X-Request-ID": "bad id\n"}).headers[
        "x-request-id"
    ]
    assert generated != "bad id\n" and len(generated) == 32


def test_legacy_entrypoint_exports_app() -> None:
    import main

    assert main.app.title == "Mars Mission Simulator API"
