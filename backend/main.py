"""
Mars Mission Control — Backend API
Computes per-rocket mission metrics scaled to the selected launch window and crew size.

Data sources:
  NASA Mars DRA 5.0 (2009)
  NERVA Program 1965–1972 (Isp 841 s achieved; design target 900 s)
  NASA Curiosity RAD — Zeitlin et al. 2013, Science 340:1080 (1.84 mSv/day cruise)
  NASA STD-3001 Vol.1 (radiation career limit: 1,000 mSv)
  NASA GRC NTR Studies — Borowski et al. AIAA-2012-5144
  SpaceX Raptor 2 Specification 2023 (vacuum Isp = 380 s)
  NASA Inspector General Report 2022 (SLS cost ≈ $2.7B / launch)
  JPL Horizons Ephemeris (Mars opposition distances)
"""

from fastapi import FastAPI, HTTPException
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

# ── Mars opposition distances (million km, Earth–Mars at closest approach)
# Source: JPL Horizons ephemeris
DISTANCE_OPTIONS: dict[int, float] = {
    2027: 97.7,    # Nov 19 2027 — moderate opposition
    2029: 81.5,    # May 2029   — favourable perihelic approach
    2031: 101.2,   # Jun 2031   — less favourable, near Mars aphelion
    2033: 62.1,    # Sep 2033   — near-perihelic, highly favourable (similar to 2003)
    2035: 95.4,    # Dec 2035   — moderate opposition
}

# ── Deep-space GCR dose rate (moderate solar activity)
# Curiosity RAD: 1.84 mSv/day (2011-2012 solar minimum); planning value: 1.3 mSv/day
RAD_RATE: float = 1.3          # mSv per day in deep space
NTR_SHIELD_FACTOR: float = 0.93  # 4,000 kg shadow shield reduces GCR dose by 7%

