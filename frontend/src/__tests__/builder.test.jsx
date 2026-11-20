import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp.jsx';

vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.reject(new Error('offline'))) } }));

describe('rocket builder dialog', () => {
  it('is a labelled modal dialog that takes focus, closes on Esc and returns focus', async () => {
    const { user } = renderApp();
    const opener = screen.getByRole('button', { name: /Build your rocket/ });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Build your rocket' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Rocket name')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('traps Tab inside the dialog', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /Build your rocket/ }));
    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    cancel.focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement);
    expect(screen.getByLabelText('Rocket name')).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
  });

  it('uses labelled colour swatches, a tabs pattern and radio parts; saving adds the rocket to the comparison', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /Build your rocket/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: 'Cyan' })).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Lock in & fly' });
    expect(save).toBeDisabled();

    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Engine (required)',
      'Tank',
      'Shielding',
      'Habitat',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'Tank' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByRole('tabpanel', { name: 'Tank' })).toBeInTheDocument();
    await user.keyboard('{Home}');

    await user.clear(within(dialog).getByLabelText('Rocket name'));
    await user.type(within(dialog).getByLabelText('Rocket name'), 'ares');
    await user.click(within(dialog).getByRole('radio', { name: /RL-10B-2/ }));
    await user.click(within(dialog).getByRole('radio', { name: 'Cyan' }));
    expect(within(dialog).getByText(/Δv required \(TMI \+ capture\)/)).toBeInTheDocument();
    expect(save).toBeEnabled();
    await user.click(save);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'ARES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redesign ARES' })).toBeInTheDocument();
  });

  it('electric engines are flagged and produce an infeasible (not exploding) result', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /Build your rocket/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /VASIMR/ }));
    expect(within(dialog).getByText(/Mission not feasible:/)).toBeInTheDocument();
    expect(within(dialog).getByText(/5.7 N of thrust cannot perform/)).toBeInTheDocument();
  });
});
