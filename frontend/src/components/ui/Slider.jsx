import './Field.css';

/**
 * Labelled range input. `valueText` is spoken by screen readers
 * (aria-valuetext) and `hint` is linked with aria-describedby.
 */
export default function Slider({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  valueText,
  hint,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__row">
        <input
          id={id}
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueText}
          aria-describedby={hintId}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output className="field__output" htmlFor={id} aria-hidden="true">
          {value}
        </output>
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
