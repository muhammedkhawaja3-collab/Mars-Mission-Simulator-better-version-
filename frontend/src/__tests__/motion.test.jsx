import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, tick } from '../test/renderApp.jsx';
import { setReducedMotion } from '../test/setup.js';
import { initialState } from '../state/missionReducer.js';

vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.reject(new Error('offline'))) } }));

describe('reduced motion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows the OS setting and can be toggled in the header', async () => {
    setReducedMotion(true);
    const { user } = renderApp({ fakeTimers: true });
    const toggle = screen.getByRole('button', { name: 'Reduce motion' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.motion).toBe('full');
  });

  it('disables JS-driven cockpit effects (no starfield scroll, no event flashes)', async () => {
    setReducedMotion(true);
    // A high-risk seed so the replay has events to (not) animate.
    const start = {
      ...initialState,
      config: { ...initialState.config, riskTolerance: 10, seed: 7 },
      ui: { ...initialState.ui, flightView: 'cockpit' },
    };
    const { user, container } = renderApp({ initialState: start, fakeTimers: true });
    await user.click(screen.getByRole('button', { name: 'Initiate launch sequence' }));
    await tick(5200);
    await user.click(screen.getByRole('tab', { name: 'Cockpit view' }));
    const stars = () =>
      [...document.querySelectorAll('.cockpit__layer--near circle')].map((c) =>
        c.getAttribute('cx'),
      );
    const first = stars();
    await tick(20000);
    expect(stars()).toEqual(first);
    expect(container.ownerDocument.querySelector('.cockpit__window[data-effect]')).toBeNull();
  });

  it('with motion allowed the starfield scrolls with the replay', async () => {
    setReducedMotion(false);
    const { user } = renderApp({ fakeTimers: true });
    await user.click(screen.getByRole('button', { name: 'Initiate launch sequence' }));
    await tick(5200);
    await user.click(screen.getByRole('tab', { name: 'Cockpit view' }));
    const stars = () =>
      [...document.querySelectorAll('.cockpit__layer--near circle')].map((c) =>
        c.getAttribute('cx'),
      );
    const first = stars();
    await tick(5000);
    expect(stars()).not.toEqual(first);
  });
});
