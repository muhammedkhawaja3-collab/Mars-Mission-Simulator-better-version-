import { useEffect, useState } from 'react';
import { actions } from '../../state/missionReducer.js';
import {
  useAnnounce,
  useMissionDispatch,
  useMissionResults,
  useMissionState,
} from '../../state/context.js';
import { crossCheckMission } from '../../lib/api.js';
import { resultSummary } from '../../model/summary.js';
import Button from '../ui/Button.jsx';
import { Tabs, TabPanel } from '../ui/Tabs.jsx';
import ArrivalSummary from './ArrivalSummary.jsx';
import ComparisonTable from './ComparisonTable.jsx';
import Charts from './Charts.jsx';
import Insights from './Insights.jsx';
import './Debrief.css';

const TABS = [
  { id: 'table', label: 'Table' },
  { id: 'charts', label: 'Charts' },
  { id: 'insights', label: 'Key insights' },
];

/** Phase 3: debrief. */
export default function Debrief() {
  const { config, ui } = useMissionState();
  const { rockets } = useMissionResults();
  const dispatch = useMissionDispatch();
  const announce = useAnnounce();
  const [server, setServer] = useState('idle');

  useEffect(() => {
    announce(resultSummary(rockets));
  }, [announce, rockets]);

  // Optional backend cross-check: silent when offline, never blocks the UI.
  useEffect(() => {
    const ref = rockets.find((r) => !r.failed && r.key !== 'player');
    if (!ref) return undefined;
    const ctrl = new AbortController();
    crossCheckMission(config, ref, { signal: ctrl.signal }).then((status) => {
      if (!ctrl.signal.aborted) setServer(status);
    });
    return () => ctrl.abort();
  }, [config, rockets]);

  return (
    <section className="debrief" aria-labelledby="debrief-title">
      <div className="section-head">
        <h2 id="debrief-title" tabIndex={-1}>
          Mission debrief
        </h2>
        {server === 'agrees' && <p className="tag debrief__server">Server cross-check agrees</p>}
        {server === 'differs' && (
          <p className="tag debrief__server debrief__server--warn">Server cross-check differs</p>
        )}
      </div>
      <ArrivalSummary rockets={rockets} />
      <Tabs
        label="Debrief views"
        idPrefix="debrief"
        tabs={TABS}
        value={ui.debriefTab}
        onChange={(t) => dispatch(actions.setDebriefTab(t))}
      />
      <TabPanel idPrefix="debrief" id={ui.debriefTab}>
        {ui.debriefTab === 'table' && <ComparisonTable rockets={rockets} />}
        {ui.debriefTab === 'charts' && <Charts rockets={rockets} />}
        {ui.debriefTab === 'insights' && <Insights rockets={rockets} config={config} />}
      </TabPanel>
      <Button variant="primary" size="lg" block onClick={() => dispatch(actions.reset())}>
        New mission
      </Button>
    </section>
  );
}
