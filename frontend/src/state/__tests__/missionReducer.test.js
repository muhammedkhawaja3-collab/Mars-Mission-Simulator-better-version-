import { describe, it, expect } from 'vitest';
import { initialState, missionReducer, actions, DEFAULT_SEED } from '../missionReducer.js';

const run = (...acts) => acts.reduce(missionReducer, initialState);

describe('missionReducer', () => {
  it('starts in setup with the documented defaults', () => {
    expect(initialState.phase).toBe('setup');
    expect(initialState.config).toMatchObject({
      vehicleIds: ['chemical', 'nuclear', 'starship'],
      launchVehicleId: 'sls-block1',
      crewSize: 4,
      riskTolerance: 5,
      windowId: '2028-12',
      transferChoice: 'fastest',
      seed: DEFAULT_SEED,
      customRocket: null,
    });
  });

  it('sets and clamps numeric fields, rejects unknown ids', () => {
    let s = run(actions.setField('crewSize', 6));
    expect(s.config.crewSize).toBe(6);
    s = missionReducer(s, actions.setField('crewSize', 99));
    expect(s.config.crewSize).toBe(8);
    s = missionReducer(s, actions.setField('riskTolerance', 0));
    expect(s.config.riskTolerance).toBe(1);
    s = missionReducer(s, actions.setField('seed', '123'));
    expect(s.config.seed).toBe(123);
    const before = s;
    expect(missionReducer(s, actions.setField('windowId', '1999-01'))).toBe(before);
    expect(missionReducer(s, actions.setField('launchVehicleId', 'saturn-v'))).toBe(before);
    expect(missionReducer(s, actions.setField('crewSize', 'abc'))).toBe(before);
    expect(missionReducer(s, actions.setField('unknown', 1))).toBe(before);
  });

  it('toggles fleet vehicles but always keeps at least one, in catalog order', () => {
    let s = run(actions.toggleVehicle('nuclear'));
    expect(s.config.vehicleIds).toEqual(['chemical', 'starship']);
    s = missionReducer(s, actions.toggleVehicle('nuclear'));
    expect(s.config.vehicleIds).toEqual(['chemical', 'nuclear', 'starship']);
    s = run(actions.toggleVehicle('chemical'), actions.toggleVehicle('nuclear'));
    expect(s.config.vehicleIds).toEqual(['starship']);
    expect(missionReducer(s, actions.toggleVehicle('starship'))).toBe(s);
  });

  it('saves a custom rocket only with an engine and closes the builder', () => {
    let s = run(actions.openBuilder());
    expect(s.ui.builderOpen).toBe(true);
    expect(missionReducer(s, actions.saveCustomRocket({ name: 'X', engine: null }))).toBe(s);
    s = missionReducer(
      s,
      actions.saveCustomRocket({
        name: 'X',
        engine: 'rl10b2',
        tank: 'med',
        shield: 'none',
        hab: 'standard',
        color: '#E91E8C',
      }),
    );
    expect(s.config.customRocket.engine).toBe('rl10b2');
    expect(s.ui.builderOpen).toBe(false);
    s = missionReducer(s, actions.removeCustomRocket());
    expect(s.config.customRocket).toBeNull();
  });

  it('walks setup → countdown → flight → debrief → setup and counts missions', () => {
    let s = run(actions.launch('nuclear'));
    expect(s.phase).toBe('countdown');
    expect(s.ui.cockpitKey).toBe('nuclear');
    expect(s.ui.launchId).toBe(1);
    expect(missionReducer(s, actions.flightDone())).toBe(s); // out of order: ignored
    s = missionReducer(s, actions.countdownDone());
    expect(s.phase).toBe('flight');
    s = missionReducer(s, actions.flightDone());
    expect(s.phase).toBe('debrief');
    expect(s.ui.missionsFlown).toBe(1);
    s = missionReducer(s, actions.reset());
    expect(s.phase).toBe('setup');
    expect(s.ui.missionsFlown).toBe(1);
  });

  it('locks the configuration outside setup', () => {
    const s = run(actions.launch());
    expect(missionReducer(s, actions.setField('crewSize', 2))).toBe(s);
    expect(missionReducer(s, actions.toggleVehicle('nuclear'))).toBe(s);
    expect(missionReducer(s, actions.openBuilder())).toBe(s);
  });

  it('validates UI enums', () => {
    let s = run(actions.setDebriefTab('charts'), actions.setFlightView('cockpit'));
    expect(s.ui.debriefTab).toBe('charts');
    expect(s.ui.flightView).toBe('cockpit');
    expect(missionReducer(s, actions.setDebriefTab('bogus'))).toBe(s);
    expect(missionReducer(s, actions.setFlightView('bogus'))).toBe(s);
    expect(missionReducer(s, { type: 'nope' })).toBe(s);
    s = missionReducer(s, actions.setCockpit('starship'));
    expect(s.ui.cockpitKey).toBe('starship');
  });
});
