"""Two-body orbital mechanics and patched-conic helpers.

Mirror of ``frontend/src/physics/orbits.js``.

Patched conics: the trip is split into three two-body problems. Near Earth
the ship follows a hyperbola relative to Earth, between the planets it
follows an ellipse around the Sun, and near Mars it follows a hyperbola
relative to Mars. The pieces are joined by the hyperbolic excess speed v∞,
which is the ship's speed relative to a planet "far away" from it.

All inputs and outputs are SI: metres, seconds, m/s, m³/s², radians.
Every function is pure and raises on invalid input instead of returning NaN.
"""

from __future__ import annotations

import math

from .constants import MU_SUN
from .jscompat import RangeError

# ── Input validation ────────────────────────────────────────────────────────


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require_positive(name: str, value) -> None:
    if not _is_number(value) or not math.isfinite(value) or value <= 0:
        raise RangeError(f"{name} must be a positive finite number (got {value})")


def _require_non_negative(name: str, value) -> None:
    if not _is_number(value) or not math.isfinite(value) or value < 0:
        raise RangeError(f"{name} must be a non-negative finite number (got {value})")


# ── Basic two-body relations ────────────────────────────────────────────────


def circular_speed(mu: float, r: float) -> float:
    """Speed of a circular orbit, v = √(μ / r) [m/s]."""
    _require_positive("mu", mu)
    _require_positive("r", r)
    return math.sqrt(mu / r)


def vis_viva_speed(mu: float, r: float, a: float) -> float:
    """Vis-viva equation, v = √(μ (2/r − 1/a)): speed anywhere on a conic orbit [m/s].

    ``a`` may be ``math.inf`` for a parabola.
    """
    _require_positive("mu", mu)
    _require_positive("r", r)
    if not (a > 0):
        raise RangeError(f"a must be positive for an elliptic or parabolic orbit (got {a})")
    v2 = mu * (2 / r - 1 / a)
    if v2 < 0:
        raise RangeError(f"r = {r} m is beyond the apoapsis of an orbit with a = {a} m")
    return math.sqrt(v2)


def orbital_period(mu: float, a: float) -> float:
    """Period of an elliptical orbit (Kepler's third law), T = 2π √(a³ / μ) [s]."""
    _require_positive("mu", mu)
    _require_positive("a", a)
    return 2 * math.pi * math.sqrt((a * a * a) / mu)


def synodic_period(period1: float, period2: float) -> float:
    """Synodic period, 1/S = |1/T1 − 1/T2| [s].

    The time between repeats of the same relative geometry of two bodies
    orbiting the same star. For Earth and Mars this is the spacing between
    launch windows (≈780 days, about 26 months).
    """
    _require_positive("period1", period1)
    _require_positive("period2", period2)
    if period1 == period2:
        raise RangeError("Equal periods never change relative geometry (infinite synodic period)")
    return 1 / abs(1 / period1 - 1 / period2)


# ── Hohmann (minimum-energy) transfer between circular coplanar orbits ─────


def hohmann_transfer(r1: float, r2: float, mu: float = MU_SUN) -> dict:
    """Hohmann transfer between two circular, coplanar orbits around the same body.

    The classic minimum-Δv two-impulse transfer: half an ellipse tangent to
    both orbits. Returns semiMajorAxis [m], timeOfFlight (half the transfer
    period) [s], departureSpeed / arrivalSpeed (heliocentric) [m/s],
    vInfDeparture / vInfArrival [m/s], transferAngle (π) [rad] and
    phaseAngle (how far the target must lead at departure) [rad].
    """
    _require_positive("r1", r1)
    _require_positive("r2", r2)
    _require_positive("mu", mu)
    if r1 == r2:
        raise RangeError("r1 and r2 must differ for a transfer")
    a = (r1 + r2) / 2
    time_of_flight = math.pi * math.sqrt((a * a * a) / mu)
    departure_speed = vis_viva_speed(mu, r1, a)
    arrival_speed = vis_viva_speed(mu, r2, a)
    target_mean_motion = math.sqrt(mu / (r2 * r2 * r2))
    return {
        "semiMajorAxis": a,
        "timeOfFlight": time_of_flight,
        "departureSpeed": departure_speed,
        "arrivalSpeed": arrival_speed,
        "vInfDeparture": abs(departure_speed - circular_speed(mu, r1)),
        "vInfArrival": abs(circular_speed(mu, r2) - arrival_speed),
        "transferAngle": math.pi,
        "phaseAngle": math.pi - target_mean_motion * time_of_flight,
    }


# ── Planet-centred (patched-conic) burns ───────────────────────────────────


def departure_burn_delta_v(v_inf: float, mu: float, r_park: float) -> float:
    """Δv to leave a circular parking orbit on a hyperbola with excess speed v∞.

    The burn is done at periapsis, where the Oberth effect makes it most
    efficient: Δv = √(v∞² + 2μ/r) − √(μ/r).
    """
    _require_non_negative("vInf", v_inf)
    _require_positive("mu", mu)
    _require_positive("rPark", r_park)
    return math.sqrt(v_inf * v_inf + (2 * mu) / r_park) - math.sqrt(mu / r_park)


