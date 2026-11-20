import { useEffect, useState } from 'react';
import { COUNTDOWN_SECONDS } from '../../model/catalog.js';
import { useAnnounce } from '../../state/context.js';
import Button from '../ui/Button.jsx';
import './Countdown.css';

/** Launch countdown. Each number is announced politely; Cancel returns to setup. */
export default function Countdown({ onDone, onCancel }) {
  const [n, setN] = useState(COUNTDOWN_SECONDS);
  const announce = useAnnounce();

  useEffect(() => {
    announce(n > 0 ? `Launch in ${n}` : 'Liftoff');
    if (n <= 0) {
      onDone();
      return undefined;
    }
    const id = setTimeout(() => setN((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [n, onDone, announce]);

  return (
    <section className="countdown" aria-labelledby="countdown-title">
      <h2 id="countdown-title" className="countdown__label">
        Launch in
      </h2>
      <p className="countdown__number" aria-hidden="true">
        {Math.max(n, 0)}
      </p>
      <p className="countdown__sub">seconds · all systems go</p>
      <Button variant="ghost" onClick={onCancel}>
        Cancel launch
      </Button>
    </section>
  );
}
