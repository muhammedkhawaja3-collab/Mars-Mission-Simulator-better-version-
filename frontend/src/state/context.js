import { createContext, useContext } from 'react';

/** @type {React.Context<import('./missionReducer.js').MissionState|null>} */
export const MissionStateContext = createContext(null);
/** @type {React.Context<React.Dispatch<object>|null>} */
export const MissionDispatchContext = createContext(null);
/** Derived engine results for the current config (see buildMissionResults). */
export const MissionResultsContext = createContext(null);

const required = (value, name) => {
  if (value === null) throw new Error(`${name} must be used inside <MissionProvider>`);
  return value;
};

export const useMissionState = () => required(useContext(MissionStateContext), 'useMissionState');
export const useMissionDispatch = () =>
  required(useContext(MissionDispatchContext), 'useMissionDispatch');
/** @returns {ReturnType<typeof import('../model/fleet.js').buildMissionResults>} */
export const useMissionResults = () =>
  required(useContext(MissionResultsContext), 'useMissionResults');

/** Reduced-motion preference: OS setting by default, user can override. */
export const MotionContext = createContext({ reduced: false, toggle: () => {} });
export const useMotion = () => useContext(MotionContext);

/** Polite live-region announcer (countdown, phase changes, results). */
export const AnnouncerContext = createContext(() => {});
export const useAnnounce = () => useContext(AnnouncerContext);
