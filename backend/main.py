"""
Mars Mission Control — Backend API
Computes per-rocket mission metrics scaled to the selected launch window and crew size.

Data sources:
  NASA Mars DRA 5.0 (2009)
  NERVA Program 1965-1972 (Isp 841 s achieved; design target 900 s)
  NASA Curiosity RAD — Zeitlin et al. 2013, Science 340:1080 (1.84 mSv/day cruise)
  NASA STD-3001 Vol.1 (radiation career limit: 600 mSv)
  NASA GRC NTR Studies — Borowski et al. AIAA-2012-5144
  SpaceX Raptor 2 Specification 2023 (vacuum Isp = 380 s)
  NASA Inspector General Report 2022 (SLS cost ~$2.7B / launch)
  JPL Horizons Ephemeris (Mars opposition distances)
"""

from fastapi import FastAPI
from pydantic import BaseModel, field_validator
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mars Mission Control API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mars opposition distances (million km) — JPL Horizons ephemeris
DISTANCE_OPTIONS: dict[int, float] = {
    2027: 97.7,
    2029: 81.5,
    2031: 101.2,
    2033: 62.1,
    2035: 95.4,
}

RAD_RATE: float = 1.3           # mSv/day GCR — Curiosity RAD, Zeitlin et al. 2013
NTR_SHIELD_FACTOR: float = 0.93 # 4,000 kg shadow shield reduces GCR dose 7%
CAREER_RAD_LIMIT = 600.0        # mSv — NASA STD-3001 Rev C (2023)
BONE_RATE = 0.43                # %/month hip — Leblanc et al. 2007

# Base rocket specs at 97.7 M km / 4-crew baseline (NASA DRA 5.0)
BASE_ROCKETS: dict[str, dict] = {
    "chemical": {
        "label": "Chemical", "shortLabel": "CHEM",
        "engineType": "LH2/LOX - J-2X class",
        "fuelType": "Liquid Hydrogen + Liquid Oxygen",
        "isp": 450, "exhaustVelocity": 4414, "thrust": 890, "deltaV": 4.5, "trl": 9,
        "transit": 247, "propellant": 311147, "radiation": 321.1,
        "cost": 10.8, "launches": 4,
        "abortDv": 1.0, "careerRadPct": 53.5, "boneLossPct": 3.5,
        "shieldingMass": 0, "payloadMars": 20000, "color": "#E24B4A",
    },
    "nuclear": {
        "label": "Nuclear Thermal", "shortLabel": "NTR",
        "engineType": "NERVA-derived NTR - LH2",
        "fuelType": "Liquid Hydrogen (nuclear-heated)",
        "isp": 900, "exhaustVelocity": 8829, "thrust": 670, "deltaV": 7.2, "trl": 5,
        "transit": 123.5, "propellant": 79394, "radiation": 149.4,
        "cost": 5.4, "launches": 1,
        "abortDv": 3.7, "careerRadPct": 24.9, "boneLossPct": 1.8,
        "shieldingMass": 4000, "payloadMars": 56000, "color": "#3B8BD4",
    },
    "starship": {
        "label": "Starship", "shortLabel": "SHP",
        "engineType": "Raptor 2 Vacuum - CH4/LOX",
        "fuelType": "Liquid Methane + Liquid Oxygen",
        "isp": 380, "exhaustVelocity": 3727, "thrust": 7500, "deltaV": 3.8, "trl": 7,
        "transit": 288, "propellant": 582455, "radiation": 374.4,
        "cost": 1.8, "launches": 6,
        "abortDv": 0.3, "careerRadPct": 62.4, "boneLossPct": 4.1,
        "shieldingMass": 0, "payloadMars": 100000, "color": "#1D9E75",
    },
}


class MissionRequest(BaseModel):
    crew_size: int
    year: int
    risk: int

    @field_validator("crew_size")
    @classmethod
    def validate_crew(cls, v: int) -> int:
        if not 2 <= v <= 8:
            raise ValueError("crew_size must be between 2 and 8")
        return v

    @field_validator("year")
    @classmethod
    def validate_year(cls, v: int) -> int:
        if v not in DISTANCE_OPTIONS:
            raise ValueError(f"year must be one of {list(DISTANCE_OPTIONS.keys())}")
        return v

    @field_validator("risk")
    @classmethod
    def validate_risk(cls, v: int) -> int:
        if not 1 <= v <= 10:
            raise ValueError("risk must be between 1 and 10")
        return v


def safe_clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@app.post("/api/mission")
def compute_mission(request: MissionRequest):
    distance       = DISTANCE_OPTIONS[request.year]
    dist_factor    = distance / 97.7
    crew_prop_fact = 1.0 + (request.crew_size - 4) * 0.08
    crew_cost_fact = 1.0 + (request.crew_size - 4) * 0.075
    crew_pay_fact  = safe_clamp(1.0 - (request.crew_size - 4) * 0.04, 0.7, 1.1)

    rockets: dict[str, dict] = {}
    for key, base in BASE_ROCKETS.items():
        r = base.copy()
        transit   = round(base["transit"] * dist_factor, 1)
        radiation = round(base["radiation"] * dist_factor, 1)
        r["transit"]      = transit
        r["radiation"]    = radiation
        r["propellant"]   = round(base["propellant"] * dist_factor * crew_prop_fact)
        r["cost"]         = round(base["cost"] * crew_cost_fact, 2)
        r["payloadMars"]  = max(5000, round(base["payloadMars"] * crew_pay_fact))
        r["avgVelocity"]  = round(distance * 1e6 / (transit * 86400), 2)
        r["abortDv"]      = base["abortDv"]
        r["careerRadPct"] = round(radiation / CAREER_RAD_LIMIT * 100, 1)
        r["boneLossPct"]  = round(transit / 30 * BONE_RATE, 1)
        rockets[key] = r

    return {
        "distance":      distance,
        "distFactor":    round(dist_factor, 4),
        "year":          request.year,
        "crew_size":     request.crew_size,
        "risk":          request.risk,
        "radRateMsvDay": RAD_RATE,
        "rockets":       rockets,
    }


@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0"}
