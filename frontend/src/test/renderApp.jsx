import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../App.jsx';

/**
 * Renders the full app. The flight replay's time source is Date.now, which
 * vi.useFakeTimers() controls together with requestAnimationFrame, so
 * vi.advanceTimersByTime(ms) moves the countdown and the replay in step.
 */
export function renderApp({ initialState, fakeTimers = false } = {}) {
  const user = fakeTimers
    ? userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    : userEvent.setup();
  const utils = render(<App now={() => Date.now()} initialState={initialState} />);
  return { ...utils, user };
}

/**
 * Advances fake timers in small steps inside act(), so effects scheduled by
 * each render (e.g. the next countdown tick) are registered before the next step.
 */
export async function tick(ms, step = 250) {
  for (let done = 0; done < ms; done += step) {
    await act(async () => {
      vi.advanceTimersByTime(Math.min(step, ms - done));
    });
  }
}
