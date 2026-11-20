import { useMemo, useState } from 'react';
import {
  ENGINE_CATALOG,
  TANK_OPTIONS,
  SHIELD_OPTIONS,
  HAB_OPTIONS,
  PLAYER_COLORS,
  DEFAULT_BUILD,
} from '../../model/catalog.js';
import { computePlayerStats } from '../../model/fleet.js';
import { fmtThrust } from '../../model/format.js';
import { actions } from '../../state/missionReducer.js';
import { useMissionDispatch, useMissionState } from '../../state/context.js';
import Dialog from '../ui/Dialog.jsx';
import Button from '../ui/Button.jsx';
import { Tabs, TabPanel } from '../ui/Tabs.jsx';
import PartPicker from './PartPicker.jsx';
import BuilderPreview from './BuilderPreview.jsx';
import '../ui/Field.css';
import './RocketBuilder.css';

const SECTIONS = [
  { id: 'engine', label: 'Engine' },
  { id: 'tank', label: 'Tank' },
  { id: 'shield', label: 'Shielding' },
  { id: 'hab', label: 'Habitat' },
];

const ENGINE_OPTIONS = ENGINE_CATALOG.map((e) => ({
  id: e.id,
  name: e.name,
  meta: `${e.family} · Isp ${e.isp} s · ${fmtThrust(e.thrust)} · TRL ${e.trl}`,
  desc: e.desc,
  warning: e.electric ? 'Low thrust: this crewed mission will not be feasible.' : undefined,
}));
const TANK_PICK = TANK_OPTIONS.map((t) => ({
  id: t.id,
  name: t.name,
  meta: `${(t.capacity / 1000).toFixed(0)} t propellant · ${(t.structMass / 1000).toFixed(0)} t structure`,
  desc: t.desc,
}));
const SHIELD_PICK = SHIELD_OPTIONS.map((s) => ({
  id: s.id,
  name: s.name,
  meta: `${(s.mass / 1000).toFixed(1)} t · dose × ${s.factor.toFixed(2)} (−${Math.round((1 - s.factor) * 100)}%)`,
  desc: s.desc,
}));
const HAB_PICK = HAB_OPTIONS.map((h) => ({
  id: h.id,
  name: h.name,
  meta: `${(h.dryMass / 1000).toFixed(0)} t dry mass`,
  desc: h.desc,
}));

/** Body of the builder; mounted only while the dialog is open so the draft resets each time. */
function BuilderForm({ onClose }) {
  const { config } = useMissionState();
  const dispatch = useMissionDispatch();
  const [draft, setDraft] = useState(() => ({ ...(config.customRocket ?? DEFAULT_BUILD) }));
  const [section, setSection] = useState('engine');
  const stats = useMemo(() => computePlayerStats(draft, config), [draft, config]);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="builder"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.engine) dispatch(actions.saveCustomRocket(draft));
      }}
    >
      <div className="builder__identity">
        <div className="field">
          <label className="field__label" htmlFor="rocket-name">
            Rocket name
          </label>
          <input
            id="rocket-name"
            className="input"
            type="text"
            maxLength={14}
            value={draft.name}
            placeholder="MY ROCKET"
            autoComplete="off"
            data-autofocus
            onChange={(e) => set('name')(e.target.value.toUpperCase())}
          />
        </div>
        <fieldset className="builder__colors">
          <legend className="field__label">Colour</legend>
          <div className="builder__swatches">
            {PLAYER_COLORS.map((c) => (
              <label key={c.value} className="builder__swatch" style={{ '--swatch': c.value }}>
                <input
                  type="radio"
                  name="rocket-color"
                  value={c.value}
                  checked={draft.color === c.value}
                  onChange={() => set('color')(c.value)}
                  className="visually-hidden"
                />
                <span className="visually-hidden">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="builder__layout">
        <div className="builder__parts">
          <Tabs
            label="Rocket components"
            idPrefix="builder"
            tabs={SECTIONS.map((s) => ({
              id: s.id,
              label: s.id === 'engine' && !draft.engine ? `${s.label} (required)` : s.label,
            }))}
            value={section}
            onChange={setSection}
          />
          <TabPanel idPrefix="builder" id={section}>
            {section === 'engine' && (
              <PartPicker
                legend="Engine"
                name="engine"
                value={draft.engine}
                onChange={set('engine')}
                options={ENGINE_OPTIONS}
                intro="Pick any engine. Higher Isp → higher exhaust velocity → more Δv per tonne of propellant, but heavier engines and tanks eat into that gain. Electric engines have high Isp but far too little thrust for the impulsive burns this model assumes."
              />
            )}
            {section === 'tank' && (
              <PartPicker
                legend="Propellant tank"
                name="tank"
                value={draft.tank}
                onChange={set('tank')}
                options={TANK_PICK}
              />
            )}
            {section === 'shield' && (
              <PartPicker
                legend="Radiation shielding"
                name="shield"
                value={draft.shield}
                onChange={set('shield')}
                options={SHIELD_PICK}
                intro="GCR dose rate: 1.84 mSv/day in cruise (Curiosity RAD, Zeitlin et al. 2013). NASA career limit: 600 mSv (NASA-STD-3001). Shielding factors are estimates."
              />
            )}
            {section === 'hab' && (
              <PartPicker
                legend="Habitat"
                name="hab"
                value={draft.hab}
                onChange={set('hab')}
                options={HAB_PICK}
                intro="Habitat mass adds to dry mass: a heavier hab needs more propellant for the same Δv."
              />
            )}
          </TabPanel>
        </div>
        <BuilderPreview stats={stats} />
      </div>

      {!draft.engine && (
        <p className="builder__notice" id="builder-engine-required">
          Select an engine to enable “Lock in &amp; fly”.
        </p>
      )}
      <div className="builder__actions">
        <Button
          type="submit"
          variant="primary"
          disabled={!draft.engine}
          aria-describedby={!draft.engine ? 'builder-engine-required' : undefined}
        >
          Lock in &amp; fly
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Rocket builder modal dialog. */
export default function RocketBuilder() {
  const { ui } = useMissionState();
  const dispatch = useMissionDispatch();
  const close = () => dispatch(actions.closeBuilder());
  return (
    <Dialog
      open={ui.builderOpen}
      onClose={close}
      title="Build your rocket"
      description="Real engines and components. Your rocket flies the same mission as the fleet, through the same physics engine, and it can fail."
      className="builder-dialog"
    >
      <BuilderForm onClose={close} />
    </Dialog>
  );
}
