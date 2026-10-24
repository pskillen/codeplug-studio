import { useState } from 'react';

import type { FirmwareReleaseSummary } from '@core/firmware/releases/types.ts';

import classes from './FirmwareFlasherPage.module.css';
import ReleaseNotes from './ReleaseNotes.tsx';

/** A release's published notes, loaded the first time the disclosure opens. */
export default function ReleaseNotesDisclosure({ summary }: { summary: FirmwareReleaseSummary }) {
  const [notes, setNotes] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <details
      className={classes.disclosure}
      onToggle={(e) => {
        if (!e.currentTarget.open || notes !== null || !summary.release) return;
        summary.release
          .loadNotes()
          .then(setNotes)
          .catch(() => setFailed(true));
      }}
    >
      <summary>Release notes</summary>
      {failed ? (
        <p className={classes.muted}>The release notes could not be loaded.</p>
      ) : notes === null ? (
        <p className={classes.muted}>Loading…</p>
      ) : (
        <ReleaseNotes text={notes} />
      )}
    </details>
  );
}
