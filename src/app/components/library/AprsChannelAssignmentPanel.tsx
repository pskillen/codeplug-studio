import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AprsChannelSlot, AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { normalizeChannel } from '@core/domain/normalizeChannel.ts';
import { Alert, Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core';
import { DataTable } from '../ui/index.ts';
import type { DataTableColumn } from '../ui/DataTable.tsx';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
import {
  APRS_SLOT_NONE_VALUE,
  aprsSlotSelectOptions,
  channelAprsBindingFromChannel,
  channelAssignmentsDirty,
  channelHasDmrProfile,
  formatAprsAssignmentSummary,
  normalizeChannelAprsBindingForSave,
  aprsBindingDraftKey,
} from '../../lib/aprsBindingHelpers.ts';
import AprsChannelBulkAssignModal, {
  applyAprsChannelBulkPatch,
  type AprsChannelBulkPatch,
} from './AprsChannelBulkAssignModal.tsx';
import { persistence } from '../../state/persistence.ts';

const REPORT_TYPE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'digital', label: 'Digital' },
] satisfies { value: AprsReportType; label: string }[];

const PTT_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] satisfies { value: AprsPttMode; label: string }[];

type BindingDraftMap = Record<string, ChannelAprsBinding | undefined>;

function initialDraftMap(channels: Channel[]): BindingDraftMap {
  const map: BindingDraftMap = {};
  for (const channel of channels) {
    if (channel.aprs) {
      map[channel.id] = { ...channel.aprs };
    }
  }
  return map;
}

export interface AprsChannelAssignmentPanelProps {
  projectId: string;
  channels: Channel[];
  aprsConfiguration: AprsConfiguration | null;
  channelSlots: AprsChannelSlot[];
  onSaved?: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  permitNavigationOnce?: () => void;
}

function channelsRevisionKey(channels: Channel[]): string {
  return channels
    .map((c) => `${c.id}:${c.revision}:${c.aprs ? aprsBindingDraftKey(c.aprs) : ''}`)
    .join('|');
}

export default function AprsChannelAssignmentPanel(props: AprsChannelAssignmentPanelProps) {
  return <AprsChannelAssignmentPanelInner key={channelsRevisionKey(props.channels)} {...props} />;
}