def capture_burn_delta_v(
    v_inf: float, mu: float, r_periapsis: float, r_apoapsis: float | None = None
) -> float:
    """Δv to capture from an arrival hyperbola into a closed orbit (burn at periapsis).

    A loose ellipse (large apoapsis) is much cheaper than a circular orbit,
    which is why crewed Mars plans capture into ellipses. ``r_apoapsis``
    defaults to ``r_periapsis`` (circular).
    """
    if r_apoapsis is None:
        r_apoapsis = r_periapsis
    _require_non_negative("vInf", v_inf)
    _require_positive("mu", mu)
    _require_positive("rPeriapsis", r_periapsis)
    _require_positive("rApoapsis", r_apoapsis)
    if r_apoapsis < r_periapsis:
        raise RangeError("rApoapsis must be ≥ rPeriapsis")
    v_hyperbolic = math.sqrt(v_inf * v_inf + (2 * mu) / r_periapsis)
    v_captured = vis_viva_speed(mu, r_periapsis, (r_periapsis + r_apoapsis) / 2)
    return v_hyperbolic - v_captured


def entry_speed(v_inf: float, mu: float, r_entry: float) -> float:
    """Speed at atmospheric entry interface for arrival excess speed v∞ (energy conservation)."""
    _require_non_negative("vInf", v_inf)
    _require_positive("mu", mu)
    _require_positive("rEntry", r_entry)
    return math.sqrt(v_inf * v_inf + (2 * mu) / r_entry)


def max_v_inf_for_entry_speed(max_entry_speed: float, mu: float, r_entry: float) -> float:
    """Inverse of :func:`entry_speed`: largest arrival v∞ keeping entry speed ≤ a limit.

    Returns 0 if the limit is below escape speed.
    """
    _require_positive("maxEntrySpeed", max_entry_speed)
    _require_positive("mu", mu)
    _require_positive("rEntry", r_entry)
    return math.sqrt(max(0, max_entry_speed * max_entry_speed - (2 * mu) / r_entry))


# ── Faster-than-Hohmann transfers ──────────────────────────────────────────


def tangential_transfer(
    *,
    r1: float,
    r2: float,
    r_apoapsis: float,
    mu: float = MU_SUN,
    departure_planet_velocity: dict | None = None,
    arrival_planet_velocity: dict | None = None,
) -> dict:
    """Transfer leaving r1 tangentially (periapsis) and crossing r2 on the way to r_apoapsis ≥ r2.

    - r_apoapsis = r2 reproduces the Hohmann transfer (tangent at both ends).
      With circular planetary orbits that is the minimum-energy transfer. On
      Mars' real eccentric orbit, a slightly faster transfer that meets Mars
      nearer perihelion can sometimes cost less.
    - A larger r_apoapsis gives a faster, higher-energy transfer. The ship
      reaches r2 before apoapsis, at an angle to the planet's orbit. That
      raises v∞ at both ends: you spend Δv to buy transit time.

    Planet velocities ({radial, tangential} [m/s]) default to circular orbits
    but can be passed in, so the same function works with eccentric orbits.
    Returns semiMajorAxis, eccentricity, aphelion, timeOfFlight,
    transferAngle, vInfDeparture, vInfArrival, semiLatusRectum and
    arrivalVelocity (SI units).
    """
    _require_positive("r1", r1)
    _require_positive("r2", r2)
    _require_positive("rApoapsis", r_apoapsis)
    _require_positive("mu", mu)
    if not (r2 > r1):
        raise RangeError("This transfer family only goes outward (needs r2 > r1)")
    # Allow a hair of round-off when rApoapsis is meant to equal r2.
    if r_apoapsis < r2 * (1 - 1e-12):
        raise RangeError("rApoapsis must be ≥ r2 or the ship never reaches r2")
    r_a = max(r_apoapsis, r2)

    a = (r1 + r_a) / 2
    e = (r_a - r1) / (r_a + r1)
    p = (2 * r1 * r_a) / (r1 + r_a)  # semi-latus rectum a(1 − e²)

    # True anomaly where the transfer orbit crosses r2 (on the outbound leg).
    cos_nu = min(1, max(-1, (p / r2 - 1) / e))
    # Exactly π for the Hohmann case (acos loses precision right next to −1).
    nu = math.pi if r_a == r2 else math.acos(cos_nu)

    # Kepler's equation: time from periapsis to true anomaly ν.
    ecc_anomaly = 2 * math.atan2(
        math.sqrt(1 - e) * math.sin(nu / 2), math.sqrt(1 + e) * math.cos(nu / 2)
    )
    mean_anomaly = ecc_anomaly - e * math.sin(ecc_anomaly)
    time_of_flight = mean_anomaly / math.sqrt(mu / (a * a * a))

    # Ship velocity at departure (pure tangential) and at r2.
    v_peri = vis_viva_speed(mu, r1, a)
    h = math.sqrt(mu * p)  # specific angular momentum
    v_t = h / r2
    v_r = math.sqrt(mu / p) * e * math.sin(nu)

    dep = departure_planet_velocity or {"radial": 0, "tangential": circular_speed(mu, r1)}
    arr = arrival_planet_velocity or {"radial": 0, "tangential": circular_speed(mu, r2)}

    return {
        "semiMajorAxis": a,
        "eccentricity": e,
        "aphelion": r_a,
        "timeOfFlight": time_of_flight,
        "transferAngle": nu,
        "vInfDeparture": math.hypot(v_peri - dep["tangential"], 0 - dep["radial"]),
        "vInfArrival": math.hypot(v_t - arr["tangential"], v_r - arr["radial"]),
        "semiLatusRectum": p,
        "arrivalVelocity": {"radial": v_r, "tangential": v_t},
    }


