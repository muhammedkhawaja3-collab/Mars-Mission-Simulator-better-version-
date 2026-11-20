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

  it('has a launch-vehicle selector and fixed window ids; Starship keeps its own launcher', () => {
    const lv = container.querySelector('#launch-vehicle');
    const win = container.querySelector('#launch-window');
    expect([...lv.options].map(o => o.value)).toEqual(['starship', 'sls-block1', 'sls-block2', 'falcon-heavy', 'new-glenn']);
    expect([...win.options].map(o => o.value)).toEqual(['2026-11', '2028-12', '2031-01', '2033-03', '2035-07']);
    expect(win.value).toBe('2028-12');
    expect(container.textContent).toContain('2029 window');
    const launches = () => [...container.querySelectorAll('.rocket-card .csg-item')]
      .filter(el => el.querySelector('.csg-l')?.textContent === 'LAUNCHES')
      .map(el => el.querySelector('.csg-v').textContent);
    const before = launches();
    act(() => {
      lv.value = 'new-glenn';
      lv.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const after = launches();
    expect(after[0]).not.toBe(before[0]); // chemical stack needs more 45 t launches
    expect(after[2]).toBe(before[2]); // Starship stage still flies on Starship
    expect(container.textContent).not.toMatch(/bone loss/i);
  });

  it('explains the success estimate with factors', () => {
    expect(container.querySelectorAll('.success-factors').length).toBe(3);
    expect(container.textContent).toMatch(/Why [\d.]+% success\?/);
    expect(container.textContent).toContain('Crewed launch');
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
