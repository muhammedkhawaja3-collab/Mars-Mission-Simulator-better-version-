import { METRICS } from '../../model/catalog.js';
import { fmtValue } from '../../model/format.js';
import './ComparisonTable.css';

/**
 * Every metric for every vehicle (custom rocket included: it flies the same
 * mission through the same engine). The best value per row is marked with
 * "★ best" text, not colour alone.
 */
export default function ComparisonTable({ rockets }) {
  return (
    // A focusable scroll region lets keyboard users scroll the wide table (WCAG 2.1.1).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="table-scroll" role="region" aria-labelledby="comparison-caption" tabIndex={0}>
      <table className="comparison">
        <caption id="comparison-caption" className="comparison__caption">
          Mission comparison. ★ marks the best value in each row. Success and crew health are
          heuristics.
        </caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {rockets.map((r) => (
              <th key={r.key} scope="col">
                <span className="swatch" style={{ '--swatch': r.color }} aria-hidden="true" />{' '}
                {r.label}
                {r.key === 'player' && <span className="comparison__custom">custom</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const vals = rockets.map((r) => (r.failed ? null : Number(r[m.key])));
            const valid = vals.filter((v) => v !== null && Number.isFinite(v));
            const best = valid.length > 1 ? (m.lo ? Math.min : Math.max)(...valid) : null;
            return (
              <tr key={m.key}>
                <th scope="row">
                  <span className="comparison__metric">{m.label}</span>
                  <span className="comparison__unit">{m.unit}</span>
                </th>
                {rockets.map((r, i) => {
                  const v = vals[i];
                  if (v === null) {
                    return (
                      <td key={r.key} className="comparison__na">
                        cannot fly
                      </td>
                    );
                  }
                  const isBest = best !== null && v === best;
                  return (
                    <td key={r.key} data-best={isBest || undefined}>
                      {fmtValue(v)} {m.unit}
                      {isBest && <span className="comparison__best"> ★ best</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
