import { useMissionResults } from '../../state/context.js';
import MissionConfig from './MissionConfig.jsx';
import FleetSection from './FleetSection.jsx';
import TradeoffPanel from './TradeoffPanel.jsx';
import CustomRocketSection from './CustomRocketSection.jsx';
import RocketBuilder from './RocketBuilder.jsx';
import Button from '../ui/Button.jsx';
import '../ui/Field.css';
import './SetupView.css';

/** Phase 1: configuration. */
export default function SetupView({ onLaunch }) {
  const { rockets } = useMissionResults();
  const flyable = rockets.some((r) => !r.failed);
  return (
    <div className="setup">
      <MissionConfig />
      <FleetSection />
      <TradeoffPanel rockets={rockets} />
      <CustomRocketSection />
      <div className="setup__launch">
        <Button variant="primary" size="lg" block onClick={onLaunch} aria-describedby="launch-hint">
          Initiate launch sequence
        </Button>
        <p id="launch-hint" className="field__hint">
          {flyable
            ? `${rockets.length} vehicle${rockets.length > 1 ? 's' : ''} will fly a 60-second replay of the outbound transfer.`
            : 'No selected vehicle can fly this mission; the replay will show why.'}
        </p>
      </div>
      <RocketBuilder />
    </div>
  );
}