def transfer_arc_length(transfer: dict) -> float:
    """Distance flown along a transfer arc [m].

    Length of the conic r(ν) = p / (1 + e cos ν) from periapsis (ν = 0) to the
    transfer angle, integrated with Simpson's rule.
    """
    p = transfer["semiLatusRectum"]
    e = transfer["eccentricity"]
    nu_end = transfer["transferAngle"]
    _require_positive("semiLatusRectum", p)
    _require_non_negative("eccentricity", e)
    _require_positive("transferAngle", nu_end)
    return _conic_arc_length(p, e, nu_end)


def _conic_arc_length(p: float, e: float, nu_end: float, steps: int = 200) -> float:
    def ds(nu: float) -> float:
        denom = 1 + e * math.cos(nu)
        r = p / denom
        drdnu = (p * e * math.sin(nu)) / (denom * denom)
        return math.sqrt(r * r + drdnu * drdnu)

    h = nu_end / steps
    total = ds(0) + ds(nu_end)
    for i in range(1, steps):
        total += ds(i * h) * (4 if i % 2 else 2)
    return (total * h) / 3


def parabolic_time_of_flight(r1: float, r2: float, mu: float = MU_SUN) -> float:
    """Time of flight on a parabola with periapsis r1 out to r2 (Barker's equation) [s].

    The lower limit on transit time for the elliptic tangential family: any
    faster trip would have to be hyperbolic relative to the Sun.
    """
    _require_positive("r1", r1)
    _require_positive("r2", r2)
    _require_positive("mu", mu)
    if not (r2 > r1):
        raise RangeError("needs r2 > r1")
    cos_nu = (2 * r1) / r2 - 1
    d = math.sqrt((1 - cos_nu) / (1 + cos_nu))  # tan(ν/2)
    return math.sqrt((2 * r1 * r1 * r1) / mu) * (d + (d * d * d) / 3)


def transfer_for_time_of_flight(
    *,
    r1: float,
    r2: float,
    time_of_flight: float,
    mu: float = MU_SUN,
    departure_planet_velocity: dict | None = None,
    arrival_planet_velocity: dict | None = None,
) -> dict:
    """Tangential-departure transfer with a requested time of flight (bisection on apoapsis).

    Time of flight falls steadily as apoapsis grows. This is how the model
    "buys" a shorter transit with Δv.

    NOTE: this one-parameter family is not Δv-optimal for a given time of
    flight. A full Lambert/porkchop optimisation spreads the extra energy
    between departure and arrival and does somewhat better, so treat
    fast-transfer Δv here as a conservative (high) estimate.

    Raises RangeError if the requested time is outside what this family can fly.
    """
    _require_positive("timeOfFlight", time_of_flight)
    base = {
        "r1": r1,
        "r2": r2,
        "mu": mu,
        "departure_planet_velocity": departure_planet_velocity,
        "arrival_planet_velocity": arrival_planet_velocity,
    }
    slowest = tangential_transfer(**base, r_apoapsis=r2)
    if time_of_flight > slowest["timeOfFlight"] * (1 + 1e-9):
        raise RangeError(
            f"Requested {time_of_flight / 86400:.1f} d is slower than the minimum-energy "
            f"transfer ({slowest['timeOfFlight'] / 86400:.1f} d)"
        )
    if time_of_flight >= slowest["timeOfFlight"]:
        return slowest

    # Upper bracket: an apoapsis so large the orbit is almost parabolic.
    lo = math.log(r2)
    hi = math.log(r2 * 1e6)
    fastest = tangential_transfer(**base, r_apoapsis=math.exp(hi))
    if time_of_flight < fastest["timeOfFlight"]:
        raise RangeError(
            f"Requested {time_of_flight / 86400:.1f} d is faster than any elliptic transfer "
            f"(limit ≈ {fastest['timeOfFlight'] / 86400:.1f} d)"
        )
    result = slowest
    for _ in range(100):
        mid = (lo + hi) / 2
        result = tangential_transfer(**base, r_apoapsis=math.exp(mid))
        if abs(result["timeOfFlight"] - time_of_flight) < 1e-3:  # 1 ms
            break
        if result["timeOfFlight"] > time_of_flight:
            lo = mid
        else:
            hi = mid
    return result