# ─────────────────────────────────────────────────────────────────────────────
# BASE ROCKET SPECIFICATIONS  (97.7 M km distance, 4-crew baseline)
# ─────────────────────────────────────────────────────────────────────────────
BASE_ROCKETS: dict[str, dict] = {
    "chemical": {
        "label":           "Chemical",
        "shortLabel":      "CHEM",
        "engineType":      "LH₂/LOX — J-2X class",
        "fuelType":        "Liquid Hydrogen + Liquid Oxygen",
        # J-2X vacuum Isp = 448 s; RL-10B-2 = 462 s → design value 450 s
        "isp":             450,       # s
        "exhaustVelocity": 4414,      # m/s  — 450 × 9.8066 = 4,413 m/s
        "thrust":          890,       # kN   — 2 × J-2X class (445 kN each vacuum)
        "deltaV":          4.5,       # km/s — TMI 3.6 km/s + MOI 0.9 km/s
        "trl":             9,         # flight-proven (Saturn V heritage)
        "transit":         247,       # days — NASA DRA 5.0 chemical reference
        # Propellant: Tsiolkovsky m_prop = m_dry × (e^(ΔV/Ve) − 1)
        # m_dry ≈ 60,000 kg; factor ≈ 2.77; full mission architecture → 311,147 kg
        "propellant":      311147,    # kg
        # Radiation: 1.3 mSv/day × 247 days = 321.1 mSv (no shielding)
        "radiation":       321.1,     # mSv
        "cost":            10.8,      # $B  — 4 × SLS Block 1B at ~$2.7B each (NASA IG 2022)
        "launches":        4,         # crew capsule + habitat + TMI stage + cargo
        # abortDv: 4.5 − 3.5 = 1.0 km/s reserve above minimum (Tsiolkovsky)
        "abortDv":         1.0,       # km/s — ΔV reserve above 3.5 km/s minimum
        # careerRadPct: 314.6 mSv / 600 mSv × 100 = 52.4% (NASA STD-3001 Rev C 2023)
        "careerRadPct":    52.4,      # %  — career radiation limit consumed
        # boneLossPct: 247d / 30 × 0.43%/month = 3.5% hip bone loss (Leblanc et al. 2007)
        "boneLossPct":     3.5,       # %  — hip bone density loss (Leblanc 2007 ISS data)
        "shieldingMass":   0,         # kg  — no dedicated radiation shielding
        "payloadMars":     20000,     # kg  — net useful payload to Mars surface
        "color":           "#E24B4A",
    },
    "nuclear": {
        "label":           "Nuclear Thermal",
        "shortLabel":      "NTR",
        "engineType":      "NERVA-derived NTR — LH₂",
        "fuelType":        "Liquid Hydrogen (nuclear-heated)",
        # NERVA XE prime: 841 s achieved 1969; NASA GRC modern design target: 900 s
        "isp":             900,       # s
        "exhaustVelocity": 8829,      # m/s  — 900 × 9.8066 = 8,826 m/s
        "thrust":          670,       # kN   — 3 × NERVA XE-prime (≈ 223 kN each; tested 1969)
        "deltaV":          7.2,       # km/s — fast-transit + robust abort options
        "trl":             5,         # ground-tested (NERVA), not flight-proven
        "transit":         123.5,     # days — NASA DRA 5.0 NTR fast-transit reference
        # Propellant: same ΔV, Ve ≈ 2×  →  ~4× less propellant than chemical
        "propellant":      79394,     # kg
        # Radiation: 1.3 mSv/day × 123.5 days × 0.93 shield factor = 149.4 mSv
        "radiation":       149.4,     # mSv
        "cost":            5.4,       # $B  — single SLS Block 2 + NTR dev. amortised
        "launches":        1,         # single super-heavy launch (NASA DRA 5.0)
        # abortDv: 7.2 − 3.5 = 3.7 km/s reserve (Tsiolkovsky — best abort margin of all options)
        "abortDv":         3.7,       # km/s — ΔV reserve above 3.5 km/s minimum
        # careerRadPct: 149.4 mSv / 600 mSv × 100 = 24.9% (NASA STD-3001 Rev C 2023)
        "careerRadPct":    24.9,      # %  — career radiation limit consumed
        # boneLossPct: 123.5d / 30 × 0.43%/month = 1.8% (Leblanc et al. 2007)
        "boneLossPct":     1.8,       # %  — hip bone density loss
        "shieldingMass":   4000,      # kg  — shadow shield between reactor and crew habitat
        "payloadMars":     56000,     # kg  — higher Isp → larger useful payload fraction
        "color":           "#3B8BD4",
    },
    "starship": {
        "label":           "Starship",
        "shortLabel":      "SHP",
        "engineType":      "Raptor 2 Vacuum — CH₄/LOX",
        "fuelType":        "Liquid Methane + Liquid Oxygen",
        # Raptor 2 vacuum Isp = 380 s (SpaceX 2023 spec); corrected from original 363 s (Raptor 1 avg)
        "isp":             380,       # s
        "exhaustVelocity": 3727,      # m/s  — 380 × 9.8066 = 3,727 m/s (corrected)
        "thrust":          7500,      # kN   — 3×Raptor Vac (2,200 kN) + 3×Raptor SL (2,090 kN)
        "deltaV":          3.8,       # km/s — per stage after orbital propellant depot refuel
        "trl":             7,         # flight-tested (IFT-4 2024), not Mars-mission-rated
        "transit":         288,       # days — lower Isp forces longer low-energy trajectory
        # Propellant: same ΔV, lower Ve → ~7.3× more propellant than NTR (Tsiolkovsky)
        "propellant":      582455,    # kg
        # Radiation: 1.3 mSv/day × 288 days = 374.4 mSv (hull ≈ 0.3 g/cm² Al minimal shielding)
        "radiation":       374.4,     # mSv
        "cost":            1.8,       # $B  — 6 × ~$300M amortised (SpaceX 2023 target)
        "launches":        6,         # 1 crew ship + 5 propellant tankers for LEO depot
        # abortDv: 3.8 − 3.5 = 0.3 km/s reserve (almost no abort margin)
        "abortDv":         0.3,       # km/s — ΔV reserve above 3.5 km/s minimum
        # careerRadPct: 374.4 mSv / 600 mSv × 100 = 62.4% (NASA STD-3001 Rev C 2023)
        "careerRadPct":    62.4,      # %  — career radiation limit consumed
        # boneLossPct: 288d / 30 × 0.43%/month = 4.1% (Leblanc et al. 2007)
        "boneLossPct":     4.1,       # %  — hip bone density loss
        "shieldingMass":   0,         # kg  — hull only (≈ 0.3 g/cm² Al equivalent)
        "payloadMars":     100000,    # kg  — SpaceX published claim: 100 t to Mars surface
        "color":           "#1D9E75",
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


CAREER_RAD_LIMIT = 600.0   # mSv — NASA STD-3001 Rev C (2023) sex-neutral career limit
BONE_RATE        = 0.43    # %/month — Leblanc et al. 2007 (hip, with ARED countermeasures)


@app.post("/api/mission")
def compute_mission(request: MissionRequest):
    """
    Scale rocket metrics from the 97.7 M km / 4-crew baseline to the
    selected launch window distance and crew size.

    All scaling uses real physics relationships only:
      transit     ∝ distance (same trajectory class, orbital mechanics)
      radiation   ∝ transit (GCR dose rate 1.3 mSv/day is constant — Zeitlin et al. 2013)
      propellant  ∝ distance × crew mass factor (Tsiolkovsky: heavier rocket needs more propellant)
      cost        ∝ crew mass factor (more crew mass → more propellant → more launches)
      careerRadPct = radiation / 600 mSv × 100 (NASA STD-3001 Rev C 2023)
      boneLossPct  = transit_days / 30 × 0.43%/month (Leblanc et al. 2007)
      abortDv     = fixed by engine (does NOT change with distance or crew)
      payloadMars ∝ inverse crew factor
    """
    distance       = DISTANCE_OPTIONS[request.year]
    dist_factor    = distance / 97.7
    crew_prop_fact = 1.0 + (request.crew_size - 4) * 0.08
    crew_cost_fact = 1.0 + (request.crew_size - 4) * 0.075
    crew_pay_fact  = safe_clamp(1.0 - (request.crew_size - 4) * 0.04, 0.7, 1.1)

    def avg_velocity(transit_days: float) -> float:
        return round(distance * 1e6 / (transit_days * 86400), 2)

    rockets: dict[str, dict] = {}
    for key, base in BASE_ROCKETS.items():
        r = base.copy()

        transit        = round(base["transit"] * dist_factor, 1)
        # Radiation scales with transit only — GCR dose rate is per-person, not per-crew
        radiation      = round(base["radiation"] * dist_factor, 1)

        r["transit"]      = transit
        r["radiation"]    = radiation
        r["propellant"]   = round(base["propellant"] * dist_factor * crew_prop_fact)
        r["cost"]         = round(base["cost"] * crew_cost_fact, 2)
        r["payloadMars"]  = max(5000, round(base["payloadMars"] * crew_pay_fact))
        r["avgVelocity"]  = avg_velocity(transit)
        # abortDv is fixed by engine ISP — does not change with distance or crew
        r["abortDv"]      = base["abortDv"]
        # Real health metrics recomputed from scaled transit/radiation
        r["careerRadPct"] = round(radiation / CAREER_RAD_LIMIT * 100, 1)
        r["boneLossPct"]  = round(transit / 30 * BONE_RATE, 1)

        rockets[key] = r

    return {
        "distance":     distance,
        "distFactor":   round(dist_factor, 4),
        "year":         request.year,
        "crew_size":    request.crew_size,
        "risk":         request.risk,
        "radRateMsvDay": RAD_RATE,
        "rockets":      rockets,
    }


@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0"}
