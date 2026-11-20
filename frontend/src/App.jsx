import { useCallback, useEffect, useRef } from 'react';
import MotionProvider from './state/MotionProvider.jsx';
import MissionProvider from './state/MissionProvider.jsx';
import { actions } from './state/missionReducer.js';
import { useMissionDispatch, useMissionResults, useMissionState } from './state/context.js';
import usePwaInstall from './hooks/usePwaInstall.js';
import LiveAnnouncer from './components/ui/LiveAnnouncer.jsx';
import Header from './components/layout/Header.jsx';
import StatusBar from './components/layout/StatusBar.jsx';
import InstallBanner from './components/layout/InstallBanner.jsx';
import SetupView from './components/setup/SetupView.jsx';
import Countdown from './components/flight/Countdown.jsx';
import FlightView from './components/flight/FlightView.jsx';
import Debrief from './components/debrief/Debrief.jsx';
import './App.css';

/** Heading that receives focus when each phase starts (keyboard/screen-reader users land on it). */
const PHASE_HEADING = {
  setup: 'config-title',
  countdown: 'countdown-title',
  flight: 'flight-title',
  debrief: 'debrief-title',
};

/** Phase router + landmarks. `now` is an injectable clock for the flight replay (tests). */
function MissionControl({ now }) {
  const { phase, ui } = useMissionState();
  const { rockets } = useMissionResults();
  const dispatch = useMissionDispatch();
  const install = usePwaInstall({ ready: ui.missionsFlown > 0 && phase !== 'flight' });
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = document.getElementById(PHASE_HEADING[phase]);
    if (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus();
    }
    window.scrollTo?.({ top: 0 });
  }, [phase]);

  const firstFlyable =
    rockets.find((r) => r.key === 'player' && !r.failed) ?? rockets.find((r) => !r.failed);
  const onLaunch = useCallback(
    () => dispatch(actions.launch(firstFlyable?.key)),
    [dispatch, firstFlyable],
  );
  const onCountdownDone = useCallback(() => dispatch(actions.countdownDone()), [dispatch]);
  const onReset = useCallback(() => dispatch(actions.reset()), [dispatch]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <main id="main" className="container app-main" tabIndex={-1}>
        <StatusBar phase={phase} />
        {phase === 'setup' && <SetupView onLaunch={onLaunch} />}
        {phase === 'countdown' && <Countdown onDone={onCountdownDone} onCancel={onReset} />}
        {phase === 'flight' && <FlightView key={ui.launchId} now={now} />}
        {phase === 'debrief' && <Debrief />}
      </main>
      <footer className="container app-footer">
        <p>
          Educational model: patched conics, impulsive burns, coplanar orbits. Costs, dry masses and
          success figures are estimates or heuristics; in-flight events are a seeded gameplay model.
        </p>
      </footer>
      {install.visible && (
        <InstallBanner
          instruction={install.instruction}
          canPrompt={install.canPrompt}
          onInstall={install.install}
          onDismiss={install.dismiss}
        />
      )}
    </>
  );
}

export default function App({ now, initialState }) {
  return (
    <MotionProvider>
      <MissionProvider initial={initialState}>
        <LiveAnnouncer>
          <MissionControl now={now} />
        </LiveAnnouncer>
      </MissionProvider>
    </MotionProvider>
  );
}
