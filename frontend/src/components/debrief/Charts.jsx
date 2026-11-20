import { CHART_METRIC_KEYS, METRICS } from '../../model/catalog.js';
import BarList from '../ui/BarList.jsx';
import './Charts.css';

/** One readable bar list per key metric (values always shown as text). */
export default function Charts({ rockets }) {
  return (
    <div className="charts">
      {CHART_METRIC_KEYS.map((key) => {
        const m = METRICS.find((x) => x.key === key);
        return (
          <BarList
            key={key}
            title={m.label}
            unit={m.unit}
            lowerIsBetter={m.lo}
            items={rockets.map((r) => ({
              key: r.key,
              label: r.label,
              color: r.color,
              value: r.failed ? null : Number(r[key]),
            }))}
          />
        );
      })}
    </div>
  );
}
