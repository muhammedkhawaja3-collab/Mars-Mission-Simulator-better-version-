import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getMatch = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;

/** True when the OS asks for reduced motion; follows changes live. */
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(getMatch);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}
