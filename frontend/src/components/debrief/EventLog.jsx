import { EVENT_DISPLAY, eventEffect } from '../../model/eventDisplay.js';

const PHASE = {
  burn: 'burn',
  outbound: 'outbound cruise',
  surface: 'on Mars',
  return: 'return cruise',
};

/** Every seeded event over the whole mission (outbound, surface, return), per vehicle. */
export default function EventLog({ rockets, seed }) {
  const flying = rockets.filter((r) => !r.failed);
  const total = flying.reduce((s, r) => s + r.events.length, 0);
  return (
    <section className="event-log" aria-labelledby="event-log-title">
      <h3 id="event-log-title">Mission events (gameplay model, seed {seed})</h3>
      {total === 0 ? (
        <p className="small text-muted">No events were drawn for this seed and risk level.</p>
      ) : (
        flying
          .filter((r) => r.events.length > 0)
          .map((r) => (
            <div key={r.key} className="event-log__vehicle">
              <h4 className="event-log__name">
                <span className="swatch" style={{ '--swatch': r.color }} aria-hidden="true" />{' '}
                {r.label}
                {r.aborted && <span className="text-danger">: aborted</span>}
              </h4>
              <ul className="event-log__list">
                {r.events.map((e) => (
                  <li key={e.id}>
                    <span aria-hidden="true">{EVENT_DISPLAY[e.type]?.icon} </span>
                    Day {Math.round(e.day)} (
                    {e.burn ? `${e.burn.toUpperCase()} burn` : PHASE[e.phase]}): {e.label},{' '}
                    {eventEffect(e)}
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
      <p className="small text-subtle">
        Event odds are illustrative and scale with risk tolerance. Solar-event doses are included in
        the mission dose; engine faults draw on the Δv reserve. The trajectory never depends on the
        seed.
      </p>
    </section>
  );
}
