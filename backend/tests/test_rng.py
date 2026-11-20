"""mulberry32 must be bit-exact with the JS implementation (frontend/src/physics/rng.js)."""

from __future__ import annotations

import pytest

from app.physics.jscompat import RangeError
from app.physics.rng import create_rng, mulberry32, validate_seed

# Reference outputs from the JS implementation (pinned in __tests__/events.test.js).
SEED_42_FIRST_FIVE = [
    0.6011037519201636,
    0.44829055899754167,
    0.8524657934904099,
    0.6697340414393693,
    0.17481389874592423,
]


def test_seed_42_first_five_outputs_are_bit_exact() -> None:
    nxt = mulberry32(42)
    assert [nxt() for _ in range(5)] == SEED_42_FIRST_FIVE


def test_same_seed_same_sequence_and_range() -> None:
    a, b = mulberry32(2**32 - 1), mulberry32(2**32 - 1)
    values = [a() for _ in range(1000)]
    assert values == [b() for _ in range(1000)]
    assert all(0 <= v < 1 for v in values)


def test_helpers_consume_one_draw_each() -> None:
    rng, ref = create_rng(7), mulberry32(7)
    r1 = ref()
    assert rng.uniform(10, 20) == 10 + 10 * r1
    r2 = ref()
    assert rng.int(1, 14) == 1 + int(r2 * 14)
    r3 = ref()
    assert rng.chance(0.5) is (r3 < 0.5)


@pytest.mark.parametrize("bad", [-1, 2**32, 1.5, True, "42", None])
def test_invalid_seeds_rejected(bad) -> None:
    with pytest.raises(RangeError):
        validate_seed(bad)
