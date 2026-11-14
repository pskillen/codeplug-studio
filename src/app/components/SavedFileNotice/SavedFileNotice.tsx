import { useEffect, useState } from 'react';
import { subscribeNativeSaves, type NativeSaveEvent } from '@integrations/download/nativeSave.ts';
import { DesignSystemV2Provider, DismissibleNotice } from '../v2/index.ts';
import classes from './SavedFileNotice.module.css';

/** How long the notice stays up after a save, in ms. */
export const SAVED_FILE_NOTICE_MS = 10_000;

function message(event: NativeSaveEvent): string {
  if (event.status === 'failed') {
    return `Couldn't save ${event.fileName}: ${event.message}`;
  }
  const { result } = event;
  return result.place === 'documents'
    ? `Saved to ${result.displayPath}`
    : `${result.fileName} is ready: pick an app in the share sheet to keep or send it`;
}

/**
 * Android app: says where the last saved file went (every download goes through `downloadBlob`, which saves on the
 * device there). Renders nothing in a browser, where the browser's own download UI does this.
 */
export default function SavedFileNotice() {
  const [shown, setShown] = useState<{ id: number; event: NativeSaveEvent } | null>(null);

  useEffect(() => {
    let id = 0;
    return subscribeNativeSaves((event) => {
      id += 1;
      setShown({ id, event });
    });
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), SAVED_FILE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;

  return (
    <DesignSystemV2Provider>
      <div className={classes.ribbon} role="status" aria-live="polite">
        <div className={classes.inner}>
          <DismissibleNotice
            key={shown.id}
            tone={shown.event.status === 'failed' ? 'warning' : 'info'}
            onDismiss={() => setShown(null)}
          >
            {message(shown.event)}
          </DismissibleNotice>
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
