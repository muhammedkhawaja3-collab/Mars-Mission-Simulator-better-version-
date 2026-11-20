import { describe, it, expect } from 'vitest';
import { WINDOWS, WINDOW_IDS, DEFAULT_WINDOW_ID, BEST_WINDOW_ID, computeWindowTable, getWindow } from '../windows.js';
import { simulateMission } from '../mission.js';

const ms = (iso) => new Date(iso).getTime();

describe('fixed launch-window table', () => {
  it('stored table equals the ephemeris computation', () => {
    const computed = computeWindowTable();
    expect(computed.map((w) => w.id)).toEqual(WINDOWS.map((w) => w.id));
    computed.forEach((c, i) => {
      const s = WINDOWS[i];
      expect(c.label).toBe(s.label);
      expect(c.oppositionYear).toBe(s.oppositionYear);
      for (const k of ['departureDate', 'arrivalDate', 'oppositionDate']) expect(Math.abs(ms(c[k]) - ms(s[k]))).toBeLessThan(1000);
      for (const k of ['hohmannTimeOfFlight', 'vInfDeparture', 'vInfArrival']) expect(c[k]).toBeCloseTo(s[k], 3);
    });
  });

  it('IDs match the departure month, and departures precede their opposition', () => {
    expect(WINDOWS.map((w) => w.id)).toEqual([...WINDOW_IDS]);
    for (const w of WINDOWS) {
      expect(w.departureDate.slice(0, 7)).toBe(w.id);
      expect(ms(w.departureDate)).toBeLessThan(ms(w.oppositionDate));
      expect(w.label).toBe(`${w.oppositionYear} window`);
    }
    expect(WINDOWS.map((w) => w.oppositionYear)).toEqual([2027, 2029, 2031, 2033, 2035]);
  });

  it('computed oppositions match published dates to within a day', () => {
    const published = ['2027-02-19', '2029-03-25', '2031-05-04', '2033-06-27', '2035-09-15'];
    WINDOWS.forEach((w, i) => expect(Math.abs(ms(w.oppositionDate) - ms(published[i]))).toBeLessThan(1.5 * 86400e3));
  });

  it('default and best windows are in the table; unknown IDs throw', () => {
    expect(getWindow(DEFAULT_WINDOW_ID).id).toBe('2028-12');
    expect(WINDOW_IDS).toContain(BEST_WINDOW_ID);
    expect(() => getWindow('2030-01')).toThrow(RangeError);
  });

  it('simulateMission({windowId}) flies that window, and defaults to DEFAULT_WINDOW_ID', () => {
    for (const w of WINDOWS) {
      const m = simulateMission({ vehicle: 'chemical', windowId: w.id, transferChoice: { kind: 'hohmann' } });
      expect(m.windowId).toBe(w.id);
      expect(Math.abs(ms(m.departureDate) - ms(w.departureDate))).toBeLessThan(1000);
      expect(m.transitTime).toBeCloseTo(w.hohmannTimeOfFlight, 0);
    }
    expect(simulateMission({ vehicle: 'chemical' }).windowId).toBe(DEFAULT_WINDOW_ID);
  });
});
