import { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
export const formatUtc = (d) =>
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

/**
 * Current UTC time as HH:MM:SS, updated once per second. Only the component
 * that calls this re-renders (the clock is isolated from the app tree).
 */
export default function useUtcClock() {
  const [time, setTime] = useState(() => formatUtc(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatUtc(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}
