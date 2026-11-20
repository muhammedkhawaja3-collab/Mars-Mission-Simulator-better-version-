import { doseSoFar, outboundEventsUntil, propellantRemaining } from '../../model/flight.js';
import { doseTone } from '../../model/format.js';
import { EVENT_DISPLAY, eventEffect } from '../../model/eventDisplay.js';
import Card from '../ui/Card.jsx';
import Stat, { StatGrid } from '../ui/Stat.jsx';
import { statusText } from './statusText.js';
import './TelemetryCard.css';

/** Live readout for one vehicle during the replay. */
export default function TelemetryCard({ rocket, state }) {
  const titleId = `telemetry-${rocket.key}`;
  const arrived = state.status === 'arrived';
  const events = outboundEventsUntil(rocket, state.day);
  return (
    <Card as="article" accent={rocket.color} className="telemetry" aria-labelledby={titleId}>
      <div className="telemetry__head">
        <h3 id={titleId} className="telemetry__title">
          <span className="swatch" style={{ '--swatch': rocket.color }} aria-hidden="true" />
          {rocket.label}
        </h3>
        <span className="telemetry__status" data-status={state.status}>
          {statusText(rocket, state)}
        </span>
      </div>
      {rocket.failed ? (
        <p className="telemetry__fail">{rocket.failReason}</p>
      ) : (
        <>
          <StatGrid>
            <Stat
              label="Distance"
              value={`${(rocket.pathMkm * state.progress).toFixed(1)} / ${rocket.pathMkm} M km`}
            />
            <Stat
              label="Radiation"
              value={`${doseSoFar(rocket, state.day).toFixed(1)} mSv`}
              tone={doseTone(doseSoFar(rocket, state.day))}
            />
            <Stat
              label="Propellant"
              value={`${(propellantRemaining(rocket, state.day, { arrived }) / 1000).toFixed(0)} t`}
            />
            <Stat label="Crew health" value={`${rocket.crewHealth}/100`} />
          </StatGrid>
          {events.length > 0 && (
            <ul className="telemetry__events" aria-label={`Events for ${rocket.label}`}>
              {events.map((e) => (
                <li key={e.id} className="event-tag" data-tone={EVENT_DISPLAY[e.type]?.tone}>
                  <span aria-hidden="true">{EVENT_DISPLAY[e.type]?.icon} </span>
                  {EVENT_DISPLAY[e.type]?.short ?? e.label}, day {Math.round(e.day)}:{' '}
                  {eventEffect(e)}
                </li>
              ))}
            </ul>
          )}
          <span
            className="telemetry__bar"
            style={{ '--progress': state.progress }}
            aria-hidden="true"
          />
        </>
      )}
    </Card>
  );
}
