import { useCallback, useRef, useState } from 'react';
import { AnnouncerContext } from '../../state/context.js';

/**
 * Provides announce(message) and renders one polite live region
 * (role="status"). Repeated identical messages are re-announced by clearing
 * the region first. Children do not re-render when a message changes,
 * because the provided function is stable.
 */
export default function LiveAnnouncer({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  const announce = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage('');
    timer.current = setTimeout(() => setMessage(text), 50);
  }, []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
