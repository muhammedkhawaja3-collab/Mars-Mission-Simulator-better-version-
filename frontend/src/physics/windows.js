/**
 * Fixed Earth→Mars launch windows with stable IDs.
 *
 * Share links and saved plans refer to a window by ID (e.g. '2028-12'),
 * never "the next window from today", so a link opens the same mission
 * forever. The table stores the values the ephemeris computes for the
 * minimum-energy (Hohmann-type) transfer in each window;
 * __tests__/windows.test.js recomputes them and checks they still match.
 *
 * Labels: the ID is the departure month. Each window is labelled by the year
 * of the Mars opposition it leads up to, e.g. the window departing November
 * 2026 precedes the February 2027 opposition, so it is the "2027 window"
 * (the UI always shows the departure month next to it). Departures come
 * 2–4 months before opposition because the ship must leave while Earth
 * trails Mars by ≈ 44° (see ephemeris.js). The computed opposition dates
 * (19 Feb 2027, 25 Mar 2029, 4 May 2031, 28 Jun 2033, 15 Sep 2035) agree
 * with published opposition dates to within a day.
 *
 * Regenerate after any ephemeris change with `computeWindowTable()` and
 * paste the result (the test prints the difference if they drift).
 */
import { DAY } from './constants.js';
import { solveTransferWindow, earthState, marsState, wrapToPi } from './ephemeris.js';
import { EARTH_ORBITAL_PERIOD, MARS_ORBITAL_PERIOD } from './constants.js';

/**
 * @typedef {object} LaunchWindowEntry
 * @property {string} id                 Departure month 'YYYY-MM' (stable key).
 * @property {string} label              Opposition-year label, e.g. '2027 window'.
 * @property {number} oppositionYear     UTC year of the Mars opposition the window precedes.
 * @property {string} departureDate      ISO date-time of the Hohmann-type departure (computed).
 * @property {string} arrivalDate        ISO date-time of arrival (computed).
 * @property {string} oppositionDate     ISO date-time when Earth and Mars share a heliocentric longitude (computed).
 * @property {number} hohmannTimeOfFlight [s]
 * @property {number} vInfDeparture      [m/s]
 * @property {number} vInfArrival        [m/s]
 */

/** IDs of the fixed windows, in order. Decision 4 in PLAN.md. */
export const WINDOW_IDS = Object.freeze(['2026-11', '2028-12', '2031-01', '2033-03', '2035-07']);

/**
 * Default window. The 2026–27 window is already open at the time of writing
 * (November 2026), so the default is the next full window.
 */
export const DEFAULT_WINDOW_ID = '2028-12';

/**
 * Computed table. DO NOT edit by hand: regenerate with computeWindowTable().
 * @type {ReadonlyArray<Readonly<LaunchWindowEntry>>}
 */
