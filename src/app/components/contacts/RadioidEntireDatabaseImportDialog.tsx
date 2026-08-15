import { useRef, useState } from 'react';
import { Progress, Text } from '@mantine/core';
import { persistence } from '../../state/persistence.ts';
import {
  formatRadioidDumpProgressPercent,
  runRadioidDumpImport,
  type RadioidDumpIngestProgress,
  type RadioidDumpIngestResult,
} from '../../lib/radioidDumpImport.ts';
import Button from '../v2/Button.tsx';
import Checkbox from '../v2/Checkbox.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface RadioidEntireDatabaseImportDialogProps {
  opened: boolean;
  onClose: () => void;
  onComplete: () => void;
  sessionKey: number;
  projectId: string | null;
}

type DialogPhase = 'confirm' | 'running' | 'done';

function RadioidEntireDatabaseImportDialogBody({
  projectId,
  onClose,
  onComplete,
}: Omit<RadioidEntireDatabaseImportDialogProps, 'opened' | 'sessionKey'>) {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState<RadioidDumpIngestProgress | null>(null);
  const [result, setResult] = useState<RadioidDumpIngestResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleStart() {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('running');
    setProgress(null);
    setResult(null);

    const importResult = await runRadioidDumpImport({
      projectId,
      persistence,
      signal: controller.signal,
      onProgress: setProgress,
    });

    abortRef.current = null;
    setResult(importResult);
    setPhase('done');
    if (!importResult.error && importResult.written > 0) {
      onComplete();
    }
  }

  function handleCancelRunning() {
    abortRef.current?.abort();
  }

  const bytePercent = formatRadioidDumpProgressPercent(
    progress?.bytesRead ?? 0,
    progress?.totalBytes ?? null,
  );

  if (phase === 'confirm') {
    return (
      <div className={classes.body}>
        <StatusBanner tone="warning">
          <strong>Caution — 300,000+ records.</strong> This downloads RadioID.net&apos;s daily
          worldwide user database into your local directory shadow store. The import may take
          several minutes and can strain mobile browser tabs or IndexedDB quota. Library contacts
          are not changed.
        </StatusBanner>
        <Text size="sm" c="dimmed">
          Community-maintained data — verify before use on air. Existing directory rows with the
          same DMR ID are updated from the dump snapshot.
        </Text>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
          <Checkbox
            checked={confirmed}
            onCheckedChange={setConfirmed}
            aria-label="Confirm entire database import"
          />
          I understand this imports the entire RadioID.net user database into my local directory
          shadow store
        </label>
        {!projectId ? (
          <StatusBanner tone="warning">
            Select an active project before importing the database.
          </StatusBanner>
        ) : null}
        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!projectId || !confirmed}
            onClick={() => void handleStart()}
          >
            Import entire database
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className={classes.body}>
        <Text size="sm">{progress?.message ?? 'Starting…'}</Text>
        <Progress value={bytePercent ?? 0} animated={bytePercent == null} />
        <Text size="sm" c="dimmed">
          {progress
            ? `${progress.written.toLocaleString()} IDs written · skipped ${progress.skipped}`
            : 'Preparing…'}
          {bytePercent != null ? ` · ${bytePercent}% downloaded` : ''}
        </Text>
        <div className={classes.footer}>
          <Button variant="destructive" onClick={handleCancelRunning}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const summary = result;
  return (
    <div className={classes.body}>
      {summary?.error ? (
        <StatusBanner tone="warning">Import stopped: {summary.error}</StatusBanner>
      ) : null}
      {summary?.cancelled ? (
        <StatusBanner tone="warning">
          Import cancelled — partial results were saved to the directory before cancellation.
        </StatusBanner>
      ) : null}
      <Text size="sm">
        Imported <strong>{summary?.written ?? 0}</strong>, skipped invalid{' '}
        <strong>{summary?.skipped ?? 0}</strong>
        {(summary?.failed ?? 0) > 0 ? (
          <>
            , failed <strong>{summary?.failed}</strong>
          </>
        ) : null}
        .
      </Text>
      <div className={classes.footer}>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function RadioidEntireDatabaseImportDialog({
  opened,
  onClose,
  sessionKey,
  ...rest
}: RadioidEntireDatabaseImportDialogProps) {
  return (
    <ModalShell
      open={opened}
      onClose={onClose}
      title="Import entire RadioID.net database"
      dismissible={false}
      size="md"
    >
      {opened ? (
        <RadioidEntireDatabaseImportDialogBody key={sessionKey} {...rest} onClose={onClose} />
      ) : null}
    </ModalShell>
  );
}
