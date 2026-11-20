import { useMemo, useRef } from 'react';
import { doseSoFar, outboundEventsUntil, propellantRemaining } from '../../model/flight.js';
import { doseTone } from '../../model/format.js';
import { EVENT_DISPLAY } from '../../model/eventDisplay.js';
import { useMotion } from '../../state/context.js';
import Stat, { StatGrid } from '../ui/Stat.jsx';
import { statusText } from './statusText.js';
import './Cockpit.css';

const W = 900;
const H = 260;
/** How long an event's visual effect lasts, as a share of the replay. */
const EFFECT_WINDOW = 2200 / 60000;

const wrap = (x, w) => ((x % w) + w) % w;

const makeStars = (count, a, b, ox, oy, rBase, rStep, opBase, opStep) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i * a + ox) % W,
    y: (i * b + oy) % H,
    r: rBase + (i % 4) * rStep,
    op: opBase + (i % 6) * opStep,
  }));

const FAR = makeStars(70, 137.5, 83.7, 41, 19, 0.5, 0.2, 0.3, 0.07);
const NEAR = makeStars(35, 213.1, 61.3, 87, 30, 0.8, 0.4, 0.5, 0.09);

const CRACK_RAYS = [
  [-70, -55, -110, -75],
  [60, -45, 95, -58],
  [-50, 50, -70, 80],
  [55, 42, 85, 65],
  [-30, -70, -20, -100],
  [35, -65, 25, -95],
];

/**
 * First-person view from one vehicle. The scene is decorative (aria-hidden);
 * all information is in the HTML readout below it. Visual effects are derived
 * from the engine's seeded events and the replay clock, so they pause with
 * the replay and disappear entirely with reduced motion.
 */
