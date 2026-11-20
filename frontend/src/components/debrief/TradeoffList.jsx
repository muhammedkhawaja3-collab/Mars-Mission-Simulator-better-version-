import { summarizeTradeoffs } from '../../physics/index.js';
import { fmtTradeoff } from '../../model/format.js';

/** One neutral line per metric: who is best and by how much (no built-in winner). */
export default function TradeoffList({ rockets }) {
  const byKey = Object.fromEntries(rockets.map((r) => [r.key, r]));
  const missions = Object.fromEntries(
    rockets.filter((r) => !r.failed).map((r) => [r.key, r.mission]),
  );
  const summary = summarizeTradeoffs(missions);
  if (summary.length === 0) return null;
  return (
    <ul className="tradeoff-list">
      {summary.map((s) => {
        const best = byKey[s.bestId];
        return (
          <li key={s.key}>
            <span className="swatch" style={{ '--swatch': best.color }} aria-hidden="true" />{' '}
            <strong>{best.label}</strong> {s.tie ? 'ties for best' : 'is best'} on {s.label}:{' '}
            {fmtTradeoff(s.key, s.bestValue)}
            {s.runnerUpId && !s.tie && (
              <span className="text-subtle">
                {' '}
                (next: {byKey[s.runnerUpId].label}, {fmtTradeoff(s.key, s.runnerUpValue)})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
