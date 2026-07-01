import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Stack, Table, Text } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import {
  buildPatchFromDiff,
  diffChannelFromListing,
  diffHasChanges,
  type ChannelDiffField,
  type ChannelDiffRow,
  type MapListingOptions,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import { persistence } from '../../state/persistence.ts';

export interface RepeaterListingUpdateDialogProps {
  channel: Channel;
  listing: RepeaterListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
  mapOptions?: MapListingOptions;
}

interface RepeaterListingUpdateDialogBodyProps {
  channel: Channel;
  listing: RepeaterListing;
  onClose: () => void;
  onApplied?: () => void;
  mapOptions?: MapListingOptions;
}

function RepeaterListingUpdateDialogBody({
  channel,
  listing,
  onClose,
  onApplied,
  mapOptions,
}: RepeaterListingUpdateDialogBodyProps) {
  const diffRows: ChannelDiffRow[] = useMemo(
    () => diffChannelFromListing(channel, listing, mapOptions),
    [channel, listing, mapOptions],
  );
  const changedRows = useMemo(() => diffRows.filter((r) => r.changed), [diffRows]);
  const [selectedFields, setSelectedFields] = useState<Set<ChannelDiffField>>(
    () => new Set(diffRows.filter((r) => r.selectByDefault).map((r) => r.field)),
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  function toggleField(field: ChannelDiffField, checked: boolean) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  async function handleApply() {
    if (selectedFields.size === 0) return;
    setApplying(true);
    setApplyError(null);
    const patched = buildPatchFromDiff(channel, listing, [...selectedFields], mapOptions);
    const result = await persistence.putChannel(patched, channel.revision);
    setApplying(false);
    if (!result.ok) {
      setApplyError(
        result.reason === 'revision_conflict'
          ? 'This channel was updated elsewhere. Reload and try again.'
          : 'Could not save changes.',
      );
      return;
    }
    onApplied?.();
    onClose();
  }

  return (
    <Stack gap="md">
      {changedRows.length === 0 ? (
        <Text c="dimmed">This channel already matches the selected listing.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Apply</Table.Th>
              <Table.Th>Field</Table.Th>
              <Table.Th>Your channel</Table.Th>
              <Table.Th>Directory</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {diffRows.map((row) => (
              <Table.Tr key={row.field} opacity={row.changed ? 1 : 0.55}>
                <Table.Td>
                  <Checkbox
                    checked={selectedFields.has(row.field)}
                    disabled={!row.changed}
                    onChange={(e) => toggleField(row.field, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.local}</Table.Td>
                <Table.Td>{row.remote}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {applyError ? <Alert color="red">{applyError}</Alert> : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!diffHasChanges(diffRows) || selectedFields.size === 0}
          loading={applying}
          onClick={() => void handleApply()}
        >
          Apply selected
        </Button>
      </Group>
    </Stack>
  );
}

export default function RepeaterListingUpdateDialog({
  channel,
  listing,
  opened,
  onClose,
  onApplied,
  mapOptions,
}: RepeaterListingUpdateDialogProps) {
  const bodyKey = listing ? `${channel.id}:${listing.source}:${listing.remoteId}` : 'none';

  return (
    <Modal opened={opened} onClose={onClose} title="Directory comparison" size="lg">
      {opened && listing ? (
        <RepeaterListingUpdateDialogBody
          key={bodyKey}
          channel={channel}
          listing={listing}
          onClose={onClose}
          onApplied={onApplied}
          mapOptions={mapOptions}
        />
      ) : null}
    </Modal>
  );
}
