import './StatusBar.css';

const TEXT = {
  setup: 'Configure the mission, then launch.',
  countdown: 'Launch sequence: countdown in progress.',
  flight: 'Earth → Mars transit replay in progress.',
  debrief: 'All vehicles reported. Mission debrief ready.',
};

const STEPS = [
  { id: 'setup', label: 'Configure' },
  { id: 'countdown', label: 'Launch' },
  { id: 'flight', label: 'Transit' },
  { id: 'debrief', label: 'Debrief' },
];

/** Mission phase indicator (an ordered list with the current step marked). */
export default function StatusBar({ phase }) {
  const current = STEPS.findIndex((s) => s.id === phase);
  return (
    <div className="status">
      <ol className="status__steps" aria-label="Mission progress">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className="status__step"
            data-state={i < current ? 'done' : i === current ? 'current' : 'todo'}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="status__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="status__text">{TEXT[phase]}</p>
    </div>
  );
}
