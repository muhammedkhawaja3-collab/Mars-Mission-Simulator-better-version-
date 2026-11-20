import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: role="dialog" + aria-modal, labelled by its title, Esc to
 * close, Tab/Shift+Tab trapped inside, focus returned to the opener on close,
 * the rest of the app made inert and page scroll locked while open.
 */
export default function Dialog({ open, onClose, title, description, className = '', children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      root?.removeAttribute('inert');
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop">
      {/* Backdrop click closes; keyboard users close with Esc or the Cancel button. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="dialog-backdrop__scrim" onClick={() => onCloseRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        tabIndex={-1}
        className={['dialog', className].filter(Boolean).join(' ')}
      >
        <h2 id="dialog-title" className="dialog__title">
          {title}
        </h2>
        {description && (
          <p id="dialog-description" className="dialog__description">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
