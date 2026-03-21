from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mars Mission Control API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISTANCE_OPTIONS = {
    2027: 97.7,
    2029: 81.5,
    2031: 101.2,
    2033: 62.1,
    2035: 95.4,
}

BASE_ROCKETS = {
    "chemical": {
        "label": "Chemical",
        "isp": 450,
        "exhaustVelocity": 4414.5,
        "transit": 247,
        "propellant": 311147,
        "radiation": 236,
        "cost": 10.8,
        "launches": 4,
        "success": 52.5,
        "crewHealth": 70.4,
        "color": "#E24B4A",
    },
    "nuclear": {
        "label": "Nuclear",
        "isp": 900,
        "exhaustVelocity": 8829,
        "transit": 123.5,
        "propellant": 79394,
        "radiation": 149.4,
        "cost": 5.4,
        "launches": 1,
        "success": 67.4,
        "crewHealth": 79.8,
        "color": "#3B8BD4",
    },
    "starship": {
        "label": "Starship",
        "isp": 363,
        "exhaustVelocity": 3561,
        "transit": 288,
        "propellant": 582455,
        "radiation": 264.7,
        "cost": 1.8,
        "launches": 6,
        "success": 47.6,
        "crewHealth": 67.3,
        "color": "#1D9E75",
    },
}

class MissionRequest(BaseModel):
    crew_size: int
    year: int
    risk: int


def safe_clamp(x, lo, hi):
    return max(lo, min(hi, x))


@app.post("/api/mission")
def compute_mission(request: MissionRequest):
    distance = DISTANCE_OPTIONS.get(request.year, 97.7)
    distance_factor = distance / 97.7
    risk = safe_clamp(request.risk, 1, 10)
    risk_mult = 1 - (risk - 1) * 0.03

    payload_mass = request.crew_size * 1000 + 2000

    rockets = {}
    for key, base in BASE_ROCKETS.items():
        rocket = base.copy()

        rocket["transit"] = round(base["transit"] * distance_factor, 1)
        rocket["propellant"] = round(base["propellant"] * distance_factor * (1 + (request.crew_size - 4) * 0.08), 1)
        rocket["radiation"] = round(base["radiation"] * distance_factor * (1 + (request.crew_size - 4) * 0.015), 1)
        rocket["cost"] = round(base["cost"] * (1 + (request.crew_size - 4) * 0.075), 2)
        rocket["success"] = safe_clamp(round(base["success"] * risk_mult - (request.crew_size - 4) * 1.2, 1), 20, 99.9)
        rocket["crewHealth"] = safe_clamp(round(base["crewHealth"] * risk_mult - (request.crew_size - 4) * 1.1, 1), 30, 99.9)
        rocket["payload"] = payload_mass

        rockets[key] = rocket

    return {
        "distance": distance,
        "year": request.year,
        "crew_size": request.crew_size,
        "risk": request.risk,
        "rockets": rockets,
    }
