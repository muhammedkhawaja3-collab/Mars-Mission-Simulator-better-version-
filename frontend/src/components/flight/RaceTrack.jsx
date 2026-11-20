import RocketGlyph from './RocketGlyph.jsx';
import { statusText } from './statusText.js';
import './RaceTrack.css';

const TICKS = [0.25, 0.5, 0.75];

/**
 * 2D race view: one lane per vehicle, Earth on the left, Mars on the right.
 * Each lane's position is the fraction of that vehicle's own transfer flown,
 * so lanes work for any number of vehicles. Status is always given as text.
 */
export default function RaceTrack({ rockets, states, trackMkm }) {
  return (
    <figure className="race" aria-labelledby="race-caption">
      <figcaption id="race-caption" className="visually-hidden">
        Race view: progress of each vehicle from Earth to Mars.
      </figcaption>
      <div className="race__scale" aria-hidden="true">
        <span className="race__body race__body--earth">Earth</span>
        {TICKS.map((t) => (
          <span key={t} className="race__tick" style={{ '--at': t }}>
            {trackMkm ? `${Math.round(trackMkm * t)} M km` : `${t * 100}%`}
          </span>
        ))}
        <span className="race__body race__body--mars">Mars</span>
      </div>
      <ol className="race__lanes">
        {rockets.map((r) => {
          const s = states[r.key];
          return (
            <li key={r.key} className="lane" data-status={s.status} style={{ '--lane': r.color }}>
              <span className="lane__label">
                <span className="swatch" style={{ '--swatch': r.color }} aria-hidden="true" />
                {r.label}
              </span>
              <span className="lane__track" aria-hidden="true">
                <span className="lane__runner" style={{ '--progress': s.progress }}>
                  <span className="lane__ship">
                    <span className="lane__plume" />
                    <RocketGlyph className="lane__glyph" />
                  </span>
                </span>
              </span>
              <span className="lane__status">{statusText(r, s)}</span>
            </li>
          );
        })}
      </ol>
      <p className="race__note">
        Track = transfer arc (longest {trackMkm || 0} M km). All vehicles depart on day 0; each lane
        shows the share of its own transfer flown.
      </p>
    </figure>
  );
}
