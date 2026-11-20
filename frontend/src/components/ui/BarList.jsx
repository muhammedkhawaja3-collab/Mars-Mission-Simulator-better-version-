import { fmtValue } from '../../model/format.js';
import './BarList.css';

/**
 * Horizontal bars for one metric across vehicles. Values are always printed
 * as text; the best value is marked with a word, not colour alone.
 * @param {{title: string, unit: string, lowerIsBetter: boolean,
 *   items: Array<{key: string, label: string, color: string, value: number|null, note?: string}>}} props
 */
export default function BarList({ title, unit, lowerIsBetter, items }) {
  const valid = items.filter((i) => i.value !== null && Number.isFinite(i.value));
  const max = Math.max(...valid.map((i) => i.value), 0) || 1;
  const best = valid.length
    ? (lowerIsBetter ? Math.min : Math.max)(...valid.map((i) => i.value))
    : null;
  return (
    <figure className="bar-list">
      <figcaption className="bar-list__title">
        {title}{' '}
        <span className="text-subtle">
          ({unit}, {lowerIsBetter ? 'lower' : 'higher'} is better)
        </span>
      </figcaption>
      <ul className="bar-list__rows">
        {items.map((i) => {
          const ok = i.value !== null && Number.isFinite(i.value);
          const isBest = ok && valid.length > 1 && i.value === best;
          return (
            <li key={i.key} className="bar-list__row" data-best={isBest || undefined}>
              <span className="bar-list__name">
                <span className="swatch" style={{ '--swatch': i.color }} aria-hidden="true" />
                {i.label}
              </span>
              <span className="bar-list__track" aria-hidden="true">
                <span
                  className="bar-list__fill"
                  style={{ '--fill': ok ? `${(i.value / max) * 100}%` : '0%', '--bar': i.color }}
                />
              </span>
              <span className="bar-list__value">
                {ok ? `${fmtValue(i.value)} ${unit}` : (i.note ?? 'cannot fly')}
                {isBest && <span className="bar-list__best"> ★ best</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
