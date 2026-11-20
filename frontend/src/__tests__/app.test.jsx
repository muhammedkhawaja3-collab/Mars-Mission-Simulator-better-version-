import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// The backend call is optional (the UI computes everything locally); keep tests offline.
vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.reject(new Error('offline'))) } }));

import App from '../App.jsx';

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const findButton = (container, text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));

describe('App wired to the physics engine', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<App />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders the configuration screen with engine-computed fleet stats and no rigged winner copy', () => {
    const text = container.textContent;
    expect(text).toContain('TRADE-OFFS — SAME MISSION, PHYSICS DECIDES');
    expect(text).toContain('Nuclear Thermal');
    expect(text).toContain('Starship');
    expect(text).toContain('Chemical');
    expect(text).not.toMatch(/DOMINATES/i);
    expect(text).not.toMatch(/superior/i);
    expect(text).toMatch(/\d+(\.\d)?d/); // transit days rendered
  });

  it('switching to the minimum-energy transfer gives every vehicle the same transit time', () => {
    const select = container.querySelector('#transfer-strategy');
    act(() => {
      select.value = 'hohmann';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const transits = [...container.querySelectorAll('.rocket-card .csg-item')]
      .filter(el => el.querySelector('.csg-l')?.textContent === 'TRANSIT')
      .map(el => el.querySelector('.csg-v').textContent);
    expect(transits).toHaveLength(3);
    expect(new Set(transits).size).toBe(1);
  });

  it('runs launch → race → debrief and shows generated trade-off insights', async () => {
    click(findButton(container, 'INITIATE LAUNCH SEQUENCE'));
    await act(async () => { await Promise.resolve(); }); // let the (rejected) API call settle
    await act(async () => { vi.advanceTimersByTime(6000); }); // countdown
    await act(async () => { vi.advanceTimersByTime(62000); }); // 60 s race + debrief delay
    expect(container.textContent).toContain('MISSION DEBRIEF');
    click(findButton(container, 'KEY INSIGHTS'));
    expect(container.textContent).toContain('FLEET TRADE-OFFS');
    expect(container.textContent).toMatch(/is best on/);
  });
});
