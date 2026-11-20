"""Seeded pseudo-random numbers for the gameplay event model.

Mirror of ``frontend/src/physics/rng.js``.

mulberry32 (Tommy Ettinger, public domain): a 32-bit state generator, small
and fast, with good enough statistics for gameplay. Every step is 32-bit
unsigned arithmetic, so it ports bit-exactly: ``& 0xFFFFFFFF`` after each
add/multiply, and JS ``Math.imul`` is emulated as ``(a * b) & 0xFFFFFFFF`` on
unsigned values (the low 32 bits are the same whether the operands are read
as signed or unsigned).

The same seed always gives the same sequence. The physics model itself never
uses randomness; only events.py does.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

from .jscompat import RangeError

UINT32_MAX = 0xFFFFFFFF
_MASK = 0xFFFFFFFF


def validate_seed(seed: int) -> int:
    """Validate a seed: an integer 0 … 2³² − 1. Returns it unchanged; raises RangeError."""
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0 or seed > UINT32_MAX:
        raise RangeError(f"seed must be an integer 0–{UINT32_MAX} (got {seed})")
    return seed


def mulberry32(seed: int) -> Callable[[], float]:
    """mulberry32 generator, bit-exact with the JS version.

    Reference algorithm, all values unsigned 32-bit::

        state = state + 0x6D2B79F5
        t = state
        t = (t ^ (t >> 15)) * (t | 1)
        t = t ^ (t + (t ^ (t >> 7)) * (t | 61))
        out = (t ^ (t >> 14)) / 2³²

    Returns a function producing floats in [0, 1).
    """
    state = validate_seed(seed) & _MASK

    def next_() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & _MASK
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & _MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & _MASK)) & _MASK)) & _MASK
        return ((t ^ (t >> 14)) & _MASK) / 4294967296

    return next_


@dataclass(frozen=True)
class Rng:
    """Convenience wrapper around mulberry32. Each helper consumes exactly one draw."""

    next: Callable[[], float]

    def uniform(self, lo: float, hi: float) -> float:
        """Float in [lo, hi)."""
        return lo + (hi - lo) * self.next()

    def int(self, lo: int, hi: int) -> int:
        """Integer in [lo, hi] (inclusive)."""
        return lo + math.floor(self.next() * (hi - lo + 1))

    def chance(self, p: float) -> bool:
        """True with probability p."""
        return self.next() < p


def create_rng(seed: int) -> Rng:
    """mulberry32 with helpers; call order defines the sequence."""
    return Rng(mulberry32(seed))
