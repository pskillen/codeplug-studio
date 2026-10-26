/**
 * "Read a radio" for the AT-D890UV settings page (#1393): reads only the settings, stores the
 * result as the page's Radio column, and sets no override.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mantine/core';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  AT_D890_SETTINGS_READ_RESTART_NOTE,
  readAtD890SettingsFromRadio,
  type AtD890SettingsReadStage,
} from '../../services/radioIoAtD890SettingsRead.ts';
import {
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
} from '../../services/radioIoSession.ts';
import { setRead } from '../../state/atD890RadioSettingsSession.ts';
import { Button } from '../v2/index.ts';
import classes from './AtD890RadioSettingsEditor.module.css';

export interface AtD890RadioSettingsReadButtonProps {
  buildId: string;
  egress: EgressPath;
  /** Button style; the settings page leads with it, the Export card keeps Write as the one primary. */
  variant?: 'primary' | 'secondary';
}

const STAGE_TEXT: Record<AtD890SettingsReadStage | 'choosing', string> = {
  choosing: 'Choose the radio in the port picker…',
  connecting: 'Connecting to the radio…',
  reading: 'Reading the radio’s settings…',
};

export default function AtD890RadioSettingsReadButton({
  buildId,
  egress,
  variant = 'primary',
}: AtD890RadioSettingsReadButtonProps) {
  const [stage, setStage] = useState<AtD890SettingsReadStage | 'choosing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartNote, setRestartNote] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const supported = isRadioSerialSupported();
  const busy = stage !== null;

  async function onRead() {
    setError(null);
    setRestartNote(false);
    setStage('choosing');
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const read = await readAtD890SettingsFromRadio(egress, {
        signal: abort.signal,
        onStage: setStage,
      });
      setRead(buildId, read);
      setRestartNote(true);
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setStage(null);
    }
  }

  return (
    <div className={classes.readArea}>
      <div className={classes.readControls}>
        <Button
          variant={variant}
          size="sm"
          disabled={!supported || busy}
          loading={busy}
          onClick={() => void onRead()}
        >
          Read a radio
        </Button>
        {busy ? (
          <>
            <span className={classes.readStage} role="status">
              {STAGE_TEXT[stage]}
            </span>
            {/* The browser's port picker cannot be aborted from here; Cancel starts once it closes. */}
            {stage !== 'choosing' ? (
              <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {!supported ? (
        <Alert color="yellow" title="Web Serial is not available">
          {getRadioSerialUnsupportedMessage()}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          color="red"
          title="Could not read the radio"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}
      {restartNote ? (
        <div className={classes.readNote}>{AT_D890_SETTINGS_READ_RESTART_NOTE}</div>
      ) : null}
    </div>
  );
}
