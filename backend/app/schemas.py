"""Request and response schemas for the HTTP API (pydantic v2).

Requests are strict: unknown fields are rejected, numbers are not coerced
from strings/bools/floats, and NaN/Infinity are refused. Each request field
accepts its snake_case name (used by the existing frontend client) or the
camelCase name used by the JS engine, but not both at once.

Response models mirror the JS ``simulateMission`` output (schemaVersion 3),
with camelCase field names so the JSON is identical to what the JS engine
returns. They are documented in ``frontend/src/physics/README.md``.
"""

from __future__ import annotations

from typing import Any, Literal, Self

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from .physics.constants import DAY
from .physics.rng import UINT32_MAX

VehicleId = Literal["chemical", "nuclear", "starship"]
LaunchVehicleId = Literal["starship", "sls-block1", "sls-block2", "falcon-heavy", "new-glenn"]
WindowId = Literal["2026-11", "2028-12", "2031-01", "2033-03", "2035-07"]
TransferKind = Literal["fastest", "hohmann", "timeOfFlight"]

#: Longest fixed transit the API accepts [s] (anything slower than ~300 d is
#: already slower than the minimum-energy transfer, and is reported as infeasible).
MAX_TIME_OF_FLIGHT = 1000 * DAY

_STRICT = ConfigDict(extra="forbid", strict=True)


def _aliases(snake: str, *others: str) -> AliasChoices:
    return AliasChoices(snake, *others)


class TransferChoice(BaseModel):
    """Which heliocentric transfer to fly."""

    model_config = ConfigDict(
        **_STRICT,
        json_schema_extra={
            "examples": [{"kind": "fastest"}, {"kind": "timeOfFlight", "time_of_flight": 17280000}]
        },
    )

    kind: TransferKind = Field(
        "fastest",
        description=(
            "'hohmann': minimum-energy transfer. 'timeOfFlight': a fixed transit time "
            "(same trajectory for every vehicle). 'fastest': the fastest transfer one full "
            "tank load can deliver while keeping the risk-based Δv margin."
        ),
    )
    time_of_flight: float | None = Field(
        None,
        validation_alias=_aliases("time_of_flight", "timeOfFlight"),
        gt=0,
        le=MAX_TIME_OF_FLIGHT,
        allow_inf_nan=False,
        description="Transit time in seconds; required when kind is 'timeOfFlight', else omitted.",
    )

    @model_validator(mode="after")
    def _time_of_flight_matches_kind(self) -> Self:
        if self.kind == "timeOfFlight" and self.time_of_flight is None:
            raise ValueError("time_of_flight (seconds) is required when kind is 'timeOfFlight'")
        if self.kind != "timeOfFlight" and self.time_of_flight is not None:
            raise ValueError("time_of_flight is only allowed when kind is 'timeOfFlight'")
        return self

    def to_engine(self) -> dict[str, Any]:
        """The JS-style ``transferChoice`` object."""
        if self.kind == "timeOfFlight":
            return {"kind": "timeOfFlight", "timeOfFlight": self.time_of_flight}
        return {"kind": self.kind}


