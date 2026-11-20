"""Where the planets are on a given date, and when the launch windows open.

Mirror of ``frontend/src/physics/ephemeris.js``.

Planet positions come from J2000 mean orbital elements (Standish, JPL),
propagated with Kepler's equation and projected onto the ecliptic plane
(inclination ignored). This places Mars on its real eccentric orbit
(1.38-1.67 AU), so different launch windows really do differ. Good windows
are the ones that arrive while Mars is near perihelion.

A launch window is the departure date on which a transfer, launched from
Earth, reaches Mars' orbit exactly when Mars is there.

SI units throughout. Dates are integer milliseconds since the Unix epoch
(UTC), exactly what a JS ``Date`` holds (``getTime()``); fractional values
are truncated with :func:`time_clip` wherever JS would build a ``Date``.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

from .constants import (
    AU,
    DAY,
    EARTH_ELEMENTS,
    EARTH_ORBITAL_PERIOD,
    J2000_EPOCH_MS,
    MARS_ELEMENTS,
    MARS_ORBITAL_PERIOD,
    MU_SUN,
)
from .jscompat import RangeError, js_mod, time_clip, utc_year
from .orbits import synodic_period, tangential_transfer, transfer_for_time_of_flight

DEG = math.pi / 180
MS_PER_CENTURY = 36525 * DAY * 1000
TWO_PI = 2 * math.pi

#: Earth–Mars synodic period [s] (≈ 779.9 days).
EARTH_MARS_SYNODIC_PERIOD = synodic_period(EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD)


def wrap_to_pi(angle: float) -> float:
    """Wrap an angle to (−π, π]."""
    a = js_mod(angle + math.pi, TWO_PI)
    if a <= 0:
        a += TWO_PI
    return a - math.pi


def _require_date(name: str, date_ms) -> None:
    if isinstance(date_ms, bool) or not isinstance(date_ms, int):
        raise TypeError(f"{name} must be a valid Date (integer ms since the Unix epoch)")


def solve_kepler(mean_anomaly: float, e: float) -> float:
    """Solve Kepler's equation M = E − e sin E for the eccentric anomaly E (Newton's method)."""
    if not (e >= 0 and e < 1):
        raise RangeError(f"eccentricity must be in [0, 1) (got {e})")
    m = wrap_to_pi(mean_anomaly)
    ecc = m if e < 0.8 else math.pi * math.copysign(1.0, m or 1)
    for _ in range(50):
        d_e = (ecc - e * math.sin(ecc) - m) / (1 - e * math.cos(ecc))
        ecc -= d_e
        if abs(d_e) < 1e-14:
            break
    return ecc


def planet_state(elements: Mapping[str, float], date_ms: int) -> dict:
    """Heliocentric position and velocity of a planet from mean orbital elements.

    Returns ``{r [m], longitude [rad], velocity: {radial, tangential} [m/s]}``.
    """
    _require_date("date", date_ms)
    t = (date_ms - J2000_EPOCH_MS) / MS_PER_CENTURY
    e = elements["e"]
    a = elements["a"] * AU
    mean_long = (elements["meanLongitude"] + elements["meanLongitudeRate"] * t) * DEG
    varpi = (elements["longitudePerihelion"] + elements["longitudePerihelionRate"] * t) * DEG
    ecc = solve_kepler(mean_long - varpi, e)
    nu = 2 * math.atan2(math.sqrt(1 + e) * math.sin(ecc / 2), math.sqrt(1 - e) * math.cos(ecc / 2))
    p = a * (1 - e * e)
    k = math.sqrt(MU_SUN / p)
    return {
        "r": a * (1 - e * math.cos(ecc)),
        "longitude": varpi + nu,
        "velocity": {"radial": k * e * math.sin(nu), "tangential": k * (1 + e * math.cos(nu))},
    }


def earth_state(date_ms: int) -> dict:
    """Earth's heliocentric state on a date."""
    return planet_state(EARTH_ELEMENTS, date_ms)


def mars_state(date_ms: int) -> dict:
    """Mars' heliocentric state on a date."""
    return planet_state(MARS_ELEMENTS, date_ms)


