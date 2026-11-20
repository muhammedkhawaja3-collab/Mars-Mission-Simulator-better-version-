import './PartPicker.css';

/**
 * Single-choice part selector: a native radio group styled as cards
 * (arrow keys move between options; the legend names the group).
 * @param {{legend: string, name: string, value: string|null, onChange: (id: string) => void,
 *   options: Array<{id: string, name: string, meta?: React.ReactNode, desc: string, warning?: string}>,
 *   intro?: React.ReactNode}} props
 */
export default function PartPicker({ legend, name, value, onChange, options, intro }) {
  return (
    <fieldset className="part-picker">
      <legend className="part-picker__legend">{legend}</legend>
      {intro && <p className="part-picker__intro">{intro}</p>}
      <div className="part-picker__grid">
        {options.map((o) => {
          const id = `${name}-${o.id}`;
          return (
            <div key={o.id} className="part-card" data-warning={o.warning ? true : undefined}>
              <input
                id={id}
                className="part-card__input"
                type="radio"
                name={name}
                value={o.id}
                checked={value === o.id}
                onChange={() => onChange(o.id)}
                aria-describedby={`${id}-desc`}
              />
              <label htmlFor={id} className="part-card__label">
                <span className="part-card__name">{o.name}</span>
                {o.meta && <span className="part-card__meta">{o.meta}</span>}
              </label>
              <p id={`${id}-desc`} className="part-card__desc">
                {o.desc}
                {o.warning && <strong className="part-card__warning"> {o.warning}</strong>}
              </p>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
