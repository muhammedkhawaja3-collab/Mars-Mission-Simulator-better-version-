import './ArrivalSummary.css';

/** One tile per vehicle: outcome and transit, with the fastest marked in words. */
export default function ArrivalSummary({ rockets }) {
  const flying = rockets.filter((r) => !r.failed && !r.aborted);
  const minT = flying.length ? Math.min(...flying.map((r) => r.transit)) : null;
  return (
    <ul className="arrivals">
      {rockets.map((r) => {
        const outcome = r.failed ? 'Cannot fly' : r.aborted ? 'Aborted' : `${r.transit} d`;
        const note = r.failed
          ? 'No-go for this mission'
          : r.aborted
            ? 'Engine faults used up the Δv reserve (gameplay model)'
            : r.transit === minT
              ? 'Fastest transit'
              : `+${(r.transit - minT).toFixed(1)} d vs fastest`;
        const count = r.events?.length ?? 0;
        return (
          <li key={r.key} className="arrival" style={{ '--card-accent': r.color }}>
            <span className="arrival__name">
              <span className="swatch" style={{ '--swatch': r.color }} aria-hidden="true" />
              {r.label}
            </span>
            <span className="arrival__value" data-bad={r.failed || r.aborted || undefined}>
              {outcome}
            </span>
            <span className="arrival__note">{note}</span>
            {count > 0 && (
              <span className="arrival__events">
                {count} gameplay event{count > 1 ? 's' : ''} over the mission
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
