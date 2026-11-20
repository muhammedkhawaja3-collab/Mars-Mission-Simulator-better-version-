import { useRef } from 'react';
import './Tabs.css';

const tabId = (prefix, id) => `${prefix}-tab-${id}`;
const panelId = (prefix, id) => `${prefix}-panel-${id}`;

/**
 * WAI-ARIA tabs (automatic activation): Left/Right/Home/End move focus and
 * select; only the selected tab is in the Tab order.
 * @param {{label: string, idPrefix: string, tabs: Array<{id: string, label: React.ReactNode}>,
 *   value: string, onChange: (id: string) => void}} props
 */
export function Tabs({ label, idPrefix, tabs, value, onChange }) {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.id === value);
    const next = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current[id]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, t.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, t.id)}
            tabIndex={selected ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Panel for the selected tab. Render only the active one. */
export function TabPanel({ idPrefix, id, className = '', children }) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      className={['tabs__panel', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
