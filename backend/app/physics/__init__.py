"""Python mirror of the JS physics engine (``frontend/src/physics``).

Pure functions, SI units, no framework code. The JS engine is the source of
truth; ``shared/golden_cases.json`` keeps the two in step (rel 1e-9).
"""

from .mission import MISSION_SCHEMA_VERSION, simulate_mission

__all__ = ["MISSION_SCHEMA_VERSION", "simulate_mission"]
