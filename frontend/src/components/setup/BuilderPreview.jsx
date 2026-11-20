import './BuilderPreview.css';

const tone = (good, warn) => (warn ? 'warning' : good ? 'success' : undefined);

function Row({ label, value, good = false, warn = false }) {
  const t = tone(good, warn);
  return (
    <div className="preview__row">
      <dt>{label}</dt>
      <dd className={t ? `text-${t}` : undefined}>
        {value}
        {t && <span className="visually-hidden">{t === 'warning' ? ' (poor)' : ' (good)'}</span>}
      </dd>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <>
      <h4 className="preview__group">{title}</h4>
      <dl className="preview__list">{children}</dl>
    </>
  );
}

/** Live engine results for the rocket being designed (same mission as the fleet). */
export default function BuilderPreview({ stats }) {
  return (
    <section className="preview" aria-labelledby="preview-title">
      <h3 id="preview-title" className="preview__title">
        Live physics: same mission as the fleet
      </h3>
      {!stats ? (
        <p className="preview__empty">Select an engine to see live physics.</p>
      ) : (
        <>
          <Group title="Engine">
            <Row
              label="Isp"
              value={`${stats.isp} s`}
              good={stats.isp > 700}
              warn={stats.isp < 400}
            />
            <Row
              label="vₑ = Isp × 9.807"
              value={`${stats.exhaustVelocity} m/s`}
              good={stats.exhaustVelocity > 7000}
            />
          </Group>
          <Group title="Mass (from your parts)">
            <Row
              label="Structure (tank + shield + bus)"
              value={`${(stats.stageDryMass / 1000).toFixed(1)} t`}
            />
            <Row label="Habitat module" value={`${(stats.habitatMass / 1000).toFixed(1)} t`} />
            <Row
              label="Tank capacity"
              value={`${(stats.propellantCapacity / 1000).toFixed(0)} t`}
            />
          </Group>
          {stats.failed ? (
            <p className="preview__fail" role="note">
              <strong>Mission not feasible:</strong> {stats.failReason}
            </p>
          ) : (
            <>
              <Group title="Δv = vₑ · ln(m₀ / m_f)">
                <Row label="Δv required (TMI + capture)" value={`${stats.deltaV} km/s`} />
                <Row
                  label="Spare Δv (full tanks)"
                  value={`${stats.abortDv} km/s`}
                  good={stats.abortDv > 2}
                  warn={stats.abortDv < 0.5}
                />
                <Row label="Propellant used" value={`${stats.propellantT} t`} />
              </Group>
              <Group title="Trajectory (patched conics)">
                <Row
                  label="Transit time"
                  value={`${stats.transit} days`}
                  good={stats.transit < 150}
                  warn={stats.transit > 270}
                />
              </Group>
              <Group title="Crew">
                <Row
                  label="Transit dose (1.84 mSv/d × shielding)"
                  value={`${stats.radiation} mSv`}
                  good={stats.radiation < 200}
                  warn={stats.radiation > 400}
                />
                <Row
                  label="Mission dose / 600 mSv limit"
                  value={`${stats.careerRadPct}%`}
                  good={stats.careerRadPct < 100}
                  warn={stats.careerRadPct > 150}
                />
              </Group>
            </>
          )}
        </>
      )}
    </section>
  );
}
