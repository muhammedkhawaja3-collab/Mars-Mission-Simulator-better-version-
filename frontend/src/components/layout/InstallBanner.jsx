import Button from '../ui/Button.jsx';
import './InstallBanner.css';

/** PWA install offer. Shown only after a first mission (see usePwaInstall). */
export default function InstallBanner({ instruction, canPrompt, onInstall, onDismiss }) {
  return (
    <aside className="install-banner" aria-labelledby="install-title">
      <div className="container install-banner__inner">
        <div>
          <h2 id="install-title" className="install-banner__title">
            Install Mars Mission Control
          </h2>
          <p className="install-banner__text">
            Works offline once installed. {canPrompt ? '' : instruction}
          </p>
        </div>
        <div className="install-banner__actions">
          {canPrompt && (
            <Button variant="primary" size="sm" onClick={onInstall}>
              Install
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss install offer">
            Not now
          </Button>
        </div>
      </div>
    </aside>
  );
}
