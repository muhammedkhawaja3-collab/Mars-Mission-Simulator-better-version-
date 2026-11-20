"""API tests for the existing FastAPI backend (backend/main.py)."""

import pytest
from fastapi.testclient import TestClient

from main import BASE_ROCKETS, DISTANCE_OPTIONS, app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_mission_valid_request():
    resp = client.post("/api/mission", json={"crew_size": 4, "year": 2027, "risk": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["distance"] == DISTANCE_OPTIONS[2027]
    assert body["crew_size"] == 4
    assert set(body["rockets"]) == set(BASE_ROCKETS)
    for rocket in body["rockets"].values():
        assert rocket["transit"] > 0
        assert rocket["radiation"] > 0
        assert rocket["avgVelocity"] > 0


def test_mission_baseline_matches_base_specs():
    """At the 97.7 M km / 4-crew baseline, transit is unscaled."""
    body = client.post(
        "/api/mission", json={"crew_size": 4, "year": 2027, "risk": 5}
    ).json()
    for key, base in BASE_ROCKETS.items():
        assert body["rockets"][key]["transit"] == pytest.approx(base["transit"], rel=1e-3)


def test_shorter_distance_shortens_transit():
    near = client.post("/api/mission", json={"crew_size": 4, "year": 2033, "risk": 5}).json()
    far = client.post("/api/mission", json={"crew_size": 4, "year": 2031, "risk": 5}).json()
    for key in BASE_ROCKETS:
        assert near["rockets"][key]["transit"] < far["rockets"][key]["transit"]


@pytest.mark.parametrize("crew_size", [0, 1, 9, 100])
def test_invalid_crew_size_returns_422(crew_size):
    resp = client.post("/api/mission", json={"crew_size": crew_size, "year": 2027, "risk": 5})
    assert resp.status_code == 422


def test_invalid_year_returns_422():
    resp = client.post("/api/mission", json={"crew_size": 4, "year": 2028, "risk": 5})
    assert resp.status_code == 422


def test_missing_field_returns_422():
    resp = client.post("/api/mission", json={"crew_size": 4, "year": 2027})
    assert resp.status_code == 422
