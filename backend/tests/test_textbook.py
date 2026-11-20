"""Textbook checks of the Python physics mirror against published reference values.

Sources:
  [Curtis] H. D. Curtis, Orbital Mechanics for Engineering Students, 3rd ed.
           (2014), §8.2-8.9, Examples 8.3-8.5 (Earth→Mars Hohmann, circular
           coplanar orbits: ~259 d, v∞ 2.94 / 2.65 km/s, departure from a
           low parking orbit ≈ 3.6 km/s).
  [NSSDC]  NASA NSSDC Mars fact sheet: synodic period 779.94 d.
  [DRA5]   NASA-SP-2009-566 (Mars DRA 5.0): crew capture into a 250 km ×
           33,793 km 1-sol ellipse; ≈ 0.9-1.0 km/s class capture burn.
  [Tsiolkovsky] Δv = Isp · g0 · ln(m0/mf), g0 = 9.80665 m/s² (CGPM 1901).
"""

from __future__ import annotations

import math

import pytest

from app.physics.constants import (
    DAY,
    EARTH_ORBITAL_PERIOD,
    G0,
    LEO_ALTITUDE,
    MARS_CAPTURE_APOAPSIS_ALTITUDE,
    MARS_CAPTURE_PERIAPSIS_ALTITUDE,
    MARS_ORBITAL_PERIOD,
    MU_EARTH,
    MU_MARS,
    R_EARTH,
    R_EARTH_ORBIT,
    R_MARS,
    R_MARS_ORBIT,
)
from app.physics.ephemeris import conjunction_stay_time
from app.physics.jscompat import RangeError
from app.physics.orbits import (
    capture_burn_delta_v,
    departure_burn_delta_v,
    hohmann_transfer,
    synodic_period,
    tangential_transfer,
)
from app.physics.rocket import (
    exhaust_velocity,
    launches_required,
    max_delta_v,
    propellant_for_delta_v,
    rocket_equation_delta_v,
)

H = hohmann_transfer(R_EARTH_ORBIT, R_MARS_ORBIT)


def test_hohmann_time_of_flight_259_days() -> None:
    # [Curtis] ≈ 259 d; model 258.9 d.
    assert H["timeOfFlight"] / DAY == pytest.approx(258.9, abs=0.5)


def test_hohmann_v_inf_departure_and_arrival() -> None:
    # [Curtis] 2.94 km/s at Earth, 2.65 km/s at Mars.
    assert H["vInfDeparture"] / 1000 == pytest.approx(2.94, abs=0.01)
    assert H["vInfArrival"] / 1000 == pytest.approx(2.65, abs=0.01)


def test_hohmann_phase_angle_44_degrees() -> None:
    # [Curtis] Mars must lead Earth by ≈ 44° at departure.
    assert math.degrees(H["phaseAngle"]) == pytest.approx(44.3, abs=0.5)


def test_tmi_from_400_km_leo_is_3_6_km_s() -> None:
    # [Curtis] departure burn from a low circular parking orbit ≈ 3.6 km/s.
    dv = departure_burn_delta_v(H["vInfDeparture"], MU_EARTH, R_EARTH + LEO_ALTITUDE)
    assert dv / 1000 == pytest.approx(3.6, abs=0.05)


def test_mars_capture_into_one_sol_ellipse_0_9_km_s() -> None:
    # [DRA5] 250 × 33,793 km 1-sol ellipse: ≈ 0.9 km/s; a low circular orbit costs ≈ 2.1 km/s.
    ellipse = capture_burn_delta_v(
        H["vInfArrival"],
        MU_MARS,
        R_MARS + MARS_CAPTURE_PERIAPSIS_ALTITUDE,
        R_MARS + MARS_CAPTURE_APOAPSIS_ALTITUDE,
    )
    circular = capture_burn_delta_v(
        H["vInfArrival"], MU_MARS, R_MARS + MARS_CAPTURE_PERIAPSIS_ALTITUDE
    )
    assert ellipse / 1000 == pytest.approx(0.9, abs=0.05)
    assert circular / 1000 == pytest.approx(2.08, abs=0.05)


def test_synodic_period_780_days() -> None:
    # [NSSDC] 779.94 d.
    assert synodic_period(EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD) / DAY == pytest.approx(
        780, abs=1
    )


def test_hohmann_conjunction_stay_about_454_days() -> None:
    stay = conjunction_stay_time(transfer_angle=math.pi, time_of_flight=H["timeOfFlight"])
    assert stay / DAY == pytest.approx(454, abs=5)


def test_tangential_transfer_reduces_to_hohmann() -> None:
    t = tangential_transfer(r1=R_EARTH_ORBIT, r2=R_MARS_ORBIT, r_apoapsis=R_MARS_ORBIT)
    assert t["transferAngle"] == math.pi
    assert t["timeOfFlight"] == pytest.approx(H["timeOfFlight"], rel=1e-12)
    assert t["vInfDeparture"] == pytest.approx(H["vInfDeparture"], rel=1e-9)


def test_tsiolkovsky_sanity() -> None:
    # [Tsiolkovsky] mass ratio e gives Δv = vₑ exactly; vₑ = Isp · g0.
    assert G0 == 9.80665
    assert exhaust_velocity(450) == pytest.approx(4412.9925)
    assert rocket_equation_delta_v(450, math.e, 1.0) == pytest.approx(450 * G0, rel=1e-15)
    # propellant_for_delta_v and max_delta_v are inverses.
    prop = propellant_for_delta_v(4000, 50_000, 380)
    assert max_delta_v(380, 50_000, prop) == pytest.approx(4000, rel=1e-12)
    # Higher Isp needs less propellant for the same Δv.
    assert propellant_for_delta_v(4000, 50_000, 900) < propellant_for_delta_v(4000, 50_000, 460)
    with pytest.raises(RangeError):
        rocket_equation_delta_v(450, 1.0, 2.0)


def test_launch_count_tolerates_round_off() -> None:
    assert launches_required(300_000.0001, 100_000) == 3  # 300.0000001 t on 100 t launchers
    assert launches_required(300_001, 100_000) == 4
    assert launches_required(0, 100_000) == 0