class MissionRequest(BaseModel):
    """Body of ``POST /api/mission``: one in-space stage flown in one fixed window."""

    model_config = ConfigDict(
        **_STRICT,
        json_schema_extra={
            "examples": [
                {
                    "vehicle": "nuclear",
                    "launch_vehicle": "sls-block1",
                    "crew_size": 4,
                    "risk": 5,
                    "window_id": "2028-12",
                    "transfer": {"kind": "fastest"},
                    "seed": 42,
                }
            ]
        },
    )

    vehicle: VehicleId = Field(description="In-space stage.")
    launch_vehicle: LaunchVehicleId | None = Field(
        None,
        validation_alias=_aliases("launch_vehicle", "launchVehicle"),
        description=(
            "Launcher that lifts the stage to LEO; defaults to the stage's own default "
            "(SLS Block 1 for chemical/nuclear, Starship for starship). The Starship stage "
            "only flies on the Starship launcher (422 otherwise)."
        ),
    )
    crew_size: int = Field(
        4, ge=2, le=8, validation_alias=_aliases("crew_size", "crewSize"), description="Crew, 2–8."
    )
    risk: int = Field(
        5,
        ge=1,
        le=10,
        validation_alias=_aliases("risk", "riskTolerance", "risk_tolerance"),
        description="Risk tolerance 1 (12 % Δv reserve) … 10 (2 %); also scales event odds.",
    )
    window_id: WindowId = Field(
        "2028-12",
        validation_alias=_aliases("window_id", "windowId"),
        description="Fixed launch-window id (departure month).",
    )
    transfer: TransferChoice = Field(
        default_factory=TransferChoice,
        validation_alias=_aliases("transfer", "transferChoice", "transfer_choice"),
    )
    seed: int | None = Field(
        None,
        ge=0,
        le=UINT32_MAX,
        description="uint32 seed for the gameplay event model; null/omitted = nominal flight.",
    )

    @model_validator(mode="before")
    @classmethod
    def _one_spelling_per_field(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for name, field in cls.model_fields.items():
                alias = field.validation_alias
                if isinstance(alias, AliasChoices):
                    given = [str(c) for c in alias.choices if c in data]
                    if len(given) > 1:
                        raise ValueError(f"{name} given more than once ({', '.join(given)})")
        return data


# ── Error envelope ─────────────────────────────────────────────────────────


class ErrorDetail(BaseModel):
    loc: list[str | int] = Field(default_factory=list)
    msg: str
    type: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Every non-2xx response: ``{"error": {"code", "message", "details"}}``."""

    error: ErrorBody


# ── Mission result (mirror of the JS output, schemaVersion 3) ──────────────

Num = int | float


class _Out(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Closure(_Out):
    water: Num
    oxygen: Num


class TransferChoiceOut(_Out):
    kind: TransferKind
    timeOfFlight: Num | None = None


class Inputs(_Out):
    vehicleId: str
    launchVehicleId: str
    crewSize: int
    riskTolerance: Num
    windowId: str | None
    seed: int | None
    transferChoice: TransferChoiceOut
    habitatMass: Num | None
    closure: Closure


class VehicleSummary(_Out):
    id: str
    name: str
    isp: Num
    stageDryMass: Num
    propellantCapacity: Num
    marsCapture: Literal["propulsive", "aerocapture"]
    gcrShieldingFactor: Num
    launchMode: Literal["assembled", "tanker"]
    trl: Num
    hardwareCost: Num


class LaunchVehicleSummary(_Out):
    id: str
    name: str
    payloadLeoKg: Num
    costPerLaunchUsd: Num
    status: Literal["operational", "flight-test", "planned"]
    reliabilityClass: Literal["proven", "limited", "planned", "flight-test"]
    launchReliability: Num


class DeltaV(_Out):
    departure: Num
    capture: Num
    total: Num
    planned: Num | None = None
    capability: Num
    reserve: Num | None = None
    margin: Num | None = None
    hohmannTotal: Num | None = None


class Mass(_Out):
    habitat: Num
    crew: Num
    consumables: Num
    payload: Num
    stageDry: Num
    dry: Num
    propellant: Num
    initialMassInLEO: Num
    hohmannPropellant: Num


class LaunchPlan(_Out):
    launchVehicleId: str
    capacityPerLaunch: Num
    crewedLaunches: int
    uncrewedLaunches: int
    expectedReflights: Num
    expectedLaunches: Num
    reflightDelayDays: Num


class Cost(_Out):
    hardware: Num
    launches: Num
    reflightReserve: Num
    total: Num


class Duration(_Out):
    outbound: Num
    surfaceStay: Num
    # "return" is a Python keyword, so it is declared via alias.
    return_: Num = Field(alias="return")
    total: Num


class Dose(_Out):
    outbound: Num
    surface: Num
    return_: Num = Field(alias="return")
    events: Num
    total: Num
    careerFraction: Num
    careerLimit: Num
    exceedsCareerLimit: bool


class DailyRates(_Out):
    food: Num
    water: Num
    oxygen: Num
    openLoop: Num
    closedLoop: Num


class PhaseMass(_Out):
    days: Num
    crewDays: Num
    food: Num
    water: Num
    oxygen: Num
    openLoop: Num
    closedLoop: Num


class RatesPerCrewDay(_Out):
    transit: DailyRates
    surface: DailyRates


class LifeSupport(_Out):
    crewSize: int
    closure: Closure
    contingencyDays: int
    ratesPerCrewDay: RatesPerCrewDay
    outbound: PhaseMass
    surface: PhaseMass
    return_: PhaseMass = Field(alias="return")
    total: DailyRates


class Recoverable(_Out):
    uncrewedLaunches: int
    elementReliability: Num
    expectedReflights: Num
    costPenaltyUsd: Num
    delayDays: Num
    explanation: str


class Success(_Out):
    probability: Num
    recoverable: Recoverable


class SuccessFactor(_Out):
    id: str
    label: str
    probability: Num
    explanation: str


class EventEffects(_Out):
    extraDose: Num
    deltaVPenalty: Num
    consumablesLossKg: Num
    commsOutageDays: Num


class MissionEvent(_Out):
    id: str
    type: Literal["solar-particle-event", "engine-fault", "micrometeoroid", "comms-blackout"]
    label: str
    phase: Literal["outbound", "surface", "return", "burn"]
    burn: str | None
    day: Num
    model: Literal["gameplay"]
    effects: EventEffects
    description: str


class EventSummary(_Out):
    count: int
    byType: dict[str, int]
    extraDose: Num
    deltaVPenalty: Num
    consumablesLossKg: Num
    commsOutageDays: Num
    deltaVReserveAfter: Num
    abort: bool
    abortReason: str | None


class FramingNote(_Out):
    id: str
    text: str


class ScoreComponent(_Out):
    id: str
    label: str
    max: Num
    value: Num
    points: Num
    explanation: str


class AchievementOut(_Out):
    id: str
    label: str
    description: str


class Score(_Out):
    total: Num
    max: Num
    grade: str
    components: list[ScoreComponent]
    achievements: list[AchievementOut]


class MissionResult(_Out):
    """Output of the mission model. Infeasible results carry only the first block of keys."""

    schemaVersion: Literal[3]
    inputs: Inputs
    vehicleId: str
    launchVehicleId: str
    windowId: str | None
    vehicle: VehicleSummary
    launchVehicle: LaunchVehicleSummary
    feasible: bool
    infeasibleReason: str | None
    transferChoice: TransferChoiceOut
    departureDate: str
    arrivalDate: str
    transitTime: Num | None
    hohmannTransitTime: Num
    # Fields with a default are present only in feasible results. Declaration
    # order equals the JS key order (infeasible keys are a subsequence of it).
    transferAngle: Num | None = None
    pathLength: Num | None = None
    averageSpeed: Num | None = None
    vInfDeparture: Num | None = None
    vInfArrival: Num | None = None
    deltaV: DeltaV | None
    mass: Mass | None = None
    launches: int | None = None
    launchPlan: LaunchPlan | None = None
    cost: Cost | None = None
    duration: Duration | None = None
    dose: Dose | None = None
    lifeSupport: LifeSupport | None = None
    success: Success | None = None
    successFactors: list[SuccessFactor]
    crewHealthIndex: Num | None = None
    events: list[MissionEvent]
    eventSummary: EventSummary | None = None
    framing: list[FramingNote] | None = None
    score: Score


# ── Catalog endpoints ──────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    schemaVersion: int


class StageOut(_Out):
    id: str
    name: str
    engine: str
    isp: Num
    stageDryMass: Num
    propellantCapacity: Num
    marsCapture: str
    maxEntrySpeed: Num | None
    gcrShieldingFactor: Num
    launchMode: str
    defaultLaunchVehicle: str
    compatibleLaunchVehicles: list[str] | None
    hardwareCost: Num
    trl: Num
    burnReliability: Num
    operationReliability: Num
    aerocaptureReliability: Num | None
    color: str
    notes: list[str]


class LaunchVehicleOut(_Out):
    id: str
    name: str
    payloadLeoKg: Num
    ispSeaLevelS: Num | None
    ispVacS: Num | None
    firstStageEngine: str
    thrustN: Num
    costPerLaunchUsd: Num
    reusable: bool
    status: str
    reliabilityClass: str
    launchReliability: Num
    reliabilityBasis: str
    source: str
    notes: list[str]


class VehiclesResponse(BaseModel):
    stages: list[StageOut]
    launchVehicles: list[LaunchVehicleOut]


class WindowOut(_Out):
    id: str
    label: str
    oppositionYear: int
    departureDate: str
    arrivalDate: str
    oppositionDate: str
    hohmannTimeOfFlight: Num
    vInfDeparture: Num
    vInfArrival: Num


class WindowsResponse(BaseModel):
    windows: list[WindowOut]
    defaultWindowId: str
    bestWindowId: str | None
