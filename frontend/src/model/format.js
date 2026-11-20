/** Display formatting helpers (no physics). */
import {
  toDays,
  toMilliSieverts,
  toTonnes,
  toBillionUsd,
  toKmPerSecond,
} from '../physics/index.js';

/** Round to `digits` decimals and return a number. */
export const round = (v, digits = 1) => +Number(v).toFixed(digits);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** "Dec 2028" from an ISO date string (UTC). */
export const fmtMonth = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Thrust in kN → readable string (electric thrusters are shown in N). */
export const fmtThrust = (kN) => {
  if (kN >= 1000) return `${(kN / 1000).toFixed(1)} MN`;
  if (kN >= 1) return `${kN} kN`;
  return `${+(kN * 1000).toPrecision(3)} N`;
};

/** Compact number for tables and bars. */
export const fmtValue = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) > 99999) return `${(n / 1000).toFixed(0)}k`;
  if (Math.abs(n) > 999) return n.toFixed(0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

/** Formats a value from physics/tradeoffs.js (SI) for display. */
export const fmtTradeoff = (key, v) => {
  switch (key) {
    case 'transitTime':
      return `${toDays(v).toFixed(0)} d`;
    case 'missionDose':
      return `${toMilliSieverts(v).toFixed(0)} mSv`;
    case 'initialMassInLEO':
      return `${toTonnes(v).toFixed(0)} t`;
    case 'launches':
      return `${v}×`;
    case 'cost':
      return `$${toBillionUsd(v).toFixed(2)}B`;
    case 'success':
      return `${(v * 100).toFixed(1)}%`;
    case 'deltaVReserve':
      return `${toKmPerSecond(v).toFixed(2)} km/s`;
    default:
      return String(v);
  }
};

/** Status tone for a dose in mSv (used for text colour plus a word, never colour alone). */
export const doseTone = (mSv) => (mSv < 200 ? 'success' : mSv < 350 ? 'warning' : 'danger');

export const riskLabel = (risk) =>
  risk <= 3 ? 'Conservative' : risk <= 6 ? 'Balanced' : 'Aggressive';
