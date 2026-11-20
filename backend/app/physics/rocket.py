"""Rocket equation and launch-count logic.

Mirror of ``frontend/src/physics/rocket.js``.

Tsiolkovsky (1903): Δv = vₑ ln(m₀ / m_f), with vₑ = Isp · g0.
The exponential is why high-Isp engines matter so much. Propellant needed
grows as e^(Δv/vₑ), so halving vₑ more than doubles the propellant for large
Δv.

SI units: kg, m/s, s.
"""

from __future__ import annotations

import math

from .constants import G0
from .jscompat import RangeError


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require_positive(name: str, value) -> None:
    if not _is_number(value) or not math.isfinite(value) or value <= 0:
        raise RangeError(f"{name} must be a positive finite number (got {value})")


def _require_non_negative(name: str, value) -> None:
    if not _is_number(value) or not math.isfinite(value) or value < 0:
        raise RangeError(f"{name} must be a non-negative finite number (got {value})")


def exhaust_velocity(isp: float) -> float:
    """Effective exhaust velocity from specific impulse, vₑ = Isp · g0 [m/s]."""
    _require_positive("isp", isp)
    return isp * G0


def rocket_equation_delta_v(isp: float, initial_mass: float, final_mass: float) -> float:
    """Tsiolkovsky rocket equation: Δv = Isp · g0 · ln(m₀ / m_f) [m/s], 0 < m_f ≤ m₀."""
    _require_positive("initialMass", initial_mass)
    _require_positive("finalMass", final_mass)
    if final_mass > initial_mass:
        raise RangeError("finalMass cannot exceed initialMass")
    return exhaust_velocity(isp) * math.log(initial_mass / final_mass)


def mass_ratio_for_delta_v(delta_v: float, isp: float) -> float:
    """Mass ratio m₀/m_f needed for a given Δv: e^(Δv / vₑ) (≥ 1)."""
    _require_non_negative("deltaV", delta_v)
    return math.exp(delta_v / exhaust_velocity(isp))


def propellant_for_delta_v(delta_v: float, dry_mass: float, isp: float) -> float:
    """Propellant for a Δv given the burnout mass: m_p = m_dry · (e^(Δv/vₑ) − 1) [kg]."""
    _require_positive("dryMass", dry_mass)
    return dry_mass * (mass_ratio_for_delta_v(delta_v, isp) - 1)


def max_delta_v(isp: float, dry_mass: float, propellant_mass: float) -> float:
    """Largest Δv a vehicle can achieve with a given propellant load [m/s]."""
    _require_positive("dryMass", dry_mass)
    _require_non_negative("propellantMass", propellant_mass)
    return rocket_equation_delta_v(isp, dry_mass + propellant_mass, dry_mass)


def launches_required(mass: float, capacity_per_launch: float) -> int:
    """Launches needed to lift ``mass`` when each launch carries at most ``capacity_per_launch``.

    A tiny tolerance stops round-off from adding a spurious extra launch
    (e.g. 300.0000001 t on 100 t launchers is 3 launches). 0 if mass is 0.
    """
    _require_non_negative("mass", mass)
    _require_positive("capacityPerLaunch", capacity_per_launch)
    return max(0, math.ceil(mass / capacity_per_launch - 1e-9))
