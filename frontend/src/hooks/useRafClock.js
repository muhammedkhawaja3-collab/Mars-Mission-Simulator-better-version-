import { useCallback, useEffect, useRef, useState } from 'react';

const defaultNow = () =>
  typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

const raf = (cb) =>
  typeof window !== 'undefined' && window.requestAnimationFrame
    ? window.requestAnimationFrame(cb)
    : setTimeout(() => cb(defaultNow()), 16);
const caf = (id) =>
  typeof window !== 'undefined' && window.cancelAnimationFrame
    ? window.cancelAnimationFrame(id)
    : clearTimeout(id);

/**
 * requestAnimationFrame-driven clock for the flight replay.
 *
 * Elapsed time lives in refs, so frames that do not need a render cost
 * nothing. React state (the returned `fraction`) updates at most `fps` times a
 * second, and only in the component that owns the clock, never the app tree.
 *
 * @param {object} p
 * @param {number} p.durationMs   Replay length.
 * @param {boolean} p.running     Pauses (false) or resumes (true) without losing time.
 * @param {() => void} [p.onComplete] Called once when the clock reaches the end.
 * @param {number} [p.fps=30]     Max React updates per second.
 * @param {() => number} [p.now]  Injectable time source (tests).
 * @returns {{fraction:number, skipToEnd:() => void}}
 */
export default function useRafClock({
  durationMs,
  running,
  onComplete,
  fps = 30,
  now = defaultNow,
}) {
  const [fraction, setFraction] = useState(0);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(null);
  const lastRenderRef = useRef(-Infinity);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    elapsedRef.current = durationMs;
    setFraction(1);
    onCompleteRef.current?.();
  }, [durationMs]);

  useEffect(() => {
    if (!running || doneRef.current) return undefined;
    let id;
    lastTickRef.current = now();
    const frame = () => {
      const t = now();
      elapsedRef.current += t - lastTickRef.current;
      lastTickRef.current = t;
      if (elapsedRef.current >= durationMs) {
        finish();
        return;
      }
      if (t - lastRenderRef.current >= 1000 / fps) {
        lastRenderRef.current = t;
        setFraction(elapsedRef.current / durationMs);
      }
      id = raf(frame);
    };
    id = raf(frame);
    return () => caf(id);
  }, [running, durationMs, fps, now, finish]);

  return { fraction, skipToEnd: finish };
}
