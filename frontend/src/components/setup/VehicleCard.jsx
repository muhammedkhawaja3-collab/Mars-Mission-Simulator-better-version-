import Card from '../ui/Card.jsx';
import Stat, { StatGrid } from '../ui/Stat.jsx';
import { doseTone } from '../../model/format.js';
import SuccessFactors from './SuccessFactors.jsx';
import './VehicleCard.css';

const spareTone = (dv) => (dv > 2 ? 'success' : dv < 0.5 ? 'danger' : undefined);

/**
 * One vehicle's engine results for the current mission.
 * `actions` renders buttons in the card footer (include toggle, redesign…).
 */
export default function VehicleCard({ rocket, actions, dimmed = false, headingLevel = 3 }) {
  const H = `h${headingLevel}`;
  const titleId = `vehicle-${rocket.key}-title`;
  return (
    <Card
      as="article"
      accent={rocket.color}
      className={['vehicle-card', dimmed && 'vehicle-card--dimmed'].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <div className="vehicle-card__head">
        <div>
          <H id={titleId} className="vehicle-card__title">
            <span className="swatch" style={{ '--swatch': rocket.color }} aria-hidden="true" />
            {rocket.label}
          </H>
          <p className="vehicle-card__engine">{rocket.engineType}</p>
        </div>
        <span className="tag">TRL {rocket.trl}</span>
      </div>

      {rocket.failed ? (
        <p className="vehicle-card__fail" role="note">
          <strong>Cannot fly this mission:</strong> {rocket.failReason}
        </p>
      ) : (
        <StatGrid className="vehicle-card__stats">
          <Stat label="Isp" value={`${rocket.isp} s`} />
          <Stat label="Transit" value={`${rocket.transit} d`} />
          <Stat label="Δv required" value={`${rocket.deltaV} km/s`} />
          <Stat
            label="Transit dose"
            value={`${rocket.radiation} mSv`}
            tone={doseTone(rocket.radiation)}
          />
          <Stat label="Cost (est.)" value={`$${rocket.cost}B`} />
          <Stat label="Launches" value={`${rocket.launches}×`} />
          <Stat
            label="Spare Δv"
            value={`${rocket.abortDv} km/s`}
            tone={spareTone(rocket.abortDv)}
            note={rocket.abortDv < 0.5 ? '(thin)' : undefined}
          />
          <Stat label="Mass in LEO" value={`${rocket.imleo} t`} />
          <Stat
            label="Mission dose"
            value={`${rocket.careerRadPct}% of limit`}
            tone={rocket.careerRadPct > 100 ? 'danger' : 'warning'}
          />
          <Stat label="Success (heur.)" value={`${rocket.success}%`} />
        </StatGrid>
      )}

      <SuccessFactors rocket={rocket} />
      <p className="vehicle-card__source">{rocket.source}</p>
      {actions && <div className="vehicle-card__actions">{actions}</div>}
    </Card>
  );
}
