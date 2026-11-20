import { useCallback, useEffect, useMemo, useState } from 'react';
import { FLIGHT_REPLAY_MS } from '../../model/catalog.js';
import { fleetStates, maxTransitDays, outboundEventsUntil } from '../../model/flight.js';
import { eventEffect } from '../../model/eventDisplay.js';
import useRafClock from '../../hooks/useRafClock.js';
import { actions } from '../../state/missionReducer.js';
import {
  useAnnounce,
  useMissionDispatch,
  useMissionResults,
  useMissionState,
} from '../../state/context.js';
import Button from '../ui/Button.jsx';
import { Tabs, TabPanel } from '../ui/Tabs.jsx';
import RaceTrack from './RaceTrack.jsx';
import Cockpit from './Cockpit.jsx';
import TelemetryCard from './TelemetryCard.jsx';
import './FlightView.css';

const VIEWS = [
  { id: 'race', label: 'Race track' },
  { id: 'cockpit', label: 'Cockpit view' },
];

/**
 * Phase 2: the transit replay. The rAF clock lives here, so its updates
 * re-render only this subtree. Pause/skip satisfy WCAG 2.2.2 for moving content.
 */
export default function FlightView({ now }) {
  const { ui } = useMissionState();
  const { rockets } = useMissionResults();
  const dispatch = useMissionDispatch();
  const announce = useAnnounce();
  const [paused, setPaused] = useState(false);

  const onComplete = useCallback(() => dispatch(actions.flightDone()), [dispatch]);
  const { fraction, skipToEnd } = useRafClock({
    durationMs: FLIGHT_REPLAY_MS,
    running: !paused,
    onComplete,
    now,
  });

  const maxTransit = useMemo(() => maxTransitDays(rockets), [rockets]);
  const states = useMemo(() => fleetStates(rockets, fraction), [rockets, fraction]);
  const trackMkm = useMemo(
    () => Math.max(0, ...rockets.filter((r) => !r.failed).map((r) => r.pathMkm)),
    [rockets],
  );

  const latestEvent = useMemo(() => {
    const all = rockets.flatMap((r) =>
      outboundEventsUntil(r, states[r.key].day).map((e) => ({ ...e, rocket: r })),
    );
    all.sort((a, b) => a.day - b.day);
    return all[all.length - 1] ?? null;
  }, [rockets, states]);

  useEffect(() => {
    announce(
      `Transit replay started: ${rockets.length} vehicles, ${Math.round(maxTransit)} days in 60 seconds.`,
    );
  }, [announce, rockets.length, maxTransit]);

  const cockpitKey =
    rockets.find((r) => r.key === ui.cockpitKey)?.key ??
    rockets.find((r) => !r.failed)?.key ??
    rockets[0]?.key;
  const cockpitRocket = rockets.find((r) => r.key === cockpitKey);

  return (
    <section className="flight" aria-labelledby="flight-title">
      <div className="section-head">
        <h2 id="flight-title">Earth → Mars transit</h2>
        <p className="section-head__sub">
          Mission day {Math.round(fraction * maxTransit)} of {Math.round(maxTransit)} ·{' '}
          {Math.round(fraction * 100)}% of the replay
        </p>
      </div>

      <div className="flight__controls">
        <Button onClick={() => setPaused((v) => !v)}>
          {paused ? 'Resume replay' : 'Pause replay'}
        </Button>
        <Button variant="ghost" onClick={skipToEnd}>
          Skip to debrief
        </Button>
      </div>

      <div role="alert" className="flight__alert" data-empty={latestEvent ? undefined : true}>
        {latestEvent && (
          <>
            <strong>{latestEvent.rocket.label}:</strong> {latestEvent.label} on day{' '}
            {Math.round(latestEvent.day)}, {eventEffect(latestEvent)}.{' '}
            <span className="text-subtle">Gameplay model.</span>
          </>
        )}
      </div>

      <Tabs
        label="Transit view"
        idPrefix="flight"
        tabs={VIEWS}
        value={ui.flightView}
        onChange={(v) => dispatch(actions.setFlightView(v))}
      />
      <TabPanel idPrefix="flight" id={ui.flightView}>
        {ui.flightView === 'race' ? (
          <RaceTrack rockets={rockets} states={states} trackMkm={trackMkm} />
        ) : (
          <div className="flight__cockpit">
            <div className="flight__picker" role="group" aria-label="Choose a vehicle">
              {rockets.map((r) => (
                <Button
                  key={r.key}
                  size="sm"
                  aria-pressed={r.key === cockpitKey}
                  onClick={() => dispatch(actions.setCockpit(r.key))}
                >
                  <span className="swatch" style={{ '--swatch': r.color }} aria-hidden="true" />
                  {r.label}
                </Button>
              ))}
            </div>
            {cockpitRocket && (
              <Cockpit
                rocket={cockpitRocket}
                state={states[cockpitRocket.key]}
                replayFraction={fraction}
                maxTransit={maxTransit}
              />
            )}
          </div>
        )}
      </TabPanel>

      <h3 className="visually-hidden">Live telemetry</h3>
      <div className="flight__telemetry">
        {rockets.map((r) => (
          <TelemetryCard key={r.key} rocket={r} state={states[r.key]} />
        ))}
      </div>
    </section>
  );
}