export const WINDOWS = Object.freeze([
  /* WINDOW_TABLE_START */
  {
    id: '2026-11',
    label: '2027 window',
    oppositionYear: 2027,
    departureDate: '2026-11-04T17:31:01.714Z',
    arrivalDate: '2027-07-27T13:40:52.112Z',
    oppositionDate: '2027-02-19T15:27:07.499Z',
    hohmannTimeOfFlight: 22882190.397465378,
    vInfDeparture: 3116.9124199806547,
    vInfArrival: 3162.575656222396,
  },
  {
    id: '2028-12',
    label: '2029 window',
    oppositionYear: 2029,
    departureDate: '2028-12-06T02:22:21.666Z',
    arrivalDate: '2029-08-14T18:07:20.033Z',
    oppositionDate: '2029-03-25T06:43:54.149Z',
    hohmannTimeOfFlight: 21743098.36647102,
    vInfDeparture: 2714.8784683898716,
    vInfArrival: 3578.8635518352016,
  },
  {
    id: '2031-01',
    label: '2031 window',
    oppositionYear: 2031,
    departureDate: '2031-01-16T09:35:17.878Z',
    arrivalDate: '2031-09-12T13:55:55.643Z',
    oppositionDate: '2031-05-04T11:31:18.658Z',
    hohmannTimeOfFlight: 20665237.764370494,
    vInfDeparture: 2325.1919279911754,
    vInfArrival: 3539.6551961628797,
  },
  {
    id: '2033-03',
    label: '2033 window',
    oppositionYear: 2033,
    departureDate: '2033-03-30T09:44:07.136Z',
    arrivalDate: '2033-11-25T10:44:55.168Z',
    oppositionDate: '2033-06-28T02:26:39.694Z',
    hohmannTimeOfFlight: 20739648.03289241,
    vInfDeparture: 2437.9375195055773,
    vInfArrival: 3404.9471703514955,
  },
  {
    id: '2035-07',
    label: '2035 window',
    oppositionYear: 2035,
    departureDate: '2035-07-08T01:31:43.865Z',
    arrivalDate: '2036-04-07T03:17:19.719Z',
    oppositionDate: '2035-09-15T19:21:14.744Z',
    hohmannTimeOfFlight: 23679935.85307229,
    vInfDeparture: 3393.851799593184,
    vInfArrival: 2740.193393652407,
  },
  /* WINDOW_TABLE_END */
].map(Object.freeze));

/**
 * Finds the Mars opposition (Earth and Mars at the same heliocentric
 * longitude) nearest a date, by Newton steps on the longitude difference.
 * @param {Date} nearDate
 * @returns {Date}
 */
export function solveOpposition(nearDate) {
  const relativeRate = (2 * Math.PI) / EARTH_ORBITAL_PERIOD - (2 * Math.PI) / MARS_ORBITAL_PERIOD; // rad/s
  let t = nearDate.getTime();
  for (let i = 0; i < 100; i++) {
    const d = new Date(t);
    const diff = wrapToPi(earthState(d).longitude - marsState(d).longitude);
    if (Math.abs(diff) < 1e-10) break;
    t -= (diff / relativeRate) * 1000;
  }
  return new Date(t);
}

/**
 * Recomputes every window entry from the ephemeris.
 * @returns {LaunchWindowEntry[]}
 */
export function computeWindowTable() {
  return WINDOW_IDS.map((id) => {
    const [y, m] = id.split('-').map(Number);
    const w = solveTransferWindow({ transfer: { kind: 'hohmann' }, nearDate: new Date(Date.UTC(y, m - 1, 1)) });
    const opposition = solveOpposition(new Date(w.departureDate.getTime() + 90 * DAY * 1000));
    const oppositionYear = opposition.getUTCFullYear();
    return {
      id,
      label: `${oppositionYear} window`,
      oppositionYear,
      departureDate: w.departureDate.toISOString(),
      arrivalDate: w.arrivalDate.toISOString(),
      oppositionDate: opposition.toISOString(),
      hohmannTimeOfFlight: w.timeOfFlight,
      vInfDeparture: w.vInfDeparture,
      vInfArrival: w.vInfArrival,
    };
  });
}

/**
 * Looks up a window by ID.
 * @param {string} id
 * @returns {Readonly<LaunchWindowEntry>}
 * @throws {RangeError} For an unknown ID.
 */
export function getWindow(id) {
  const w = WINDOWS.find((x) => x.id === id);
  if (!w) throw new RangeError(`Unknown windowId: ${String(id)} (expected one of ${WINDOW_IDS.join(', ')})`);
  return w;
}

/**
 * The window with the lowest minimum-energy v∞ sum (departure + arrival),
 * i.e. the cheapest of the fixed windows. Used by the "Perfect Window"
 * achievement.
 */
export const BEST_WINDOW_ID = WINDOWS.length
  ? WINDOWS.reduce((best, w) => (w.vInfDeparture + w.vInfArrival < best.vInfDeparture + best.vInfArrival ? w : best)).id
  : null;