def solve_transfer_window(*, transfer: Mapping, near_date: int) -> dict:
    """Departure date (near ``near_date``) on which the transfer reaches Mars when Mars is there.

    ``transfer`` is ``{"kind": "hohmann"}`` (minimum-energy, tangent at Earth
    and at Mars' orbit) or ``{"kind": "timeOfFlight", "timeOfFlight": s}``.

    Phasing condition: longitude of Mars at arrival = Earth's longitude at
    departure + transfer angle. Solved with Newton steps on the departure
    date, using the Earth–Mars relative angular rate. Mars' distance and
    velocity at arrival are updated on every iteration. The closest window
    (within about ±390 days) is returned, with ``departureDate`` and
    ``arrivalDate`` as integer ms plus ``r1``/``r2`` and the transfer fields.

    Raises RangeError if the transfer cannot be flown in this geometry.
    """
    _require_date("nearDate", near_date)
    kind = transfer.get("kind") if transfer else None
    if kind not in ("hohmann", "timeOfFlight"):
        raise TypeError("transfer.kind must be 'hohmann' or 'timeOfFlight'")
    relative_rate = TWO_PI / EARTH_ORBITAL_PERIOD - TWO_PI / MARS_ORBITAL_PERIOD  # rad/s
    tof = transfer["timeOfFlight"] if kind == "timeOfFlight" else 259 * DAY

    # For a fixed departure time, make the transfer consistent with where Mars
    # will be at arrival (Mars' distance depends on the arrival date, which
    # depends on the time of flight).
    def evaluate(t_ms: float) -> tuple[dict, float]:
        nonlocal tof
        earth = earth_state(time_clip(t_ms))
        mars = None
        result = None
        for _ in range(40):
            mars = mars_state(time_clip(t_ms + tof * 1000))
            geometry = {
                "r1": earth["r"],
                "r2": mars["r"],
                "departure_planet_velocity": earth["velocity"],
                "arrival_planet_velocity": mars["velocity"],
            }
            result = (
                tangential_transfer(**geometry, r_apoapsis=mars["r"])
                if kind == "hohmann"
                else transfer_for_time_of_flight(
                    **geometry, time_of_flight=transfer["timeOfFlight"]
                )
            )
            change = abs(result["timeOfFlight"] - tof)
            tof = result["timeOfFlight"]
            if change < 0.01:
                break
        out = {**result, "r1": earth["r"], "r2": mars["r"]}
        return out, wrap_to_pi(mars["longitude"] - earth["longitude"] - result["transferAngle"])

    t: float = near_date
    for _ in range(100):
        result, phase_error = evaluate(t)
        if abs(phase_error) < 1e-9:
            return {
                **result,
                "departureDate": time_clip(t),
                "arrivalDate": time_clip(t + result["timeOfFlight"] * 1000),
            }
        # d(phaseError)/dt ≈ −relativeRate, so a Newton step is +phaseError / relativeRate.
        t += (phase_error / relative_rate) * 1000
    raise RangeError("Launch-window phasing did not converge")


def launch_windows(*, after: int, count: int = 5) -> list[dict]:
    """The next ``count`` minimum-energy (Hohmann-type) launch windows on or after a date.

    Each entry: departureDate / arrivalDate [ms], timeOfFlight [s], year (UTC
    year of departure).
    """
    _require_date("after", after)
    if isinstance(count, bool) or not isinstance(count, int) or count < 1 or count > 20:
        raise RangeError("count must be an integer 1–20")
    synodic_ms = EARTH_MARS_SYNODIC_PERIOD * 1000
    hohmann = {"kind": "hohmann"}
    w = solve_transfer_window(transfer=hohmann, near_date=after)
    while w["departureDate"] < after:
        w = solve_transfer_window(
            transfer=hohmann, near_date=time_clip(w["departureDate"] + synodic_ms)
        )
    out = []
    for _ in range(count):
        out.append(
            {
                "departureDate": w["departureDate"],
                "arrivalDate": w["arrivalDate"],
                "timeOfFlight": w["timeOfFlight"],
                "year": utc_year(w["departureDate"]),
            }
        )
        w = solve_transfer_window(
            transfer=hohmann, near_date=time_clip(w["departureDate"] + synodic_ms)
        )
    return out


def conjunction_stay_time(
    *, transfer_angle: float, time_of_flight: float, minimum_stay: float = 30 * DAY
) -> float:
    """Surface stay [s] for a conjunction-class round trip with a mirror-image return leg.

    At arrival Earth leads Mars by (n_E·T − θ). To fly the mirrored return,
    Earth must lead Mars by (θ − n_E·T) when the crew leaves. The angle
    between them changes at (n_E − n_M), so the wait is
      w = (2θ − 2·n_E·T + 2πk) / (n_E − n_M),
    where k is the smallest integer that gives w ≥ minimumStay. Planets are
    on mean circular motion here, a simplification. A Hohmann trip gives the
    classic ≈ 455-day stay.
    """
    if not (transfer_angle > 0 and transfer_angle <= math.pi):
        raise RangeError("transferAngle must be in (0, π]")
    if not (time_of_flight > 0):
        raise RangeError("timeOfFlight must be positive")
    if not (minimum_stay >= 0):
        raise RangeError("minimumStay must be ≥ 0")
    n_e = TWO_PI / EARTH_ORBITAL_PERIOD
    n_m = TWO_PI / MARS_ORBITAL_PERIOD
    base = 2 * transfer_angle - 2 * n_e * time_of_flight
    k = math.ceil((minimum_stay * (n_e - n_m) - base) / TWO_PI - 1e-12)
    return (base + TWO_PI * k) / (n_e - n_m)
