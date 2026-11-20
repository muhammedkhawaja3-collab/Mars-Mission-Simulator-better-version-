/** Display metadata for the engine's seeded event types (gameplay model). */
import { toMilliSieverts } from '../physics/index.js';

export const EVENT_DISPLAY = Object.freeze({
  'solar-particle-event': { icon: '☀', short: 'Solar event', tone: 'warning' },
  'engine-fault': { icon: '⚙', short: 'Engine fault', tone: 'danger' },
  micrometeoroid: { icon: '✶', short: 'Micrometeoroid', tone: 'info' },
  'comms-blackout': { icon: '⌁', short: 'Comms blackout', tone: 'info' },
});

/** One-line effect summary with units, e.g. "+8.2 mSv". */
export function eventEffect(e) {
  const fx = e.effects;
  if (fx.extraDose > 0) return `+${toMilliSieverts(fx.extraDose).toFixed(1)} mSv`;
  if (fx.deltaVPenalty > 0) return `+${(fx.deltaVPenalty / 1000).toFixed(2)} km/s Δv`;
  if (fx.consumablesLossKg > 0) return `−${fx.consumablesLossKg.toFixed(0)} kg consumables`;
  if (fx.commsOutageDays > 0) return `${fx.commsOutageDays} d without contact`;
  return '';
}
