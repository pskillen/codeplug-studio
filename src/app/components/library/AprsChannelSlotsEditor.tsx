import { useMemo, useState } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { DataTable } from '../ui/index.ts';
import type { DataTableColumn } from '../ui/DataTable.tsx';
import AprsChannelSlotModal, {
  channelLabelForSlot,
  emptyAprsChannelSlot,
} from './AprsChannelSlotModal.tsx';

export interface AprsChannelSlotsEditorProps {
  channels: Channel[];
  slots: AprsChannelSlot[];
  onChange: (slots: AprsChannelSlot[]) => void;
}

type SlotRow = AprsChannelSlot & { slotNumber: number };

export default function AprsChannelSlotsEditor({
  channels,
  slots,
  onChange,
}: AprsChannelSlotsEditorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const rows = useMemo(
    (): SlotRow[] => slots.map((slot, index) => ({ ...slot, slotNumber: index + 1 })),
    [slots],
  );

  const columns = useMemo((): DataTableColumn<SlotRow>[] => {
    return [
      {
        key: 'channel',
        header: 'Channel',
        render: (row) => channelLabelForSlot(row, channels),
        sortValue: (row) => channelLabelForSlot(row, channels),
      },
      {
        key: 'timeslot',
        header: 'Timeslot',
        render: (row) => (row.timeslot != null ? String(row.timeslot) : '—'),
        sortValue: (row) => row.timeslot ?? 0,
      },
      {
        key: 'targetDmrId',
        header: 'Target DMR ID',
        render: (row) => (row.targetDmrId != null ? String(row.targetDmrId) : '—'),
        sortValue: (row) => row.targetDmrId ?? 0,
      },
      {
        key: 'callType',
        header: 'Call type',
        render: (row) => (row.callType === 'private' ? 'Private' : 'Group'),
        sortValue: (row) => row.callType,
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (row) => (
          <Group gap={4} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={`Edit slot ${row.slotNumber}`}
              onClick={() => {
                setEditIndex(row.slotNumber - 1);
                setModalOpen(true);
              }}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label={`Remove slot ${row.slotNumber}`}
              onClick={() => onChange(slots.filter((_, i) => i !== row.slotNumber - 1))}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ];
  }, [channels, onChange, slots]);

  function handleSaveSlot(slot: AprsChannelSlot) {
    if (editIndex == null) {
      onChange([...slots, slot]);
      return;
    }
    onChange(slots.map((existing, i) => (i === editIndex ? slot : existing)));
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Digital APRS transmit slots. Export may warn when a radio profile caps slot count; the
        library does not enforce a maximum here.
      </Text>
      <DataTable
        variant="list"
        rows={rows}
        rowKey={(row) => String(row.slotNumber)}
        nameColumn={{
          header: 'Slot',
          getName: (row) => String(row.slotNumber),
          getPath: () => '/library/aprs-configuration',
        }}
        columns={columns}
        showSearch={false}
        defaultSort={{ columnKey: 'channel', direction: 'asc' }}
        emptyState={
          <Text size="sm" c="dimmed">
            No slots configured.
          </Text>
        }
      />
      <Button
        variant="light"
        onClick={() => {
          setEditIndex(null);
          setModalOpen(true);
        }}
      >
        Add slot
      </Button>
      <AprsChannelSlotModal
        opened={modalOpen}
        title={editIndex == null ? 'Add slot' : `Edit slot ${editIndex + 1}`}
        channels={channels}
        initial={editIndex == null ? emptyAprsChannelSlot() : (slots[editIndex] ?? null)}
        onClose={() => {
          setModalOpen(false);
          setEditIndex(null);
        }}
        onSave={handleSaveSlot}
      />
    </Stack>
  );
}
