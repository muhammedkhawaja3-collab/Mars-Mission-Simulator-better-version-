import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderApp } from '../test/renderApp.jsx';

vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.reject(new Error('offline'))) } }));

describe('setup screen', () => {
  it('renders immediately (no forced splash) with landmarks, a skip link and ordered headings', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mars Mission Control' }),
    ).toBeInTheDocument();
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(
      expect.arrayContaining(['Mission parameters', 'Reference fleet', 'Your rocket']),
    );
    expect(screen.queryByText(/INITIALIZING SYSTEMS/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Initiate launch sequence' })).toBeEnabled();
  });

  it('associates a label with every control and gives sliders aria-valuetext', () => {
    renderApp();
    const crew = screen.getByLabelText('Crew size');
    expect(crew).toHaveAttribute('type', 'range');
    expect(crew).toHaveAttribute('aria-valuetext', '4 crew');
    expect(crew).toHaveAccessibleDescription(/4 crew · .* t habitat/);
    const risk = screen.getByLabelText('Risk tolerance');
    expect(risk.getAttribute('aria-valuetext')).toMatch(
      /5 of 10, Balanced, \d+ percent delta-v reserve/,
    );
    expect(screen.getByLabelText('Launch window').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Launch vehicle').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Transfer strategy').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Event seed')).toHaveValue(42);
    // No unlabelled form controls anywhere on the page.
    for (const el of document.querySelectorAll('input, select, textarea')) {
      expect(el).toHaveAccessibleName();
    }
  });

  it('is keyboard operable: Tab reaches the controls in order and selects change the engine results', async () => {
    const { user } = renderApp();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reduce motion' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Crew size')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Launch window')).toHaveFocus();

    const win = screen.getByLabelText('Launch window');
    expect([...win.options].map((o) => o.value)).toEqual([
      '2026-11',
      '2028-12',
      '2031-01',
      '2033-03',
      '2035-07',
    ]);
    expect(win).toHaveValue('2028-12');
    expect(screen.getByLabelText('Launch window')).toHaveAccessibleDescription(/2029 window/);

    const launchesOf = (name) =>
      within(screen.getByRole('article', { name })).getByText('Launches').nextSibling.textContent;
    const chemBefore = launchesOf('Chemical');
    const shipBefore = launchesOf('Starship');
    await user.selectOptions(screen.getByLabelText('Launch vehicle'), 'new-glenn');
    expect(launchesOf('Chemical')).not.toBe(chemBefore); // more, smaller launches
    expect(launchesOf('Starship')).toBe(shipBefore); // Starship always flies on Starship
  });

  it('Hohmann transfer gives every vehicle the same transit time; sliders update hints', async () => {
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText('Transfer strategy'), 'hohmann');
    const transits = ['Chemical', 'Nuclear Thermal', 'Starship'].map(
      (name) =>
        within(screen.getByRole('article', { name })).getByText('Transit').nextSibling.textContent,
    );
    expect(new Set(transits).size).toBe(1);
    fireEvent.change(screen.getByLabelText('Crew size'), { target: { value: '6' } });
    expect(screen.getByLabelText('Crew size')).toHaveAttribute('aria-valuetext', '6 crew');
  });

  it('shows neutral, engine-generated trade-offs with explained success factors', () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: /Trade-offs: same mission, physics decides/ }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/DOMINATES|superior|bone loss/i);
    expect(screen.getAllByText(/Why [\d.]+% success\?/)).toHaveLength(3);
    expect(screen.getAllByText(/is best on/).length).toBeGreaterThan(0);
  });

  it('vehicle include toggles use aria-pressed and keep at least one vehicle', async () => {
    const { user } = renderApp();
    const toggle = screen.getByRole('button', { name: /In comparison: Nuclear Thermal/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(
      screen.getByRole('button', { name: /Add to comparison: Nuclear Thermal/ }),
    ).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: /In comparison: Chemical/ }));
    expect(screen.getByRole('button', { name: /In comparison: Starship/ })).toBeDisabled();
  });
});
