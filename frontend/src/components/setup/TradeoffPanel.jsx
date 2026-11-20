import Card from '../ui/Card.jsx';
import BarList from '../ui/BarList.jsx';
import TradeoffList from '../debrief/TradeoffList.jsx';
import './TradeoffPanel.css';

const BAR_METRICS = [
  { key: 'transit', label: 'Transit time', unit: 'd' },
  { key: 'missionDose', label: 'Mission dose (round trip)', unit: 'mSv' },
  { key: 'imleo', label: 'Mass in low Earth orbit', unit: 't' },
  { key: 'cost', label: 'Transportation cost (est.)', unit: '$B' },
];

/** Side-by-side trade-offs for the vehicles in the comparison. */
export default function TradeoffPanel({ rockets }) {
  if (!rockets.some((r) => !r.failed)) return null;
  const failed = rockets.filter((r) => r.failed);
  return (
    <Card className="tradeoffs" aria-labelledby="tradeoffs-title">
      <h3 id="tradeoffs-title" className="tradeoffs__title">
        Trade-offs: same mission, physics decides
      </h3>
      <p className="tradeoffs__formula">
        Δv = vₑ · ln(m₀ / m_f), vₑ = Isp · g₀ · patched conics: LEO departure → heliocentric
        transfer → Mars capture
      </p>
      <div className="tradeoffs__bars">
        {BAR_METRICS.map((m) => (
          <BarList
            key={m.key}
            title={m.label}
            unit={m.unit}
            lowerIsBetter
            items={rockets.map((r) => ({
              key: r.key,
              label: r.label,
              color: r.color,
              value: r.failed ? null : r[m.key],
            }))}
          />
        ))}
      </div>
      <TradeoffList rockets={rockets} />
      <p className="tradeoffs__why">
        <strong>Why they differ:</strong> higher Isp gives more Δv per tonne of propellant, which
        can buy a faster transfer, but NTR reactors and bulky hydrogen tanks add dry mass.
        Starship&apos;s lower Isp is offset by refilling very large tanks in orbit with tanker
        flights, and it brakes with its heat shield instead of an engine burn; the heat shield caps
        how fast it can arrive. Faster trips cut cruise radiation, but usually mean a longer wait on
        Mars for the return window, so total mission dose falls less than transit dose.
      </p>
      {failed.length > 0 && (
        <p className="text-danger small">
          {failed.map((r) => `${r.label}: ${r.failReason}.`).join(' ')}
        </p>
      )}
    </Card>
  );
}
