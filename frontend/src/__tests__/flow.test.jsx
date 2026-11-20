import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, tick } from '../test/renderApp.jsx';

vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.reject(new Error('offline'))) } }));

const advance = (ms) => tick(ms);
const status = () => screen.getByRole('status', { hidden: true });

describe('launch → countdown → flight → debrief', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down with polite announcements, replays the flight and announces the results', async () => {
    const { user } = renderApp({ fakeTimers: true });
    await user.click(screen.getByRole('button', { name: 'Initiate launch sequence' }));

    // Countdown: focus moves to its heading and each number is announced politely.
    expect(screen.getByRole('heading', { name: 'Launch in' })).toHaveFocus();
    expect(status()).toHaveAttribute('aria-live', 'polite');
    await advance(100);
    expect(status()).toHaveTextContent('Launch in 5');
    await advance(1200); // the next tick, plus the announcer's re-announce delay
    expect(status()).toHaveTextContent('Launch in 4');
    await advance(4000);

    // Flight replay.
    expect(screen.getByRole('heading', { name: /Earth → Mars transit/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const lanes = within(screen.getByRole('figure', { name: /Race view/ })).getAllByRole(
      'listitem',
    );
    expect(lanes).toHaveLength(3);
    await advance(30000);
    expect(screen.getByText(/% of the replay/).textContent).toMatch(/(49|50|51)% of the replay/);

    await advance(31000);
    expect(screen.getByRole('heading', { name: 'Mission debrief' })).toHaveFocus();
    await advance(100);
    expect(status()).toHaveTextContent(
      /Mission debrief ready\. \d of 3 vehicles reached Mars\. Fastest: /,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('pause stops the replay; skip goes straight to the debrief; tabs switch views', async () => {
    const { user } = renderApp({ fakeTimers: true });
    await user.click(screen.getByRole('button', { name: 'Initiate launch sequence' }));
    await advance(5200);
    await user.click(screen.getByRole('button', { name: 'Pause replay' }));
    const before = screen.getByText(/% of the replay/).textContent;
    await advance(10000);
    expect(screen.getByText(/% of the replay/).textContent).toBe(before);

    await user.click(screen.getByRole('tab', { name: 'Cockpit view' }));
    expect(screen.getByRole('figure', { name: /first-person view/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Choose a vehicle' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip to debrief' }));
    expect(screen.getByRole('heading', { name: 'Mission debrief' })).toBeInTheDocument();

    // Debrief tabs: arrow keys move between table, charts and insights.
    const tableTab = screen.getByRole('tab', { name: 'Table' });
    tableTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Charts' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('figure').length).toBeGreaterThanOrEqual(6);
    await user.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('heading', { name: /Mission events \(gameplay model, seed 42\)/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/is best on/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'New mission' }));
    expect(screen.getByRole('heading', { name: 'Mission parameters' })).toHaveFocus();
  });

  it('the install offer is deferred until after the first mission', async () => {
    const { user } = renderApp({ fakeTimers: true });
    expect(screen.queryByRole('complementary', { name: /Install/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Initiate launch sequence' }));
    await advance(5200);
    await user.click(screen.getByRole('button', { name: 'Skip to debrief' }));
    expect(
      screen.getByRole('complementary', { name: 'Install Mars Mission Control' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss install offer' }));
    expect(screen.queryByRole('complementary', { name: /Install/ })).not.toBeInTheDocument();
  });
});
