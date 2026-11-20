/**
 * Physical constants and reference parameters for the Mars mission model.
 *
 * Everything here is in SI units (m, s, kg, m/s, Sv) unless the name says
 * otherwise. Convert only for display (see units.js).
 *
 * Sources (abbreviations used in comments below):
 *   [IAU12]  IAU 2012 Resolution B2 (astronomical unit, exact definition).
 *   [IAU15]  IAU 2015 Resolution B3 / JPL DE430: nominal solar GM.
 *   [NSSDC]  NASA Goddard NSSDC planetary fact sheets (Earth, Mars),
 *            https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 *   [WGS84]  World Geodetic System 1984 (Earth GM and equatorial radius).
 *   [STD]    E. M. Standish, "Keplerian Elements for Approximate Positions of
 *            the Major Planets", JPL Solar System Dynamics (valid 1800–2050).
 *   [DRA5]   NASA Mars Design Reference Architecture 5.0, NASA-SP-2009-566
 *            and Addendum NASA-SP-2009-566-ADD (2009).
 *   [RAD13]  Zeitlin et al., "Measurements of Energetic Particle Radiation in
 *            Transit to Mars on the Mars Science Laboratory", Science 340,
 *            1080 (2013). Cruise dose equivalent rate 1.84 ± 0.33 mSv/day.
 *   [RAD14]  Hassler et al., "Mars' Surface Radiation Environment Measured
 *            with the Mars Science Laboratory's Curiosity Rover", Science 343
 *            (2014). Surface dose equivalent rate 0.64 ± 0.12 mSv/day.
 *   [STD3001] NASA-STD-3001 Vol. 1 Rev. B/C (2022–2023): 600 mSv career
 *            effective-dose limit for all astronauts.
 */

/* ── Fundamental / unit constants ───────────────────────────────────────── */

/** Standard gravity g0 [m/s²]; exact by definition (CGPM 1901). Used for Isp → exhaust velocity. */
export const G0 = 9.80665;

/** Astronomical unit [m]; exact [IAU12]. */
export const AU = 1.495978707e11;

/** One day [s]. */
export const DAY = 86400;

/** Julian year [s] (365.25 days). */
export const JULIAN_YEAR = 365.25 * DAY;

/* ── Gravitational parameters μ = GM [m³/s²] ────────────────────────────── */

/** Sun [IAU15]. */
export const MU_SUN = 1.32712440018e20;

/** Earth [WGS84]. */
export const MU_EARTH = 3.986004418e14;

/** Mars: 42,828.37 km³/s² [NSSDC]. */
export const MU_MARS = 4.282837e13;

/* ── Planet radii [m] ───────────────────────────────────────────────────── */

/** Earth equatorial radius [WGS84]. */
export const R_EARTH = 6.378137e6;

/** Mars equatorial radius 3,396.2 km [NSSDC]. */
export const R_MARS = 3.3962e6;

/* ── Circular, coplanar reference orbits ────────────────────────────────── */
/*
 * Textbook approximation: both planets on circular orbits in the same plane,
 * with radius equal to the orbit's semi-major axis. Used for the reference
 * Hohmann numbers (≈259-day transfer, v∞ ≈ 2.94 / 2.65 km/s) and the tests.
 * The launch-window model (ephemeris.js) improves on this by using Mars'
 * real eccentric orbit, see README.
 */

/** Earth semi-major axis 149.598 × 10⁶ km [NSSDC]. */
export const R_EARTH_ORBIT = 149.598e9;

/** Mars semi-major axis 227.956 × 10⁶ km [NSSDC]. */
export const R_MARS_ORBIT = 227.956e9;

/** Earth sidereal orbital period 365.256 days [NSSDC]. */
export const EARTH_ORBITAL_PERIOD = 365.256 * DAY;

/** Mars sidereal orbital period 686.980 days [NSSDC]. */
export const MARS_ORBITAL_PERIOD = 686.98 * DAY;

/* ── Mean orbital elements at J2000 [STD], ecliptic plane ───────────────── */
/*
 * a in AU, angles in degrees, rates per Julian century. Inclination is
 * ignored by this model (Mars' orbit is tilted only 1.85° to the ecliptic).
 */

/** J2000.0 epoch (2000-01-01 12:00 TT ≈ UTC for this purpose) [ms since Unix epoch]. */
export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** Earth–Moon barycentre mean elements [STD]. */
export const EARTH_ELEMENTS = Object.freeze({
  a: 1.00000261,
  e: 0.01671123,
  meanLongitude: 100.46457166,
  meanLongitudeRate: 35999.37244981,
  longitudePerihelion: 102.93768193,
  longitudePerihelionRate: 0.32327364,
});

/** Mars mean elements [STD]. */
export const MARS_ELEMENTS = Object.freeze({
  a: 1.52371034,
  e: 0.0933941,
  meanLongitude: -4.55343205,
  meanLongitudeRate: 19140.30268499,
  longitudePerihelion: -23.94362959,
  longitudePerihelionRate: 0.44441088,
});

/* ── Parking / capture orbits ───────────────────────────────────────────── */

/** Earth departure from a 400 km circular LEO (ISS-like altitude; an assumption, not from a source). */
export const LEO_ALTITUDE = 400e3;

/**
 * Mars capture into an elliptical 1-sol orbit, 250 km × 33,793 km altitude,
 * the crew-vehicle capture orbit used in [DRA5]. Capturing into a loose
 * ellipse costs far less Δv than a low circular orbit.
 */
export const MARS_CAPTURE_PERIAPSIS_ALTITUDE = 250e3;
export const MARS_CAPTURE_APOAPSIS_ALTITUDE = 33793e3;

/** Altitude where atmospheric entry/aerocapture is assumed to begin at Mars (≈125 km, common convention). */
export const MARS_ENTRY_INTERFACE_ALTITUDE = 125e3;

/* ── Radiation and crew ─────────────────────────────────────────────────── */

const MSV_PER_DAY = 1e-3 / DAY; // Sv/s per (mSv/day)

/** Deep-space GCR dose-equivalent rate behind MSL cruise-stage shielding, 1.84 mSv/day [RAD13], in Sv/s. */
export const GCR_CRUISE_DOSE_RATE = 1.84 * MSV_PER_DAY;

/** Mars surface dose-equivalent rate, 0.64 mSv/day [RAD14], in Sv/s. */
export const MARS_SURFACE_DOSE_RATE = 0.64 * MSV_PER_DAY;

/** Career effective-dose limit 600 mSv [STD3001], in Sv. */
export const CAREER_DOSE_LIMIT = 0.6;