function AprsChannelAssignmentPanelInner({
  channels,
  aprsConfiguration,
  channelSlots,
  onSaved,
  onDirtyChange,
  permitNavigationOnce,
}: AprsChannelAssignmentPanelProps) {
  const dmrChannels = useMemo(() => channels.filter(channelHasDmrProfile), [channels]);
  const [draftById, setDraftById] = useState<BindingDraftMap>(() => initialDraftMap(channels));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  const [receiveFilter, setReceiveFilter] = useState<string>('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isDirty = useMemo(
    () => channelAssignmentsDirty(channels, draftById, aprsConfiguration),
    [channels, draftById, aprsConfiguration],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const slotOptions = useMemo(
    () => aprsSlotSelectOptions(channelSlots, channels),
    [channelSlots, channels],
  );

  const slotFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All slots' },
      { value: 'none', label: 'None' },
      ...channelSlots.map((_, index) => ({
        value: String(index + 1),
        label: `Slot ${index + 1}`,
      })),
    ],
    [channelSlots],
  );

  const updateBinding = useCallback(
    (channelId: string, binding: ChannelAprsBinding | undefined) => {
      setDraftById((prev) => {
        const next = { ...prev };
        if (binding === undefined) {
          delete next[channelId];
        } else {
          next[channelId] = binding;
        }
        return next;
      });
    },
    [],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dmrChannels.filter((channel) => {
      const binding = draftById[channel.id] ?? channelAprsBindingFromChannel(channel);
      if (needle) {
        const haystack = `${channel.name} ${channel.callsign}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (reportTypeFilter !== 'all' && binding.reportType !== reportTypeFilter) return false;
      if (receiveFilter === 'enabled' && !binding.receiveEnabled) return false;
      if (receiveFilter === 'disabled' && binding.receiveEnabled) return false;
      if (slotFilter === 'none' && binding.reportSlotIndex != null) return false;
      if (slotFilter !== 'all' && slotFilter !== 'none') {
        if (String(binding.reportSlotIndex ?? '') !== slotFilter) return false;
      }
      return true;
    });
  }, [dmrChannels, draftById, search, reportTypeFilter, receiveFilter, slotFilter]);

  const columns = useMemo((): DataTableColumn<Channel>[] => {
    return [
      {
        key: 'reportType',
        header: 'Report type',
        render: (row) => {
          const binding = draftById[row.id] ?? channelAprsBindingFromChannel(row);
          return (
            <Select
              size="xs"
              data={REPORT_TYPE_OPTIONS}
              value={binding.reportType}
              onChange={(value) =>
                updateBinding(row.id, {
                  ...binding,
                  reportType: (value as AprsReportType | null) ?? 'off',
                })
              }
            />
          );
        },
      },
      {
        key: 'reportSlot',
        header: 'Report slot',
        render: (row) => {
          const binding = draftById[row.id] ?? channelAprsBindingFromChannel(row);
          return (
            <Select
              size="xs"
              data={slotOptions}
              disabled={channelSlots.length === 0}
              value={
                binding.reportSlotIndex != null
                  ? String(binding.reportSlotIndex)
                  : APRS_SLOT_NONE_VALUE
              }
              onChange={(value) =>
                updateBinding(row.id, {
                  ...binding,
                  reportSlotIndex:
                    value && value !== APRS_SLOT_NONE_VALUE ? Number.parseInt(value, 10) : null,
                })
              }
            />
          );
        },
      },
      {
        key: 'receive',
        header: 'Receive',
        render: (row) => {
          const binding = draftById[row.id] ?? channelAprsBindingFromChannel(row);
          return (
            <Checkbox
              checked={binding.receiveEnabled}
              onChange={(event) =>
                updateBinding(row.id, {
                  ...binding,
                  receiveEnabled: event.currentTarget.checked,
                })
              }
            />
          );
        },
      },
      {
        key: 'ptt',
        header: 'PTT mode',
        render: (row) => {
          const binding = draftById[row.id] ?? channelAprsBindingFromChannel(row);
          return (
            <Select
              size="xs"
              data={PTT_MODE_OPTIONS}
              value={binding.digitalPttMode}
              onChange={(value) =>
                updateBinding(row.id, {
                  ...binding,
                  digitalPttMode: (value as AprsPttMode | null) ?? 'off',
                })
              }
            />
          );
        },
      },
      {
        key: 'summary',
        header: 'Summary',
        sortValue: (row) =>
          formatAprsAssignmentSummary(
            draftById[row.id] ?? channelAprsBindingFromChannel(row),
            channelSlots,
            channels,
          ),
        render: (row) =>
          formatAprsAssignmentSummary(
            draftById[row.id] ?? channelAprsBindingFromChannel(row),
            channelSlots,
            channels,
          ),
      },
    ];
  }, [channels, channelSlots, draftById, slotOptions, updateBinding]);

  function handleBulkApply(patch: AprsChannelBulkPatch) {
    setDraftById((prev) => {
      const next = { ...prev };
      for (const channelId of selectedKeys) {
        const channel = channels.find((c) => c.id === channelId);
        if (!channel) continue;
        const current = next[channelId] ?? channelAprsBindingFromChannel(channel);
        const updated = applyAprsChannelBulkPatch(current, patch);
        if (updated === undefined) {
          delete next[channelId];
        } else {
          next[channelId] = updated;
        }
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let updated = 0;
      for (const channel of channels) {
        const draft = draftById[channel.id];
        const hadAprs = channel.aprs != null;
        const hasDraft = draft !== undefined;
        if (!hadAprs && !hasDraft) continue;

        const normalizedAprs = normalizeChannelAprsBindingForSave(draft, aprsConfiguration);
        const sameAsLoaded =
          JSON.stringify(normalizedAprs ?? null) === JSON.stringify(channel.aprs ?? null);
        if (sameAsLoaded) continue;

        const nextChannel = normalizeChannel({
          ...channel,
          ...(normalizedAprs === undefined ? {} : { aprs: normalizedAprs }),
        });
        if (normalizedAprs === undefined && channel.aprs) {
          const { aprs: _removed, ...withoutAprs } = nextChannel;
          void _removed;
          const result = await persistence.putChannel(withoutAprs, channel.revision);
          if (!result.ok) {
            throw new Error(
              result.reason === 'revision_conflict'
                ? 'Library changed elsewhere — reload and try again.'
                : `Failed to save channel ${channel.name}.`,
            );
          }
        } else {
          const result = await persistence.putChannel(nextChannel, channel.revision);
          if (!result.ok) {
            throw new Error(
              result.reason === 'revision_conflict'
                ? 'Library changed elsewhere — reload and try again.'
                : `Failed to save channel ${channel.name}.`,
            );
          }
        }
        updated++;
      }
      setMessage(updated > 0 ? `Saved ${updated} channel assignment(s).` : 'No changes to save.');
      permitNavigationOnce?.();
      await onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const nonDmrCount = channels.length - dmrChannels.length;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Assign digital APRS bindings across DMR channels.
        {nonDmrCount > 0 ? ` ${nonDmrCount} non-DMR channel(s) are hidden.` : null}
      </Text>
      <Group grow align="flex-end">
        <Select
          label="Report slot"
          data={slotFilterOptions}
          value={slotFilter}
          onChange={(value) => setSlotFilter(value ?? 'all')}
        />
        <Select
          label="Report type"
          data={[
            { value: 'all', label: 'All' },
            { value: 'off', label: 'Off' },
            { value: 'digital', label: 'Digital' },
          ]}
          value={reportTypeFilter}
          onChange={(value) => setReportTypeFilter(value ?? 'all')}
        />
        <Select
          label="Receive"
          data={[
            { value: 'all', label: 'All' },
            { value: 'enabled', label: 'Enabled' },
            { value: 'disabled', label: 'Disabled' },
          ]}
          value={receiveFilter}
          onChange={(value) => setReceiveFilter(value ?? 'all')}
        />
      </Group>
      <DataTable
        rows={filteredRows}
        rowKey={(row) => row.id}
        nameColumn={{
          header: 'Name',
          getName: (row) => row.name,
          getPath: (row) => `/library/channels/${row.id}`,
          sortable: true,
          sortValue: (row) => row.name,
        }}
        callsignColumn={{
          header: 'Callsign',
          getName: (row) => row.callsign || '—',
          getPath: (row) => `/library/channels/${row.id}`,
          sortable: true,
          sortValue: (row) => row.callsign,
        }}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by name or callsign"
        selectable
        selectedKeys={selectedKeys}
        onSelectedKeysChange={setSelectedKeys}
        emptyState="No DMR channels match the current filters."
        defaultSort={{ columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' }}
      />
      <Group>
        <Button
          variant="light"
          disabled={selectedKeys.length === 0}
          onClick={() => setSelectedKeys(filteredRows.map((row) => row.id))}
        >
          Select filtered
        </Button>
        <Button
          variant="light"
          disabled={selectedKeys.length === 0}
          onClick={() => setSelectedKeys([])}
        >
          Select none
        </Button>
        <Button
          variant="default"
          disabled={selectedKeys.length === 0}
          onClick={() => setBulkOpen(true)}
        >
          Bulk set…
        </Button>
        <Button loading={saving} onClick={() => void handleSave()}>
          Save assignments
        </Button>
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {message ? <Alert color="green">{message}</Alert> : null}
      <AprsChannelBulkAssignModal
        opened={bulkOpen}
        onClose={() => setBulkOpen(false)}
        selectedCount={selectedKeys.length}
        channelSlots={channelSlots}
        channels={channels}
        onApply={handleBulkApply}
      />
    </Stack>
  );
}
