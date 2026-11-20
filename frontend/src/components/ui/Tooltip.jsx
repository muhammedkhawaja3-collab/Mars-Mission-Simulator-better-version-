import { useId, useState } from 'react';
import './Tooltip.css';

/**
 * Glossary tooltip for a term (WCAG 1.4.13: hoverable, dismissable with Esc,
 * persistent while hovered/focused). The trigger is a real button and the
 * definition is linked with aria-describedby, so it is announced on focus.
 */
export default function Tooltip({ term, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    // Hover handlers only mirror the button's focus behaviour; keyboard users get the same tip on focus.
    <span
      className="tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tooltip__trigger"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        {term}
      </button>
      <span role="tooltip" id={id} className="tooltip__bubble" data-open={open}>
        {children}
      </span>
    </span>
  );
}
