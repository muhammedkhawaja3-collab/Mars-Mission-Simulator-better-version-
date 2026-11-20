import { useCallback, useEffect, useState } from 'react';

export const INSTALL_DISMISSED_KEY = 'mars-mmc-install-dismissed';

/* localStorage can throw (private mode, blocked storage, quota): never crash. */
const safeGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

export function installInstruction(ua = '') {
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|OPR|Edg|Chrome/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPR|Edg|Chrome/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg|Edge|OPR|FxiOS|CriOS/.test(ua);
  if (isIOS && isSafari) return 'Tap the Share button, then Add to Home Screen.';
  if (isAndroid && isChrome) return 'Open the browser menu, then Add to Home Screen.';
  if (isChrome) return 'Use the install icon in the address bar, or the browser menu → Install.';
  return 'Use your browser menu to install Mars Mission Control.';
}

/**
 * PWA install prompt. The banner is deferred: it only becomes visible once
 * `ready` is true (the app passes "a first mission has been flown"), and never
 * again after the user installs or dismisses it.
 */
export default function usePwaInstall({ ready }) {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => Boolean(safeGet(INSTALL_DISMISSED_KEY)));

  useEffect(() => {
    if (dismissed) return undefined;
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
      safeSet(INSTALL_DISMISSED_KEY, 'true');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [dismissed]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    safeSet(INSTALL_DISMISSED_KEY, 'true');
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* ignore */
      }
      setDeferred(null);
    }
    dismiss();
  }, [deferred, dismiss]);

  const isStandalone =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return {
    visible: Boolean(ready) && !dismissed && !isStandalone,
    canPrompt: Boolean(deferred),
    instruction: installInstruction(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    install,
    dismiss,
  };
}
