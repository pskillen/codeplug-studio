import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import type { Channel, Library } from '@core/models/library.ts';
import {
  diffRxGroupListMembers,
  fetchResolvedDeviceTalkGroups,
  RepeaterDirectoryError,
  rxGroupListDiffHasChanges,
  type BrandMeisterTalkGroupLookupProgress,
  type RepeaterListing,
  type ResolvedBrandMeisterTalkGroup,
} from '@integrations/repeaters/index.ts';
import { persistence } from '../../state/persistence.ts';
import {
  applyRxGroupListSync,
  canUpdateLinkedRxGroupList,
  defaultRxGroupListSyncName,
  linkedRxGroupList,
  type RxGroupListSyncMode,
} from '../../lib/brandmeisterRxGroupListSync.ts';
import BrandMeisterTalkGroupLookupProgressBar from './BrandMeisterTalkGroupLookupProgressBar.tsx';

export interface BrandmeisterRxGroupListSyncDialogProps {
  channel: Channel;
  library: Library;
  listing: RepeaterListing;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

interface BrandmeisterRxGroupListSyncDialogBodyProps {
  channel: Channel;
  library: Library;
  listing: RepeaterListing;
  onClose: () => void;
  onApplied?: () => void;
}

function changeLabel(change: string): string {
  switch (change) {
    case 'added':
      return 'Add';
    case 'removed':
      return 'Remove';
    case 'slot_changed':
      return 'Slot change';
    default:
      return '—';
  }
}

function formatSlot(slot: number | null | undefined): string {
  if (slot === 1 || slot === 2) return String(slot);
  return '—';
}

function BrandmeisterRxGroupListSyncDialogBody({
  channel,
  library,
  listing,
  onClose,
  onApplied,
}: BrandmeisterRxGroupListSyncDialogBodyProps) {
  const linked = linkedRxGroupList(channel, library);
  const { canUpdate, sharedCount } = canUpdateLinkedRxGroupList(channel, library);

  const [resolved, setResolved] = useState<ResolvedBrandMeisterTalkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupProgress, setLookupProgress] = useState<BrandMeisterTalkGroupLookupProgress | null>({
    phase: 'device',
    message: 'Fetching repeater talk groups…',
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [createMissing, setCreateMissing] = useState(true);
  const [mode, setMode] = useState<RxGroupListSyncMode>(linked && canUpdate ? 'update' : 'create');
  const [newListName, setNewListName] = useState(defaultRxGroupListSyncName(listing.callsign));

  useEffect(() => {
    let cancelled = false;
    void fetchResolvedDeviceTalkGroups(listing.remoteId, (progress) => {
      if (!cancelled) setLookupProgress(progress);
    })
      .then((rows) => {
        if (!cancelled) setResolved(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setResolved([]);
          setError(
            err instanceof RepeaterDirectoryError
              ? err.message
              : 'Could not load BrandMeister talk groups.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLookupProgress(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listing.remoteId]);

  const diffRows = useMemo(
    () => diffRxGroupListMembers(linked, resolved, library),
    [linked, resolved, library],
  );
  const hasChanges = rxGroupListDiffHasChanges(diffRows);

  async function handleApply() {
    setApplying(true);
    setApplyError(null);
    const result = await applyRxGroupListSync({
      channel,
      library,
      listing,
      resolvedTalkGroups: resolved,
      mode: canUpdate && mode === 'update' && linked ? 'update' : 'create',
      createMissingTalkGroups: createMissing,
      newListName,
      persistence,
    });
    setApplying(false);
    if (!result.ok) {
      setApplyError(result.message);
      return;
    }
    onApplied?.();
    onClose();
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        BrandMeister static talk groups for {listing.callsign}. Compare with this channel&apos;s
        linked RX group list and apply updates.
      </Text>

      {loading ? <BrandMeisterTalkGroupLookupProgressBar progress={lookupProgress} /> : null}
      {error ? <Alert color="red">{error}</Alert> : null}

      {!loading && !error && resolved.length > 0 ? (
        <>
          {!hasChanges && linked ? (
            <Alert color="yellow">RX group list already matches BrandMeister.</Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>TG ID</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Local slot</Table.Th>
                  <Table.Th>Remote slot</Table.Th>
                  <Table.Th>Change</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {diffRows.map((row) => (
                  <Table.Tr key={`${row.digitalId}-${row.change}-${row.name}`}>
                    <Table.Td>{row.digitalId}</Table.Td>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>{formatSlot(row.localSlot)}</Table.Td>
                    <Table.Td>{formatSlot(row.remoteSlot)}</Table.Td>
                    <Table.Td>{changeLabel(row.change)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {hasChanges ? (
            <>
              <Checkbox
                label="Create missing talk groups"
                checked={createMissing}
                onChange={(e) => setCreateMissing(e.currentTarget.checked)}
              />

              {linked ? (
                <Radio.Group
                  value={canUpdate ? mode : 'create'}
                  onChange={(value) => setMode(value as RxGroupListSyncMode)}
                >
                  <Stack gap="xs">
                    <Radio value="update" label={`Update "${linked.name}"`} disabled={!canUpdate} />
                    {sharedCount > 0 ? (
                      <Text size="xs" c="orange" ml="1.75rem">
                        {sharedCount} other channel{sharedCount === 1 ? '' : 's'} use this list —
                        create a new list instead.
                      </Text>
                    ) : null}
                    <Radio value="create" label="Create new RX group list" />
                  </Stack>
                </Radio.Group>
              ) : (
                <Text size="sm">
                  This channel has no linked RX group list — a new list will be created.
                </Text>
              )}

              {(!linked || mode === 'create' || !canUpdate) && (
                <TextInput
                  label="New list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.currentTarget.value)}
                />
              )}
            </>
          ) : null}
        </>
      ) : null}

      {applyError ? <Alert color="red">{applyError}</Alert> : null}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {hasChanges || !linked ? 'Cancel' : 'Close'}
        </Button>
        <Button
          disabled={
            loading || Boolean(error) || resolved.length === 0 || (!hasChanges && Boolean(linked))
          }
          loading={applying}
          onClick={() => void handleApply()}
        >
          Apply
        </Button>
      </Group>
    </Stack>
  );
}

export default function BrandmeisterRxGroupListSyncDialog({
  channel,
  library,
  listing,
  opened,
  onClose,
  onApplied,
}: BrandmeisterRxGroupListSyncDialogProps) {
  const bodyKey = `${channel.id}:${listing.remoteId}`;

  return (
    <Modal opened={opened} onClose={onClose} title="RX group list sync" size="lg">
      {opened ? (
        <BrandmeisterRxGroupListSyncDialogBody
          key={bodyKey}
          channel={channel}
          library={library}
          listing={listing}
          onClose={onClose}
          onApplied={onApplied}
        />
      ) : null}
    </Modal>
  );
}
