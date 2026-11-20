"""HTTP routes: ``/api/health``, ``/api/vehicles``, ``/api/windows``, ``POST /api/mission``."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .errors import error_response
from .physics.jscompat import RangeError, to_js_json
from .physics.launch_vehicles import LAUNCH_VEHICLE_IDS, LAUNCH_VEHICLES, launch_compatibility
from .physics.mission import MISSION_SCHEMA_VERSION, simulate_mission
from .physics.vehicles import VEHICLE_IDS, VEHICLES
from .physics.windows import BEST_WINDOW_ID, DEFAULT_WINDOW_ID, WINDOWS
from .schemas import (
    ErrorResponse,
    HealthResponse,
    MissionRequest,
    MissionResult,
    VehiclesResponse,
    WindowsResponse,
)

APP_VERSION = "4.0.0"

router = APIRouter(prefix="/api")

_ERRORS = {422: {"model": ErrorResponse, "description": "Invalid request or combination"}}


@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    """Liveness check."""
    return {"status": "ok", "version": APP_VERSION, "schemaVersion": MISSION_SCHEMA_VERSION}


@router.get("/vehicles", response_model=VehiclesResponse)
def vehicles() -> dict:
    """In-space stages and launch vehicles (the catalog the engine uses, with sources)."""
    stages = []
    for vid in VEHICLE_IDS:
        v = dict(VEHICLES[vid])
        v.setdefault("maxEntrySpeed", None)
        v.setdefault("aerocaptureReliability", None)
        stages.append(v)
    return to_js_json(
        {
            "stages": stages,
            "launchVehicles": [dict(LAUNCH_VEHICLES[i]) for i in LAUNCH_VEHICLE_IDS],
        }
    )


@router.get("/windows", response_model=WindowsResponse)
def windows() -> dict:
    """The fixed launch windows (Decision 4: share links use these ids)."""
    return to_js_json(
        {
            "windows": [dict(w) for w in WINDOWS],
            "defaultWindowId": DEFAULT_WINDOW_ID,
            "bestWindowId": BEST_WINDOW_ID,
        }
    )


@router.post(
    "/mission",
    response_model=MissionResult,
    response_model_exclude_unset=True,
    responses=_ERRORS,
)
def mission(req: MissionRequest) -> dict | JSONResponse:
    """Simulate one mission with the Python mirror of the JS physics engine.

    The result has the same keys and values as the JS ``simulateMission``
    (schemaVersion 3). An infeasible transfer is a 200 with
    ``feasible: false`` and an ``infeasibleReason``; a disallowed stage ×
    launcher combination is a 422 with code ``unsupported_combination``.
    """
    if req.launch_vehicle is not None:
        compat = launch_compatibility(VEHICLES[req.vehicle], req.launch_vehicle)
        if not compat["ok"]:
            return error_response(
                422,
                "unsupported_combination",
                compat["reason"],
                [
                    {
                        "loc": ["body", "launch_vehicle"],
                        "msg": compat["reason"],
                        "type": "unsupported_combination",
                    }
                ],
            )
    try:
        result = simulate_mission(
            vehicle=req.vehicle,
            launch_vehicle=req.launch_vehicle,
            crew_size=req.crew_size,
            window_id=req.window_id,
            transfer_choice=req.transfer.to_engine(),
            risk_tolerance=req.risk,
            seed=req.seed,
        )
    except (RangeError, TypeError) as exc:
        return error_response(422, "invalid_mission", str(exc))
    return to_js_json(result)
