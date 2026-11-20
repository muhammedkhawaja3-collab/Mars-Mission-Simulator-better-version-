/**
 * Mission store: one reducer for configuration, flow phase and UI state.
 * Derived mission results are NOT stored here; components compute them with
 * useMemo(buildMissionResults(config)) so they can never go stale.
 */
import {
  DEFAULT_WINDOW_ID,
  WINDOW_IDS,
  VEHICLE_IDS,
  LAUNCH_VEHICLE_IDS,
} from '../physics/index.js';
import { TRANSFER_OPTIONS } from '../model/catalog.js';

/**
 * @typedef {object} BuildParts
 * @property {string} name
 * @property {string} color
 * @property {string|null} engine
 * @property {string} tank
 * @property {string} shield
 * @property {string} hab
 */

/**
 * @typedef {object} MissionConfig
 * @property {string[]} vehicleIds      Fleet vehicles in the comparison (≥ 1).
 * @property {BuildParts|null} customRocket Builder parts for the custom rocket, or null.
 * @property {string} launchVehicleId   Lifts assembled stacks (Starship always flies on Starship).
 * @property {number} crewSize          2–8.
 * @property {number} riskTolerance     1–10.
 * @property {string} windowId          Fixed launch-window id, e.g. '2028-12'.
 * @property {string} transferChoice    Id from TRANSFER_OPTIONS.
 * @property {number} seed              uint32 seed for the engine's gameplay events.
 */

/** @typedef {'setup'|'countdown'|'flight'|'debrief'} Phase */

/**
 * @typedef {object} UiState
 * @property {boolean} builderOpen
 * @property {'race'|'cockpit'} flightView
 * @property {string|null} cockpitKey
 * @property {'table'|'charts'|'insights'} debriefTab
 * @property {number} missionsFlown    Completed missions this session (gates the install prompt).
 * @property {number} launchId         Increments on every launch (keys flight state).
 */

/** @typedef {{config: MissionConfig, phase: Phase, ui: UiState}} MissionState */

export const DEFAULT_SEED = 42;
export const MAX_SEED = 0xffffffff;

/** @type {MissionState} */
export const initialState = Object.freeze({
  config: Object.freeze({
    vehicleIds: [...VEHICLE_IDS],
    customRocket: null,
    launchVehicleId: 'sls-block1',
    crewSize: 4,
    riskTolerance: 5,
    windowId: DEFAULT_WINDOW_ID,
    transferChoice: 'fastest',
    seed: DEFAULT_SEED,
  }),
  phase: 'setup',
  ui: Object.freeze({
    builderOpen: false,
    flightView: 'race',
    cockpitKey: null,
    debriefTab: 'table',
    missionsFlown: 0,
    launchId: 0,
  }),
});

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));

/** Validates one config field; returns the sanitised value or undefined to reject. */
function sanitize(field, value) {
  switch (field) {
    case 'crewSize':
      return Number.isFinite(Number(value)) ? clampInt(value, 2, 8) : undefined;
    case 'riskTolerance':
      return Number.isFinite(Number(value)) ? clampInt(value, 1, 10) : undefined;
    case 'seed':
      return Number.isFinite(Number(value)) ? clampInt(value, 0, MAX_SEED) : undefined;
    case 'windowId':
      return WINDOW_IDS.includes(value) ? value : undefined;
    case 'launchVehicleId':
      return LAUNCH_VEHICLE_IDS.includes(value) ? value : undefined;
    case 'transferChoice':
      return TRANSFER_OPTIONS.some((o) => o.id === value) ? value : undefined;
    default:
      return undefined;
  }
}

/** Action creators (plain objects; also used directly in tests). */
export const actions = {
  setField: (field, value) => ({ type: 'config/set', field, value }),
  toggleVehicle: (id) => ({ type: 'config/toggleVehicle', id }),
  saveCustomRocket: (parts) => ({ type: 'config/saveCustomRocket', parts }),
  removeCustomRocket: () => ({ type: 'config/removeCustomRocket' }),
  openBuilder: () => ({ type: 'ui/openBuilder' }),
  closeBuilder: () => ({ type: 'ui/closeBuilder' }),
  launch: (firstKey) => ({ type: 'flow/launch', firstKey }),
  countdownDone: () => ({ type: 'flow/countdownDone' }),
  flightDone: () => ({ type: 'flow/flightDone' }),
  reset: () => ({ type: 'flow/reset' }),
  setFlightView: (view) => ({ type: 'ui/setFlightView', view }),
  setCockpit: (key) => ({ type: 'ui/setCockpit', key }),
  setDebriefTab: (tab) => ({ type: 'ui/setDebriefTab', tab }),
};

/**
 * @param {MissionState} state
 * @param {{type:string, [k:string]:any}} action
 * @returns {MissionState}
 */
export function missionReducer(state, action) {
  switch (action.type) {
    case 'config/set': {
      if (state.phase !== 'setup') return state;
      const value = sanitize(action.field, action.value);
      if (value === undefined || state.config[action.field] === value) return state;
      return { ...state, config: { ...state.config, [action.field]: value } };
    }
    case 'config/toggleVehicle': {
      if (state.phase !== 'setup' || !VEHICLE_IDS.includes(action.id)) return state;
      const selected = state.config.vehicleIds;
      const has = selected.includes(action.id);
      // Keep at least one fleet vehicle in the comparison.
      if (has && selected.length === 1) return state;
      const vehicleIds = has
        ? selected.filter((id) => id !== action.id)
        : VEHICLE_IDS.filter((id) => id === action.id || selected.includes(id));
      return { ...state, config: { ...state.config, vehicleIds } };
    }
    case 'config/saveCustomRocket':
      if (!action.parts?.engine) return state;
      return {
        ...state,
        config: { ...state.config, customRocket: { ...action.parts } },
        ui: { ...state.ui, builderOpen: false },
      };
    case 'config/removeCustomRocket':
      return { ...state, config: { ...state.config, customRocket: null } };
    case 'ui/openBuilder':
      return state.phase === 'setup' ? { ...state, ui: { ...state.ui, builderOpen: true } } : state;
    case 'ui/closeBuilder':
      return { ...state, ui: { ...state.ui, builderOpen: false } };
    case 'flow/launch':
      if (state.phase !== 'setup') return state;
      return {
        ...state,
        phase: 'countdown',
        ui: {
          ...state.ui,
          builderOpen: false,
          flightView: 'race',
          cockpitKey: action.firstKey ?? null,
          debriefTab: 'table',
          launchId: state.ui.launchId + 1,
        },
      };
    case 'flow/countdownDone':
      return state.phase === 'countdown' ? { ...state, phase: 'flight' } : state;
    case 'flow/flightDone':
      return state.phase === 'flight'
        ? {
            ...state,
            phase: 'debrief',
            ui: { ...state.ui, missionsFlown: state.ui.missionsFlown + 1 },
          }
        : state;
    case 'flow/reset':
      return { ...state, phase: 'setup' };
    case 'ui/setFlightView':
      return ['race', 'cockpit'].includes(action.view)
        ? { ...state, ui: { ...state.ui, flightView: action.view } }
        : state;
    case 'ui/setCockpit':
      return { ...state, ui: { ...state.ui, cockpitKey: action.key } };
    case 'ui/setDebriefTab':
      return ['table', 'charts', 'insights'].includes(action.tab)
        ? { ...state, ui: { ...state.ui, debriefTab: action.tab } }
        : state;
    default:
      return state;
  }
}
