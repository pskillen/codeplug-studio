import { useMemo, useRef, useState } from 'react';
import { Progress, Stack, Text } from '@mantine/core';
import type { DigitalContact } from '@core/models/library.ts';
import type { RadioidDmrUserListing } from '@integrations/radioid/index.ts';
import type { RadioidSearchFilters } from '../../hooks/useRadioidContactSearch.ts';
import { persistence } from '../../state/persistence.ts';
import {
  countRadioidBulkImportTargets,
  formatRadioidBulkImportEta,
  runRadioidBulkImport,
  type RadioidBulkImportProgress,
  type RadioidBulkImportResult,
  type RadioidBulkImportScope,
} from '../../lib/radioidBulkImport.ts';
import Button from '../v2/Button.tsx';
import Checkbox from '../v2/Checkbox.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface RadioidContactBulkImportDialogProps {
  opened: boolean;
  onClose: () => void;
  onComplete: () => void;
  sessionKey: number;
  scope: RadioidBulkImportScope;
  listings: RadioidDmrUserListing[];
  filters: RadioidSearchFilters;
  totalPages: number;
  totalCount: number;
  projectId: string | null;
  contacts: readonly DigitalContact[];
}

type DialogPhase = 'confirm' | 'running' | 'done';

function scopeTitle(scope: RadioidBulkImportScope): string {
  switch (scope) {
    case 'all':
      return 'Import all search results';
    case 'page':
      return 'Import this page';
    case 'selected':
      return 'Import selected contacts';
  }
}

function scopeSummary(
  scope: RadioidBulkImportScope,
  listings: RadioidDmrUserListing[],
  totalCount: number,
  totalPages: number,
): string {
  switch (scope) {
    case 'all':
      return `${totalCount} contacts across ${totalPages} page${totalPages === 1 ? '' : 's'}`;
    case 'page':
      return `${listings.length} contact${listings.length === 1 ? '' : 's'} on this page`;
    case 'selected':
      return `${listings.length} selected contact${listings.length === 1 ? '' : 's'}`;
  }
}

function RadioidContactBulkImportDialogBody({
  scope,
  listings,
  filters,
  totalPages,
  totalCount,
  projectId,
  contacts,
  onClose,
  onComplete,
}: Omit<RadioidContactBulkImportDialogProps, 'opened'>) {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [progress, setProgress] = useState<RadioidBulkImportProgress | null>(null);
  const [result, setResult] = useState<RadioidBulkImportResult | null>(null);
  const cancelledRef = useRef(false);

  const { newCount, existingCount } = useMemo(
    () => countRadioidBulkImportTargets(listings, contacts),
    [listings, contacts],
  );

  async function handleStart() {
    if (!projectId) return;
    cancelledRef.current = false;
    setPhase('running');
    setProgress(null);
    setResult(null);

    const importResult = await runRadioidBulkImport({
      scope,
      updateExisting,
      projectId,
      contacts,
      listings: scope === 'all' ? undefined : listings,
      filters: scope === 'all' ? filters : undefined,
      totalPages: scope === 'all' ? totalPages : undefined,
      totalCount: scope === 'all' ? totalCount : listings.length,
      persistence,
      onProgress: setProgress,
      isCancelled: () => cancelledRef.current,
    });

    setResult(importResult);
    setPhase('done');
    if (!importResult.error && (importResult.added > 0 || importResult.updated > 0)) {
      onComplete();
    }
  }

  function handleCancelRunning() {
    cancelledRef.current = true;
  }

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  if (phase === 'confirm') {
    const nothingToDo =
      scope === 'all'
        ? totalCount === 0
        : newCount === 0 && (!updateExisting || existingCount === 0);
    return (
      <div className={classes.body}>
        <Text size="sm">
          Import <strong>{scopeSummary(scope, listings, totalCount, totalPages)}</strong> into your
          library.
        </Text>
        {scope === 'all' ? (
          <Text size="sm" c="dimmed">
            Studio will fetch each results page from RadioID.net before saving contacts. Large
            searches may take several minutes — respect RadioID.net rate limits.
          </Text>
        ) : null}
        <Stack gap="xs">
          <Text size="sm">
            <strong>{newCount}</strong> new contact{newCount === 1 ? '' : 's'} to add
          </Text>
          {existingCount > 0 ? (
            <Text size="sm">
              <strong>{existingCount}</strong> already in your library
              {scope === 'all' ? ' on this page' : ''}
            </Text>
          ) : null}
        </Stack>
        {existingCount > 0 || (scope === 'all' && totalCount > 0) ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <Checkbox
              checked={updateExisting}
              onCheckedChange={setUpdateExisting}
              aria-label="Update existing library contacts when RadioID.net data differs"
            />
            Update existing library contacts when RadioID.net data differs
          </label>
        ) : null}
        {!projectId ? (
          <StatusBanner tone="warning">
            Select an active project before importing contacts.
          </StatusBanner>
        ) : null}
        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!projectId || nothingToDo} onClick={() => void handleStart()}>
            Start import
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className={classes.body}>
        <Text size="sm">{progress?.message ?? 'Starting…'}</Text>
        <Progress value={percent} animated />
        <Text size="sm" c="dimmed">
          {progress
            ? `${progress.processed} / ${progress.total} · added ${progress.added} · updated ${progress.updated} · skipped ${progress.skipped}`
            : 'Preparing…'}
          {' · ETA '}
          {formatRadioidBulkImportEta(progress?.etaMs ?? null)}
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
          Import cancelled — partial results were saved before cancellation.
        </StatusBanner>
      ) : null}
      <Text size="sm">
        Added <strong>{summary?.added ?? 0}</strong>, updated{' '}
        <strong>{summary?.updated ?? 0}</strong>, skipped <strong>{summary?.skipped ?? 0}</strong>
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

export default function RadioidContactBulkImportDialog({
  opened,
  onClose,
  ...rest
}: RadioidContactBulkImportDialogProps) {
  const bodyKey = `${rest.sessionKey}:${rest.scope}`;

  return (
    <ModalShell
      open={opened}
      onClose={onClose}
      title={scopeTitle(rest.scope)}
      dismissible={false}
      size="md"
    >
      {opened ? (
        <RadioidContactBulkImportDialogBody key={bodyKey} {...rest} onClose={onClose} />
      ) : null}
    </ModalShell>
  );
}
