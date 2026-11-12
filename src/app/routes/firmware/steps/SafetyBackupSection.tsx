import { useRef, useState } from 'react';

import type { FirmwarePreflightSafetyBackup } from '@integrations/radio-io';

import { Button, Panel, StatusBanner, TextInput } from '../../../components/v2/index.ts';
import {
  grantFirmwareSafetyBackupPort,
  recordFirmwareSafetyBackupSaved,
  runFirmwareSafetyBackup,
  recordFirmwareSafetyBackupFile,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { SafetyBackupStatus } from '../firmwareWizardState.ts';
import LabeledCheck from './LabeledCheck.tsx';
import type { WizardStepProps } from './stepTypes.ts';

/**
 * The radio's required "safety backup saved for this radio" step. "This radio" is the serial typed from its
 * label. Generic: all copy, the link and the read come from the descriptor.
 */
export default function SafetyBackupSection({
  state,
  dispatch,
  updater,
  safety,
}: WizardStepProps & { safety: FirmwarePreflightSafetyBackup }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordFailed, setRecordFailed] = useState(false);

  const serialKey = safety.normaliseSerial(state.safetyBackupSerial);
  const status = state.safetyBackup;

  const run = async () => {
    setBusy(true);
    setError(null);
    setProgress(null);
    setRecordFailed(false);
    dispatch({ type: 'safetyBackupCleared' });
    try {
      const port = await grantFirmwareSafetyBackupPort(updater.radioId);
      const out = await runFirmwareSafetyBackup({
        radioId: updater.radioId,
        port,
        serial: state.safetyBackupSerial,
        onProgress: (p) => setProgress(p.msg),
      });
      if (!out.ok) {
        setError(out.message);
      } else if (out.outcome.kind === 'already-saved') {
        dispatch({
          type: 'safetyBackupResult',
          status: {
            kind: 'saved',
            radioKey: out.outcome.radioKey,
            summary: out.outcome.summary,
          },
        });
      } else {
        const o = out.outcome;
        dispatch({
          type: 'safetyBackupResult',
          status: {
            kind: 'taken',
            ticked: false,
            radioKey: o.radioKey,
            summary: o.summary,
            region: o.region,
            fileName: o.fileName,
            sha256: o.sha256,
            fingerprint: o.fingerprint,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The safety backup did not run.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const tick = (taken: Extract<SafetyBackupStatus, { kind: 'taken' }>) => {
    setRecordFailed(!recordFirmwareSafetyBackupSaved(updater.radioId, taken));
    dispatch({ type: 'safetyBackupTicked' });
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setRecordFailed(false);
    const out = await recordFirmwareSafetyBackupFile(
      updater.radioId,
      new Uint8Array(await file.arrayBuffer()),
      state.safetyBackupSerial,
    );
    if (fileRef.current) fileRef.current.value = '';
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setRecordFailed(!out.recorded);
    // The radio must still be identified to match: press the button again.
    setError(
      `Recorded ${out.info.fileName} for serial ${out.info.radioKey}. Press the button to check this radio.`,
    );
  };

  return (
    <Panel
      title={safety.title}
      sub={`Required. Takes ${safety.expectedDuration}. Nothing is written.`}
    >
      <div className={classes.stack}>
        <p className={classes.copy}>{safety.why}</p>
        <ol className={classes.list}>
          {safety.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <TextInput
          label="Radio serial number"
          hint={safety.serialHint}
          value={state.safetyBackupSerial}
          onChange={(e) => dispatch({ type: 'setSafetyBackupSerial', value: e.target.value })}
          disabled={busy}
          mono
        />
        <div>
          <Button variant="primary" onClick={() => void run()} disabled={busy || serialKey === ''}>
            Check / take safety backup
          </Button>{' '}
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            Use a backup file I already have
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            hidden
            data-testid="safety-backup-file"
            onChange={(e) => void openFile(e.target.files?.[0])}
          />
        </div>
        {busy && progress ? <p className={classes.muted}>{progress}</p> : null}
        {status?.kind === 'saved' ? (
          <StatusBanner tone="success">
            A safety backup of this radio is already saved ({status.summary}).
          </StatusBanner>
        ) : null}
        {status?.kind === 'taken' ? (
          <div className={classes.stack}>
            <StatusBanner tone="success">
              Safety backup taken: {status.summary}. Your browser has downloaded {status.fileName}.
            </StatusBanner>
            <LabeledCheck
              label={`I've saved ${status.fileName} (fingerprint ${status.fingerprint})`}
              checked={status.ticked}
              onChange={(value) => {
                if (value && !status.ticked) tick(status);
              }}
            />
          </div>
        ) : null}
        {recordFailed ? (
          <StatusBanner tone="warning">
            This browser would not keep the record. Keep the file safe; Studio will ask again next
            time.
          </StatusBanner>
        ) : null}
        {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      </div>
    </Panel>
  );
}
