import { getWindow } from '../../physics/index.js';
import { transferOptionFor } from '../../model/fleet.js';
import TradeoffList from './TradeoffList.jsx';
import EventLog from './EventLog.jsx';
import './Insights.css';

const pctLower = (a, b) => Math.round((1 - a / b) * 100);

/** Generated, neutral insights: no vehicle is assumed to win. */
export default function Insights({ rockets, config }) {
  const flying = rockets.filter((r) => !r.failed);
  const failed = rockets.filter((r) => r.failed);
  const fastest = flying.length ? flying.reduce((a, b) => (b.transit < a.transit ? b : a)) : null;
  const slowest = flying.length ? flying.reduce((a, b) => (b.transit > a.transit ? b : a)) : null;
  const win = getWindow(config.windowId);
  return (
    <div className="insights">
      <section aria-labelledby="insights-title">
        <h3 id="insights-title" className="insights__title">
          Trade-offs: {win.label} · {transferOptionFor(config.transferChoice).label} ·{' '}
          {config.crewSize} crew
        </h3>
        <TradeoffList rockets={rockets} />
        <ul className="insights__list">
          {fastest && slowest && fastest !== slowest && (
            <li>
              <strong>{fastest.label}</strong> arrives{' '}
              {(slowest.transit - fastest.transit).toFixed(0)} days before {slowest.label} (
              {fastest.transit} d vs {slowest.transit} d). Its outbound dose is{' '}
              {pctLower(fastest.radiation, slowest.radiation)}% lower, but its round-trip dose is
              only {pctLower(fastest.missionDose, slowest.missionDose)}% lower: a faster outbound
              leg means waiting longer on Mars ({fastest.surfaceStay} d vs {slowest.surfaceStay} d)
              for the planets to line up for the return.{' '}
              <em className="text-subtle">
                Model: conjunction-class phasing; RAD cruise 1.84 mSv/day, surface 0.64 mSv/day.
              </em>
            </li>
          )}
          {flying.map((r) => (
            <li key={r.key}>
              <strong>{r.label}:</strong> Δv {r.deltaVDeparture} km/s departure + {r.deltaVCapture}{' '}
              km/s capture{r.deltaVCapture === 0 ? ' (aerocapture)' : ''} · Isp {r.isp} s →{' '}
              {r.propellantT} t propellant · {r.imleo} t in LEO · {r.launches} launch
              {r.launches > 1 ? 'es' : ''} · ${r.cost}B (est.) · {r.abortDv} km/s spare Δv · success{' '}
              {r.success}% (heuristic)
            </li>
          ))}
          {failed.map((r) => (
            <li key={r.key} className="text-danger">
              <strong>{r.label} cannot fly this mission:</strong> {r.failReason}
            </li>
          ))}
          {flying.length > 0 && (
            <li>
              Every crew in this scenario receives{' '}
              {Math.min(...flying.map((r) => r.careerRadPct)).toFixed(0)}–
              {Math.max(...flying.map((r) => r.careerRadPct)).toFixed(0)}% of NASA&apos;s 600 mSv
              career limit over the full mission. With today&apos;s shielding, radiation is a
              problem for every propulsion choice, not just the slow ones.{' '}
              <em className="text-subtle">
                Sources: Zeitlin et al., Science 340:1080 (2013); Hassler et al., Science 343
                (2014); NASA-STD-3001.
              </em>
            </li>
          )}
        </ul>
        <p className="small text-subtle">
          Success and crew-health figures are simplified heuristics (products of assumed
          reliabilities and an illustrative dose/zero-g score), not engineering predictions. Vehicle
          masses and costs marked “est.” are estimates; see src/physics/README.md.
        </p>
      </section>

      <EventLog rockets={rockets} seed={config.seed} />

      <section className="insights__sources" aria-labelledby="sources-title">
        <h3 id="sources-title">Data sources</h3>
        <p className="small text-muted">
          NASA NSSDC planetary fact sheets (μ, radii, orbits) · JPL/Standish Keplerian elements
          (planet positions) · NASA DRA 5.0, NASA-SP-2009-566 (capture orbit, NTR Isp 900 s) ·
          Rover/NERVA ground tests (≈ 850 s) · Aerojet Rocketdyne RL10 (Isp ≈ 460 s) · SpaceX
          Starship (1,200 t, Raptor Vac ≈ 380 s) · NASA OIG IG-22-003 (SLS ≈ $2.2B/launch) · NASA
          SLS fact sheets (Block 1 95 t, Block 2 130 t to LEO) · SpaceX Falcon Heavy (63.8 t) · Blue
          Origin New Glenn (45 t) · Curiosity RAD: Zeitlin et al. 2013 (1.84 mSv/day cruise),
          Hassler et al. 2014 (0.64 mSv/day surface), RAD solar particle events (1.2–19.5 mSv) ·
          NASA-STD-3001 (600 mSv career limit) · NASA BVAD Rev2, NASA/TP-2015-218570 Tables 3-31 &
          4-20 (food, water, O₂) · NASA ISS ECLSS water recovery (93–98%) · Tsiolkovsky 1903.
        </p>
      </section>
    </div>
  );
}
