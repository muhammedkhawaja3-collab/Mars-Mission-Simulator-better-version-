import './Field.css';

/**
 * Labelled native <select>.
 * @param {{id: string, label: React.ReactNode, value: string, onChange: (v: string) => void,
 *   options: Array<{value: string, label: string, disabled?: boolean}>, hint?: React.ReactNode}} props
 */
export default function Select({ id, label, value, onChange, options, hint }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select"
        value={value}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
