import './Stat.css';

/** Grid of label/value pairs, rendered as a description list. */
export function StatGrid({ className = '', children }) {
  return <dl className={['stat-grid', className].filter(Boolean).join(' ')}>{children}</dl>;
}

/**
 * One label/value pair. `tone` colours the value and must be paired with a
 * word in the value or `note` (never colour alone).
 * @param {{label: React.ReactNode, value: React.ReactNode, note?: React.ReactNode, tone?: 'success'|'warning'|'danger'}} props
 */
export default function Stat({ label, value, note, tone }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className={['stat__value', tone && `stat__value--${tone}`].filter(Boolean).join(' ')}>
        {value}
        {note && <span className="stat__note"> {note}</span>}
      </dd>
    </div>
  );
}
