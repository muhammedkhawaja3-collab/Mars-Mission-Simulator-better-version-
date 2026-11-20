"""JavaScript-compatibility helpers for the Python mirror.

The JS engine (``frontend/src/physics``) is the source of truth. A few JS
semantics differ from Python's and must be reproduced exactly for the golden
fixtures to match:

- ``%`` on floats is C ``fmod`` in JS (sign of the dividend), not Python's
  floored modulo.
- ``new Date(ms)`` truncates a fractional millisecond value toward zero
  (ECMAScript TimeClip), and ``Date.prototype.toISOString`` prints
  ``YYYY-MM-DDTHH:mm:ss.sssZ``.
- ``Number.prototype.toFixed`` rounds the exact binary value half away from
  zero, while Python's ``format`` rounds exact ties to even.
- ``String(number)`` prints integral numbers without a decimal point.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


class RangeError(ValueError):
    """Mirror of the JS ``RangeError`` thrown by the engine for out-of-range input."""


def js_mod(a: float, b: float) -> float:
    """JS ``a % b`` for floats (truncated remainder, sign of ``a``)."""
    return math.fmod(a, b)


def time_clip(ms: float) -> int:
    """ECMAScript TimeClip: what ``new Date(ms).getTime()`` returns (truncation toward zero)."""
    if not math.isfinite(ms):
        raise RangeError("Invalid time value")
    return math.trunc(ms)


def iso_from_ms(ms: int) -> str:
    """JS ``new Date(ms).toISOString()`` for an integer millisecond timestamp."""
    dt = _EPOCH + timedelta(milliseconds=ms)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"


def ms_from_iso(iso: str) -> int:
    """JS ``new Date(iso).getTime()`` for ``YYYY-MM-DDTHH:mm:ss.sssZ`` strings."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    delta = dt - _EPOCH
    return (delta.days * 86400 + delta.seconds) * 1000 + delta.microseconds // 1000


def ms_from_utc(year: int, month_index: int, day: int = 1, hour: int = 0) -> int:
    """JS ``Date.UTC(year, monthIndex, day, hour)`` (monthIndex is 0-based)."""
    dt = datetime(year, month_index + 1, day, hour, tzinfo=UTC)
    return int((dt - _EPOCH) / timedelta(milliseconds=1))


def utc_year(ms: int) -> int:
    """JS ``new Date(ms).getUTCFullYear()``."""
    return (_EPOCH + timedelta(milliseconds=ms)).year


def to_fixed(x: float, digits: int) -> str:
    """JS ``Number.prototype.toFixed(digits)``."""
    if not math.isfinite(x):
        return "NaN" if math.isnan(x) else ("Infinity" if x > 0 else "-Infinity")
    if x == 0:
        x = 0.0  # (-0).toFixed() is "0"; (-0.4).toFixed(0) stays "-0" as in JS
    q = Decimal(x).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)
    return f"{q:f}"


def js_str(x: float | int) -> str:
    """JS ``String(number)`` for the values the engine interpolates into text."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, float) and x.is_integer() and abs(x) < 1e21:
        return str(int(x))
    return str(x)


def to_js_json(value):
    """Normalise a result so ``json.dumps`` matches JS ``JSON.stringify``.

    Integral floats become ints (JS prints ``30000`` not ``30000.0``) and
    non-finite floats become ``None`` (JS prints ``null``).
    """
    if isinstance(value, bool) or value is None or isinstance(value, (int, str)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        if value.is_integer() and abs(value) < 2**53:
            return int(value)
        return value
    if isinstance(value, dict):
        return {k: to_js_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_js_json(v) for v in value]
    raise TypeError(f"Unsupported type in result: {type(value).__name__}")
