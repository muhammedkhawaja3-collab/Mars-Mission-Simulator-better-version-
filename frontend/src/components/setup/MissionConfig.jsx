import {
  WINDOWS,
  LAUNCH_VEHICLES,
  LAUNCH_VEHICLE_IDS,
  CREW_PAYLOAD,
  CONSUMABLES_PER_CREW_DAY,
  deltaVMargin,
  getWindow,
  toDays,
} from '../../physics/index.js';
import { TRANSFER_OPTIONS } from '../../model/catalog.js';
import { fmtMonth, riskLabel } from '../../model/format.js';
import { transferOptionFor } from '../../model/fleet.js';
import { actions, MAX_SEED } from '../../state/missionReducer.js';
import { useMissionDispatch, useMissionState } from '../../state/context.js';
import Slider from '../ui/Slider.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import '../ui/Field.css';
import './MissionConfig.css';

const WINDOW_OPTIONS = WINDOWS.map((w) => ({
  value: w.id,
  label: `${w.label}, departs ${fmtMonth(w.departureDate)} · min-energy ${Math.round(toDays(w.hohmannTimeOfFlight))} d`,
}));

const LAUNCHER_OPTIONS = LAUNCH_VEHICLE_IDS.map((id) => {
  const lv = LAUNCH_VEHICLES[id];
  const status = lv.status !== 'operational' ? ` (${lv.status})` : '';
  return {
    value: id,
    label: `${lv.name}, ${(lv.payloadLeoKg / 1000).toFixed(1)} t to LEO${status}`,
  };
});

const TRANSFER_SELECT = TRANSFER_OPTIONS.map((o) => ({ value: o.id, label: o.label }));

const randomSeed = () => Math.floor(Math.random() * MAX_SEED);

/** Mission parameters form. Every control has a programmatic label and hint. */
export default function MissionConfig() {
  const { config } = useMissionState();
  const dispatch = useMissionDispatch();
  const set = (field) => (value) => dispatch(actions.setField(field, value));
  const win = getWindow(config.windowId);
  const habitatT =
    (CREW_PAYLOAD.habitatBaseMass + CREW_PAYLOAD.habitatMassPerCrew * config.crewSize) / 1000;
  const reservePct = Math.round(deltaVMargin(config.riskTolerance) * 100);

  return (
    <section className="config" aria-labelledby="config-title">
      <div className="section-head">
        <h2 id="config-title">Mission parameters</h2>
        <p className="section-head__sub">The same mission is flown by every vehicle you compare.</p>
      </div>
      <form className="config__grid" onSubmit={(e) => e.preventDefault()}>
        <Slider
          id="crew-size"
          label="Crew size"
          min={2}
          max={8}
          value={config.crewSize}
          valueText={`${config.crewSize} crew`}
          onChange={set('crewSize')}
          hint={`${config.crewSize} crew · ${habitatT.toFixed(1)} t habitat · ${CONSUMABLES_PER_CREW_DAY.toFixed(2)} kg consumables per crew-day (NASA BVAD, ISS-class recycling).`}
        />
        <Select
          id="launch-window"
          label="Launch window"
          value={config.windowId}
          onChange={set('windowId')}
          options={WINDOW_OPTIONS}
          hint={`Named by the Mars opposition each window leads up to; ${win.label} departs ${fmtMonth(win.departureDate)} (window id ${win.id}). Windows repeat every ~26 months, and Mars' eccentric orbit makes some cheaper than others.`}
        />
        <Select
          id="launch-vehicle"
          label="Launch vehicle"
          value={config.launchVehicleId}
          onChange={set('launchVehicleId')}
          options={LAUNCHER_OPTIONS}
          hint={`Lifts the chemical, nuclear and custom stacks (launches = mass in LEO ÷ payload, rounded up). The Starship stage always flies on Starship with tanker refuelling. ${LAUNCH_VEHICLES[config.launchVehicleId].source}.`}
        />
        <Select
          id="transfer-strategy"
          label="Transfer strategy"
          value={config.transferChoice}
          onChange={set('transferChoice')}
          options={TRANSFER_SELECT}
          hint={transferOptionFor(config.transferChoice).hint}
        />
        <Slider
          id="risk-tolerance"
          label="Risk tolerance"
          min={1}
          max={10}
          value={config.riskTolerance}
          valueText={`${config.riskTolerance} of 10, ${riskLabel(config.riskTolerance)}, ${reservePct} percent delta-v reserve`}
          onChange={set('riskTolerance')}
          hint={`${riskLabel(config.riskTolerance)} · ${reservePct}% Δv reserve held back · scales the odds of gameplay events.`}
        />
        <div className="field">
          <label className="field__label" htmlFor="event-seed">
            Event seed
          </label>
          <div className="field__row">
            <input
              id="event-seed"
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SEED}
              value={config.seed}
              aria-describedby="event-seed-hint"
              onChange={(e) => e.target.value !== '' && set('seed')(e.target.value)}
            />
            <Button size="sm" onClick={() => set('seed')(randomSeed())}>
              New seed
            </Button>
          </div>
          <p id="event-seed-hint" className="field__hint">
            Same seed, same events. In-flight events are a{' '}
            <Tooltip term="gameplay model">
              Seeded, illustrative odds (solar particle events, engine faults, micrometeoroids,
              comms blackouts). They add dose or Δv cost but never change the trajectory, and they
              are not reliability data.
            </Tooltip>
            .
          </p>
        </div>
      </form>
    </section>
  );
}
