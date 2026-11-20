"""Fixed Earth→Mars launch windows with stable IDs.

Mirror of ``frontend/src/physics/windows.js``.

Share links and saved plans refer to a window by ID (e.g. '2028-12'), never
"the next window from today", so a link opens the same mission forever. The
table stores the values the ephemeris computes for the minimum-energy
(Hohmann-type) transfer in each window; tests recompute them and check they
still match.

Labels: the ID is the departure month. Each window is labelled by the year of
the Mars opposition it leads up to, e.g. the window departing November 2026
precedes the February 2027 opposition, so it is the "2027 window" (the UI
always shows the departure month next to it). Departures come 2-4 months
before opposition because the ship must leave while Earth trails Mars by
≈ 44° (see ephemeris.py). The computed opposition dates (19 Feb 2027,
25 Mar 2029, 4 May 2031, 28 Jun 2033, 15 Sep 2035) agree with published
opposition dates to within a day.

The table is a verbatim copy of the JS table; regenerate the JS one with
``computeWindowTable()`` and copy it here.
"""

from __future__ import annotations

import math
from types import MappingProxyType

from .constants import DAY, EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD
from .ephemeris import earth_state, mars_state, solve_transfer_window, wrap_to_pi
from .jscompat import RangeError, iso_from_ms, ms_from_utc, time_clip, utc_year

#: IDs of the fixed windows, in order. Decision 4 in PLAN.md.
WINDOW_IDS: tuple[str, ...] = ("2026-11", "2028-12", "2031-01", "2033-03", "2035-07")

#: Default window. The 2026-27 window is already open at the time of writing
#: (November 2026), so the default is the next full window.
DEFAULT_WINDOW_ID = "2028-12"

#: Computed table. DO NOT edit by hand: copy from the JS WINDOWS table.
WINDOWS: tuple[MappingProxyType, ...] = tuple(
    MappingProxyType(w)
    for w in (
        # WINDOW_TABLE_START
        {
            "id": "2026-11",
            "label": "2027 window",
            "oppositionYear": 2027,
            "departureDate": "2026-11-04T17:31:01.714Z",
            "arrivalDate": "2027-07-27T13:40:52.112Z",
            "oppositionDate": "2027-02-19T15:27:07.499Z",
            "hohmannTimeOfFlight": 22882190.397465378,
            "vInfDeparture": 3116.9124199806547,
            "vInfArrival": 3162.575656222396,
        },
        {
            "id": "2028-12",
            "label": "2029 window",
            "oppositionYear": 2029,
            "departureDate": "2028-12-06T02:22:21.666Z",
            "arrivalDate": "2029-08-14T18:07:20.033Z",
            "oppositionDate": "2029-03-25T06:43:54.149Z",
            "hohmannTimeOfFlight": 21743098.36647102,
            "vInfDeparture": 2714.8784683898716,
            "vInfArrival": 3578.8635518352016,
        },
        {
            "id": "2031-01",
            "label": "2031 window",
            "oppositionYear": 2031,
            "departureDate": "2031-01-16T09:35:17.878Z",
            "arrivalDate": "2031-09-12T13:55:55.643Z",
            "oppositionDate": "2031-05-04T11:31:18.658Z",
            "hohmannTimeOfFlight": 20665237.764370494,
            "vInfDeparture": 2325.1919279911754,
            "vInfArrival": 3539.6551961628797,
        },
        {
            "id": "2033-03",
            "label": "2033 window",
            "oppositionYear": 2033,
            "departureDate": "2033-03-30T09:44:07.136Z",
            "arrivalDate": "2033-11-25T10:44:55.168Z",
            "oppositionDate": "2033-06-28T02:26:39.694Z",
            "hohmannTimeOfFlight": 20739648.03289241,
            "vInfDeparture": 2437.9375195055773,
            "vInfArrival": 3404.9471703514955,
        },
        {
            "id": "2035-07",
            "label": "2035 window",
            "oppositionYear": 2035,
            "departureDate": "2035-07-08T01:31:43.865Z",
            "arrivalDate": "2036-04-07T03:17:19.719Z",
            "oppositionDate": "2035-09-15T19:21:14.744Z",
            "hohmannTimeOfFlight": 23679935.85307229,
            "vInfDeparture": 3393.851799593184,
            "vInfArrival": 2740.193393652407,
        },
        # WINDOW_TABLE_END
    )
)


def solve_opposition(near_date: int) -> int:
    """Mars opposition (Earth and Mars at the same heliocentric longitude) nearest a date [ms].

    Newton steps on the longitude difference.
    """
    relative_rate = (2 * math.pi) / EARTH_ORBITAL_PERIOD - (2 * math.pi) / MARS_ORBITAL_PERIOD
    t: float = near_date
    for _ in range(100):
        d = time_clip(t)
        diff = wrap_to_pi(earth_state(d)["longitude"] - mars_state(d)["longitude"])
        if abs(diff) < 1e-10:
            break
        t -= (diff / relative_rate) * 1000
    return time_clip(t)


def compute_window_table() -> list[dict]:
    """Recompute every window entry from the ephemeris."""
    out = []
    for wid in WINDOW_IDS:
        y, m = (int(x) for x in wid.split("-"))
        w = solve_transfer_window(transfer={"kind": "hohmann"}, near_date=ms_from_utc(y, m - 1, 1))
        opposition = solve_opposition(time_clip(w["departureDate"] + 90 * DAY * 1000))
        opposition_year = utc_year(opposition)
        out.append(
            {
                "id": wid,
                "label": f"{opposition_year} window",
                "oppositionYear": opposition_year,
                "departureDate": iso_from_ms(w["departureDate"]),
                "arrivalDate": iso_from_ms(w["arrivalDate"]),
                "oppositionDate": iso_from_ms(opposition),
                "hohmannTimeOfFlight": w["timeOfFlight"],
                "vInfDeparture": w["vInfDeparture"],
                "vInfArrival": w["vInfArrival"],
            }
        )
    return out


def get_window(window_id: str) -> MappingProxyType:
    """Look up a window by ID. Raises RangeError for an unknown ID."""
    for w in WINDOWS:
        if w["id"] == window_id:
            return w
    raise RangeError(f"Unknown windowId: {window_id} (expected one of {', '.join(WINDOW_IDS)})")


def _best_window_id() -> str | None:
    if not WINDOWS:
        return None
    best = WINDOWS[0]
    for w in WINDOWS[1:]:
        if w["vInfDeparture"] + w["vInfArrival"] < best["vInfDeparture"] + best["vInfArrival"]:
            best = w
    return best["id"]


#: The window with the lowest minimum-energy v∞ sum (departure + arrival), i.e.
#: the cheapest of the fixed windows. Used by the "Perfect Window" achievement.
BEST_WINDOW_ID = _best_window_id()
