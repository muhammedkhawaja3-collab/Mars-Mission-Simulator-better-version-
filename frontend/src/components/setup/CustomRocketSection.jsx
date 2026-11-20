import { actions } from '../../state/missionReducer.js';
import { useMissionDispatch, useMissionResults } from '../../state/context.js';
import Button from '../ui/Button.jsx';
import VehicleCard from './VehicleCard.jsx';
import './CustomRocketSection.css';

/** The user's own rocket: a call to action, or its card with redesign/remove. */
export default function CustomRocketSection() {
  const { player } = useMissionResults();
  const dispatch = useMissionDispatch();
  const open = () => dispatch(actions.openBuilder());
  return (
    <section aria-labelledby="custom-title">
      <div className="section-head">
        <h2 id="custom-title">Your rocket</h2>
        <p className="section-head__sub">
          Real engine and components, same mission, same physics engine. It can fail.
        </p>
      </div>
      {player ? (
        <VehicleCard
          rocket={player}
          actions={
            <>
              <Button size="sm" onClick={open} aria-label={`Redesign ${player.label}`}>
                Redesign
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => dispatch(actions.removeCustomRocket())}
                aria-label={`Remove ${player.label}`}
              >
                Remove
              </Button>
            </>
          }
        />
      ) : (
        <button
          type="button"
          className="build-cta"
          onClick={open}
          aria-labelledby="build-cta-title"
          aria-describedby="build-cta-sub"
        >
          <span className="build-cta__icon" aria-hidden="true">
            +
          </span>
          <span>
            <span className="build-cta__title" id="build-cta-title">
              Build your rocket
            </span>
            <span className="build-cta__sub" id="build-cta-sub">
              Choose a real engine, propellant tank, radiation shielding and habitat module. Stats
              come from the Tsiolkovsky rocket equation and patched conics, using real component
              specs.
            </span>
          </span>
        </button>
      )}
    </section>
  );
}
