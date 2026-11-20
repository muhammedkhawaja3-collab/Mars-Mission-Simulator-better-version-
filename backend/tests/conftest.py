"""Shared fixtures. Paths are resolved from this file, so pytest works from any directory."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

REPO_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_PATH = REPO_ROOT / "shared" / "golden_cases.json"


def load_golden() -> dict:
    with GOLDEN_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


@pytest.fixture(scope="session")
def golden() -> dict:
    return load_golden()


@pytest.fixture
def client() -> TestClient:
    """App with the default dev CORS origins (localhost:5173 / 127.0.0.1:5173)."""
    return TestClient(
        create_app(cors_origins=["http://localhost:5173", "http://127.0.0.1:5173"]),
        raise_server_exceptions=False,
    )
