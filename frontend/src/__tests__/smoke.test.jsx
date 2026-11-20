import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

describe('test environment smoke test', () => {
  it('runs in jsdom', () => {
    expect(typeof window).toBe('object');
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });

  it('can render a React element', () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<h1>Mars Mission Control</h1>);
    });
    expect(container.textContent).toBe('Mars Mission Control');
    act(() => root.unmount());
  });
});
