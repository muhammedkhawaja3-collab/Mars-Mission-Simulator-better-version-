import { actions } from '../../state/missionReducer.js';
import { useMissionDispatch, useMissionResults, useMissionState } from '../../state/context.js';
import Button from '../ui/Button.jsx';
import VehicleCard from './VehicleCard.jsx';
import './FleetSection.css';

/** The three reference vehicles; each can be included in or left out of the comparison. */
export default function FleetSection() {
  const { config } = useMissionState();
  const { fleet } = useMissionResults();
  const dispatch = useMissionDispatch();
  return (
    <section aria-labelledby="fleet-title">
      <div className="section-head">
        <h2 id="fleet-title">Reference fleet</h2>
        <p className="section-head__sub">
          Every number is computed by the physics engine for the mission above.
        </p>
      </div>
      <ul className="fleet-grid">
        {fleet.map((r) => {
          const included = config.vehicleIds.includes(r.key);
          const onlyOne = included && config.vehicleIds.length === 1;
          return (
            <li key={r.key}>
              <VehicleCard
                rocket={r}
                dimmed={!included}
                actions={
                  <Button
                    size="sm"
                    aria-pressed={included}
                    aria-label={`${included ? 'In comparison' : 'Add to comparison'}: ${r.label}`}
                    disabled={onlyOne}
                    onClick={() => dispatch(actions.toggleVehicle(r.key))}
                  >
                    {included ? 'In comparison' : 'Add to comparison'}
                  </Button>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
