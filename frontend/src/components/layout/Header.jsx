import { useMotion } from '../../state/context.js';
import UtcClock from './UtcClock.jsx';
import './Header.css';

export default function Header() {
  const { reduced, toggle } = useMotion();
  return (
    <header className="header">
      <div className="container header__inner">
        <div className="header__brand">
          <svg className="header__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle cx="16" cy="16" r="10" fill="var(--color-mars)" />
            <ellipse
              cx="16"
              cy="16"
              rx="15"
              ry="5"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
            />
          </svg>
          <div>
            <h1 className="header__title">Mars Mission Control</h1>
            <p className="header__tagline">
              Plan a crewed Earth → Mars mission and compare propulsion trade-offs. Every number
              comes from a patched-conic physics engine.
            </p>
          </div>
        </div>
        <div className="header__tools">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-pressed={reduced}
            onClick={toggle}
          >
            Reduce motion
          </button>
          <UtcClock />
        </div>
      </div>
    </header>
  );
}
