/**
 * Per-build Backup / Restore tab — zip on disk + in-RAM inspect.
 * Session data stays in React memory; never writes egress hydration or project state (#1138).
 */

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, FileButton, Group, Stack, Table, Text } from '@mantine/core';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import RadioCloneSummaryView from '../../components/builds/RadioCloneSummaryView.tsx';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import WebSerialExperimentalAlert from '../../components/builds/WebSerialExperimentalAlert.tsx';
import { findAttribution } from '../../lib/attributions.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import {
  closeRadioSession,
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
} from '../../services/radioIoSession.ts';
import {
  backupLiveRadioSession,
  downloadRadioBackupZip,
  openRadioBackupZip,
  type RadioBackupSession,
} from '../../services/radioBackupRestore.ts';
import { Button } from '../../components/v2/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

function coverageCopy(coverage: RadioBackupSession['manifest']['coverage']): string {
  switch (coverage) {
    case 'full-clone':
      return 'Full programming-image clone (not necessarily the entire flash chip).';
    case 'known-map-regions':
      return 'Known map regions only — not a full chip dump.';
    case 'partial':
      return 'Partial coverage — some memory was not captured.';
  }
}

export default function BuildRadioBackupPage() {
  const { build, egressPaths } = useBuildLayout();
  const radioEgress = findRadioIoEgress(egressPaths);

  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileResetRef = useRef<() => void>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<RadioBackupSession | null>(null);

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);

  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  if (!radioEgress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const descriptors = descriptorsForEgress(radioEgress);
  const descriptor = descriptors[0];
  const serialOk = isRadioSerialSupported();
  const warnFactoryReset = (descriptor?.modelIds ?? []).some((id) => /dm-?32/i.test(id));

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    setProgress(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  function beginBusy(): void {
    setError(null);
    setBusy(true);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    abortRef.current = new AbortController();
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  async function handleBackupRadio() {
    beginBusy();
    try {
      const { session } = await openRadioSessionForEgress(radioEgress!, {
        forcePortSelection: true,
        purpose: 'read',
      });
      sessionRef.current = session;
      setPhase('transfer');
      const result = await backupLiveRadioSession(session, {
        onProgress,
        signal: abortRef.current!.signal,
      });
      await releaseSession();
      setBackup(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    void releaseSession();
    setBusy(false);
    setProgress(null);
  }

  function handleProgressClose(): void {
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }

  function handleClearSession(): void {
    setBackup(null);
    setError(null);
  }

  async function handleOpenFile(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setBackup(openRadioBackupZip(bytes));
    } catch (err) {
      setBackup(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      fileResetRef.current?.();
    }
  }

  return (
    <FormPage
      title="Backup / Restore"
      description={
        <Text size="sm" component="span">
          Snapshot the connected radio to a zip on your disk, or open a backup file to inspect it.
          This is not Write — the zip stays on your computer and is not saved to the project. The
          file may contain contact banks and callsigns.
        </Text>
      }
    >
      <Stack gap="lg">
        <WebSerialExperimentalAlert />
        {descriptor ? (
          <Text size="sm" c="dimmed">
            Adapter: {descriptor.label}
            {attributionNames ? ` (${attributionNames})` : ''}
          </Text>
        ) : null}
        {warnFactoryReset ? (
          <Alert color="yellow" title="Factory reset">
            Restore for this radio depends on a live address map. After a factory reset, a backup
            taken beforehand cannot be restored.
          </Alert>
        ) : null}
        {error ? <Alert color="red">{error}</Alert> : null}

        {!backup ? (
          <FormSection title="Backup">
            <Group gap="sm">
              <Button
                size="sm"
                disabled={busy || !serialOk || descriptors.length === 0}
                onClick={() => void handleBackupRadio()}
              >
                Backup radio
              </Button>
              <FileButton
                resetRef={fileResetRef}
                onChange={(f) => void handleOpenFile(f)}
                accept=".zip"
              >
                {(props) => (
                  <Button size="sm" variant="secondary" disabled={busy} {...props}>
                    Open backup file
                  </Button>
                )}
              </FileButton>
            </Group>
            {!serialOk ? (
              <Text size="sm" mt="sm">
                {getRadioSerialUnsupportedMessage()} You can still open a backup file offline.
              </Text>
            ) : (
              <Text size="sm" mt="sm">
                Backup radio downloads a zip first, then shows what was captured. Open backup file
                works without a radio connected.
              </Text>
            )}
          </FormSection>
        ) : (
          <>
            <FormSection title="Restore">
              <Button size="sm" variant="destructive" disabled>
                Restore to radio
              </Button>
              <Text size="sm" mt="sm" c="dimmed">
                Restore not available for this radio yet. Backup and inspect are available.
              </Text>
            </FormSection>
            <FormSection title="Archive">
              <Text size="sm">
                {backup.manifest.descriptorLabel} · {backup.manifest.radioModelId}
                {backup.manifest.firmware ? ` · firmware ${backup.manifest.firmware}` : ''}
                {backup.manifest.serial ? ` · serial ${backup.manifest.serial}` : ''}
                {` · ${backup.manifest.imageByteLength} bytes`}
                {` · ${new Date(backup.manifest.capturedAt).toLocaleString()}`}
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                {coverageCopy(backup.manifest.coverage)}
              </Text>
              <Group gap="sm" mt="sm">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => downloadRadioBackupZip(backup.zipBytes, backup.manifest)}
                >
                  Save zip again
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !serialOk}
                  onClick={() => void handleBackupRadio()}
                >
                  Read again
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleClearSession}>
                  Clear
                </Button>
                <FileButton
                  resetRef={fileResetRef}
                  onChange={(f) => void handleOpenFile(f)}
                  accept=".zip"
                >
                  {(props) => (
                    <Button size="sm" variant="ghost" disabled={busy} {...props}>
                      Open backup file
                    </Button>
                  )}
                </FileButton>
              </Group>
            </FormSection>
            <FormSection title="Regions">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Region</Table.Th>
                    <Table.Th>Address</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Restore</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {backup.manifest.regions.map((region) => (
                    <Table.Tr key={region.id}>
                      <Table.Td>{region.label}</Table.Td>
                      <Table.Td>
                        <Text ff="monospace" size="sm">
                          0x{region.address.toString(16)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{region.byteLength}</Table.Td>
                      <Table.Td>
                        {region.restoreRole === 'restorable' ? 'Restorable' : 'Inspect only'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </FormSection>
            {backup.inspectBag ? <RadioCloneSummaryView bag={backup.inspectBag} /> : null}
          </>
        )}

        <RadioIoProgressModal
          opened={busy}
          operation="read"
          phase={phase}
          progress={progress}
          transferStages={transferStages}
          navigationBlocked={leaveAttempted}
          onCancel={handleCancel}
          onClose={handleProgressClose}
        />
      </Stack>
    </FormPage>
  );
}
