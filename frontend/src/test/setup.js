import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/** jsdom has no matchMedia; tests can flip reduced motion with setReducedMotion(). */
let reducedMotion = false;
export const setReducedMotion = (value) => {
  reducedMotion = value;
};

const hasDom = typeof window !== 'undefined';

if (hasDom)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

if (hasDom) window.scrollTo = vi.fn();

/*
 * React Testing Library only cooperates with fake timers when a `jest` global
 * exists (its async wrapper and waitFor call jest.advanceTimersByTime). Under
 * Vitest there is no `jest`, so user-event would hang with vi.useFakeTimers().
 */
globalThis.jest = {
  advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms),
};

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  reducedMotion = false;
  document.documentElement.removeAttribute('data-motion');
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});
