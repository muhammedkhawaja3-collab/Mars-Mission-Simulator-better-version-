import { useCallback, useEffect, useMemo, useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';
import { MotionContext } from './context.js';

/**
 * Reduced-motion preference for JS-driven effects. Starts from the OS
 * setting; the header toggle can override it for this session. Mirrors the
 * choice onto <html data-motion> so CSS animations stop too.
 */
export default function MotionProvider({ children }) {
  const system = usePrefersReducedMotion();
  const [override, setOverride] = useState(null);
  const reduced = override ?? system;

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  }, [reduced]);

  const toggle = useCallback(() => setOverride((o) => !(o ?? system)), [system]);
  const value = useMemo(() => ({ reduced, toggle }), [reduced, toggle]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}
