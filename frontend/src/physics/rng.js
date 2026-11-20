/**
 * Seeded pseudo-random numbers for the gameplay event model.
 *
 * mulberry32 (Tommy Ettinger, public domain): a 32-bit state generator,
 * small and fast, with good enough statistics for gameplay. It is written
 * so it ports bit-exactly to other languages: every step is 32-bit unsigned
 * arithmetic. In Python, use `& 0xFFFFFFFF` after each add/multiply, and
 * emulate Math.imul as `(a * b) & 0xFFFFFFFF` on unsigned values (the low 32
 * bits are the same whether the operands are read as signed or unsigned).
 *
 * The same seed always gives the same sequence. The physics model itself
 * never uses randomness; only events.js does.
 */

const UINT32_MAX = 0xffffffff;

/**
 * Validates a seed: an integer 0 … 2³² − 1.
 * @param {number} seed
 * @returns {number} The seed, unchanged.
 * @throws {RangeError}
 */
export function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`seed must be an integer 0–${UINT32_MAX} (got ${seed})`);
  }
  return seed;
}

/**
 * mulberry32 generator.
 *
 * Reference algorithm, all values unsigned 32-bit:
 *   state = state + 0x6D2B79F5
 *   t = state
 *   t = (t ^ (t >> 15)) * (t | 1)
 *   t = t ^ (t + (t ^ (t >> 7)) * (t | 61))
 *   out = (t ^ (t >> 14)) / 2³²
 *
 * @param {number} seed Integer 0 … 2³² − 1.
 * @returns {() => number} Function returning floats in [0, 1).
 */
export function mulberry32(seed) {
  let state = validateSeed(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ ((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convenience wrapper around mulberry32 with a few helpers. Each helper
 * consumes exactly one draw, so call order defines the sequence.
 * @param {number} seed Integer 0 … 2³² − 1.
 */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    /** Float in [0, 1). */
    next,
    /** Float in [lo, hi). */
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    /** Integer in [lo, hi] (inclusive). */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
  };
}
