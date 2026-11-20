import { useMemo, useReducer } from 'react';
import { initialState, missionReducer } from './missionReducer.js';
import { buildMissionResults } from '../model/fleet.js';
import { MissionDispatchContext, MissionResultsContext, MissionStateContext } from './context.js';

/**
 * Owns the mission store. Engine results are derived from the config with
 * useMemo (never stored in state), so every consumer sees the same numbers.
 * `initial` lets tests start from a specific state.
 */
export default function MissionProvider({ children, initial = initialState }) {
  const [state, dispatch] = useReducer(missionReducer, initial);
  const results = useMemo(() => buildMissionResults(state.config), [state.config]);
  return (
    <MissionDispatchContext.Provider value={dispatch}>
      <MissionStateContext.Provider value={state}>
        <MissionResultsContext.Provider value={results}>{children}</MissionResultsContext.Provider>
      </MissionStateContext.Provider>
    </MissionDispatchContext.Provider>
  );
}
