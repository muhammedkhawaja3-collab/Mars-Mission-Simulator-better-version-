import useUtcClock from '../../hooks/useUtcClock.js';

/** Isolated UTC clock: its once-a-second update re-renders only this element. */
export default function UtcClock() {
  const time = useUtcClock();
  return (
    <div className="header__clock">
      <span className="caption">UTC</span>
      {/* Not a live region: a ticking clock would be announced every second. */}
      <time className="header__time">{time}</time>
    </div>
  );
}
