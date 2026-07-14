import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import type { DigitalContact } from '@core/models/library.ts';
import type { RadioidDmrUserListing, RadioidContactNameMode } from '@integrations/radioid/index.ts';
import { radioidContactNameModeLabel } from '@integrations/radioid/index.ts';
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
  nameMode: RadioidContactNameMode;
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
  nameMode,
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
      nameMode,
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
      <Stack gap="md">
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
            Import name as <strong>{radioidContactNameModeLabel(nameMode)}</strong> (change on the
            search page).
          </Text>
          <Text size="sm">
            <strong>{newCount}</strong> new contact{newCount === 1 ? '' : 's'} to add
          </Text>
          {existingCount > 0 ? (
            <Text size="sm">
              <strong>{existingCount}</strong> already in your library
              {scope === 'all' ? ' on this page' : ''}
            </Text>
          ) : null}
          {scope === 'all' && existingCount > 0 ? (
            <Text size="xs" c="dimmed">
              Existing counts on other pages are determined during import.
            </Text>
          ) : null}
        </Stack>
        {existingCount > 0 || (scope === 'all' && totalCount > 0) ? (
          <Checkbox
            label="Update existing library contacts when RadioID.net data differs"
            checked={updateExisting}
            onChange={(e) => setUpdateExisting(e.currentTarget.checked)}
          />
        ) : null}
        {!projectId ? (
          <Alert color="red">Select an active project before importing contacts.</Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!projectId || nothingToDo} onClick={() => void handleStart()}>
            Start import
          </Button>
        </Group>
      </Stack>
    );
  }

  if (phase === 'running') {
    return (
      <Stack gap="md">
        <Text size="sm">{progress?.message ?? 'Starting…'}</Text>
        <Progress value={percent} animated />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {progress
              ? `${progress.processed} / ${progress.total} · added ${progress.added} · updated ${progress.updated} · skipped ${progress.skipped}`
              : 'Preparing…'}
          </Text>
          <Text size="sm" c="dimmed">
            ETA {formatRadioidBulkImportEta(progress?.etaMs ?? null)}
          </Text>
        </Group>
        <Group justify="flex-end">
          <Button variant="default" color="red" onClick={handleCancelRunning}>
            Cancel
          </Button>
        </Group>
      </Stack>
    );
  }

  const summary = result;
  return (
    <Stack gap="md">
      {summary?.error ? (
        <Alert color="red" title="Import stopped">
          {summary.error}
        </Alert>
      ) : null}
      {summary?.cancelled ? (
        <Alert color="yellow" title="Import cancelled">
          Partial results were saved before cancellation.
        </Alert>
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
      <Group justify="flex-end">
        <Button onClick={onClose}>Close</Button>
      </Group>
    </Stack>
  );
}

export default function RadioidContactBulkImportDialog({
  opened,
  onClose,
  ...rest
}: RadioidContactBulkImportDialogProps) {
  const bodyKey = `${rest.sessionKey}:${rest.scope}`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={scopeTitle(rest.scope)}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      {opened ? (
        <RadioidContactBulkImportDialogBody key={bodyKey} {...rest} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