export default function Cockpit({ rocket, state, replayFraction, maxTransit }) {
  const { reduced } = useMotion();
  const windowRef = useRef(null);
  const p = state.progress;
  const happened = useMemo(() => outboundEventsUntil(rocket, state.day), [rocket, state.day]);

  const arrived = state.status === 'arrived';
  const blocked = state.status === 'no-go' || state.status === 'aborted';
  const marsR = arrived ? 60 : 6 + p * 45;
  const marsX = arrived ? W / 2 : W - 60 - (1 - p) * 50;
  const scroll = reduced ? 0 : p;

  // Effect of the most recent event, while it is within the effect window.
  const latest = happened[happened.length - 1];
  const latestAt = latest && maxTransit > 0 ? latest.day / maxTransit : null;
  const effect =
    !reduced && latest && latestAt !== null && replayFraction - latestAt < EFFECT_WINDOW
      ? latest
      : null;
  const cracks = happened
    .filter((e) => e.type === 'micrometeoroid')
    .map((e, i) => ({
      id: e.id,
      cx: 420 + (((i + 1) * 37) % 80),
      cy: 110 + (((i + 1) * 53) % 60),
    }));

  const onPointerMove = (e) => {
    if (reduced || !windowRef.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    windowRef.current.style.setProperty(
      '--look-x',
      ((e.clientX - box.left) / box.width - 0.5).toFixed(3),
    );
    windowRef.current.style.setProperty(
      '--look-y',
      ((e.clientY - box.top) / box.height - 0.5).toFixed(3),
    );
  };
  const onPointerLeave = () => {
    windowRef.current?.style.setProperty('--look-x', '0');
    windowRef.current?.style.setProperty('--look-y', '0');
  };

  const dose = doseSoFar(rocket, state.day);
  const propT = propellantRemaining(rocket, state.day, { started: true, arrived }) / 1000;
  const distance = rocket.failed ? 0 : (rocket.pathMkm * p).toFixed(1);

  return (
    <figure
      className="cockpit"
      style={{ '--lane': rocket.color }}
      aria-labelledby="cockpit-caption"
    >
      <figcaption id="cockpit-caption" className="cockpit__head">
        <span className="cockpit__name">
          <span className="swatch" style={{ '--swatch': rocket.color }} aria-hidden="true" />
          {rocket.label}: first-person view
        </span>
        <span className="cockpit__status" data-status={state.status}>
          {statusText(rocket, state)}
        </span>
      </figcaption>

      {/* Pointer look-around is a decorative effect; no information depends on it. */}
      <div
        ref={windowRef}
        className="cockpit__window"
        data-effect={effect ? effect.type : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="cockpit__svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="cockpit-mars" cx="40%" cy="35%" r="65%">
              <stop offset="0%" className="cockpit__stop--light" />
              <stop offset="55%" className="cockpit__stop--mid" />
              <stop offset="100%" className="cockpit__stop--deep" />
            </radialGradient>
          </defs>
          <g className="cockpit__layer cockpit__layer--far">
            {FAR.map((s) => (
              <circle key={s.id} cx={wrap(s.x - scroll * 700, W)} cy={s.y} r={s.r} opacity={s.op} />
            ))}
          </g>
          <g className="cockpit__layer cockpit__layer--near">
            {NEAR.map((s) => (
              <circle
                key={s.id}
                cx={wrap(s.x - scroll * 1600, W)}
                cy={s.y}
                r={s.r}
                opacity={s.op}
              />
            ))}
          </g>
          {state.status !== 'no-go' && (
            <g className="cockpit__layer cockpit__layer--mars">
              <g transform={`translate(${marsX},${H / 2})`}>
                <circle r={marsR * 2.2} fill="rgb(180 50 10 / 0.1)" />
                <circle r={marsR} fill="url(#cockpit-mars)" />
                {marsR > 18 && (
                  <circle
                    cx={-marsR * 0.3}
                    cy={-marsR * 0.2}
                    r={marsR * 0.28}
                    className="cockpit__spot"
                  />
                )}
              </g>
            </g>
          )}
          {cracks.map((c) => (
            <g key={c.id} className="cockpit__crack">
              {CRACK_RAYS.map(([x1, y1, x2, y2]) => (
                <path
                  key={`${x1}${y1}`}
                  d={`M${c.cx},${c.cy} L${c.cx + x1},${c.cy + y1} L${c.cx + x2},${c.cy + y2}`}
                  fill="none"
                  stroke="rgb(200 220 255 / 0.55)"
                  strokeWidth="1.3"
                />
              ))}
            </g>
          ))}
          {effect?.type === 'engine-fault' &&
            [60, 190, 320, 450, 580, 710, 840].map((x) => (
              <line key={x} className="cockpit__spark" x1={x} y1={H} x2={x + 12} y2={H - 40} />
            ))}
          <rect
            width={W}
            height={H}
            rx="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            opacity="0.18"
          />
        </svg>
        {effect && (
          <p key={effect.id} className="cockpit__effect">
            <span aria-hidden="true">{EVENT_DISPLAY[effect.type]?.icon} </span>
            {effect.label}
          </p>
        )}
        {blocked && (
          <p className="cockpit__blocked">
            {state.status === 'no-go' ? 'NO-GO' : 'ABORT'}
            <span>
              {state.status === 'no-go'
                ? rocket.failReason
                : rocket.mission.eventSummary.abortReason}
            </span>
          </p>
        )}
        <span className="cockpit__progress" style={{ '--progress': p }} aria-hidden="true" />
      </div>

      {!rocket.failed && (
        <StatGrid className="cockpit__hud">
          <Stat label="Avg speed" value={`${rocket.avgVelocity} km/s`} />
          <Stat label="Mission day" value={`${Math.round(state.day)} / ${rocket.transit}`} />
          <Stat label="Radiation" value={`${dose.toFixed(1)} mSv`} tone={doseTone(dose)} />
          <Stat label="Distance" value={`${distance} M km`} />
          <Stat label="Crew health" value={`${rocket.crewHealth}/100`} note="(heuristic)" />
          <Stat label="Propellant" value={`${propT.toFixed(0)} t`} note="(steps at burns)" />
        </StatGrid>
      )}
    </figure>
  );
}
