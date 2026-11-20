"""Window table, ephemeris consistency and JS-compat helpers."""

from __future__ import annotations

import pytest

from app.physics.jscompat import (
    RangeError,
    iso_from_ms,
    js_mod,
    js_str,
    ms_from_iso,
    time_clip,
    to_fixed,
    to_js_json,
)
from app.physics.windows import (
    BEST_WINDOW_ID,
    DEFAULT_WINDOW_ID,
    WINDOW_IDS,
    WINDOWS,
    compute_window_table,
    get_window,
)


def test_window_table_matches_ephemeris() -> None:
    computed = compute_window_table()
    for stored, fresh in zip(WINDOWS, computed, strict=True):
        for key in (
            "id",
            "label",
            "oppositionYear",
            "departureDate",
            "arrivalDate",
            "oppositionDate",
        ):
            assert fresh[key] == stored[key], key
        for key in ("hohmannTimeOfFlight", "vInfDeparture", "vInfArrival"):
            assert fresh[key] == pytest.approx(stored[key], rel=1e-9), key


def test_window_ids_default_and_best() -> None:
    assert tuple(w["id"] for w in WINDOWS) == WINDOW_IDS
    assert DEFAULT_WINDOW_ID == "2028-12"
    assert BEST_WINDOW_ID == "2033-03"
    with pytest.raises(RangeError):
        get_window("2030-01")


def test_js_date_semantics() -> None:
    iso = "2028-12-06T02:22:21.666Z"
    assert iso_from_ms(ms_from_iso(iso)) == iso
    assert time_clip(1.9) == 1 and time_clip(-1.9) == -1  # TimeClip truncates toward zero


def test_js_number_semantics() -> None:
    assert js_mod(-1.0, 3.0) == -1.0  # JS % keeps the dividend's sign
    assert to_fixed(0.5, 0) == "1" and to_fixed(2.5, 0) == "3"  # half away from zero
    assert to_fixed(1.005, 2) == "1.00"  # exact binary value is below the tie
    assert to_fixed(-0.0, 0) == "0"
    assert js_str(5.0) == "5" and js_str(7) == "7"
    assert to_js_json({"a": 1.0, "b": [2.5, float("nan")], "c": True}) == {
        "a": 1,
        "b": [2.5, None],
        "c": True,
    }
