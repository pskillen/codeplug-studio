import { useMemo, useState } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { IconAntenna, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  Button,
  DataTable,
  EmptyState,
  Panel,
  RowActionIcon,
  type DataTableColumn,
  type DataTableSortState,
} from '../v2/index.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
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
  const [sort, setSort] = useState<DataTableSortState>({
    key: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });

  const rows = useMemo(
    (): SlotRow[] => slots.map((slot, index) => ({ ...slot, slotNumber: index + 1 })),
    [slots],
  );

  const columns = useMemo((): DataTableColumn<SlotRow>[] => {
    return [
      {
        key: 'slotNumber',
        header: 'Slot',
        width: '64px',
        sortable: true,
        sortValue: (row) => row.slotNumber,
        render: (row) => row.slotNumber,
      },
      {
        key: 'channel',
        header: 'Channel',
        sortable: true,
        sortValue: (row) => channelLabelForSlot(row, channels),
        render: (row) => channelLabelForSlot(row, channels),
      },
      {
        key: 'timeslot',
        header: 'Timeslot',
        sortable: true,
        sortValue: (row) => row.timeslot ?? 0,
        render: (row) => (row.timeslot != null ? String(row.timeslot) : '—'),
      },
      {
        key: 'targetDmrId',
        header: 'Target DMR ID',
        sortable: true,
        sortValue: (row) => row.targetDmrId ?? 0,
        render: (row) => (row.targetDmrId != null ? String(row.targetDmrId) : '—'),
      },
      {
        key: 'callType',
        header: 'Call type',
        sortable: true,
        sortValue: (row) => row.callType,
        render: (row) => (row.callType === 'private' ? 'Private' : 'Group'),
      },
      {
        key: 'actions',
        header: '',
        width: '72px',
        hideable: false,
        render: (row) => (
          <div style={{ display: 'flex', gap: 4 }}>
            <RowActionIcon
              icon={<IconPencil size={16} />}
              label={`Edit slot ${row.slotNumber}`}
              onClick={() => {
                setEditIndex(row.slotNumber - 1);
                setModalOpen(true);
              }}
            />
            <RowActionIcon
              icon={<IconTrash size={16} />}
              label={`Remove slot ${row.slotNumber}`}
              tone="destructive"
              onClick={() => onChange(slots.filter((_, i) => i !== row.slotNumber - 1))}
            />
          </div>
        ),
      },
    ];
  }, [channels, onChange, slots]);

  function openAdd() {
    setEditIndex(null);
    setModalOpen(true);
  }

  function handleSaveSlot(slot: AprsChannelSlot) {
    if (editIndex == null) {
      onChange([...slots, slot]);
      return;
    }
    onChange(slots.map((existing, i) => (i === editIndex ? slot : existing)));
  }

  return (
    <Panel
      title="APRS slots"
      sub="Digital APRS transmit slots. Channels may be DMR, AM air, or FM broadcast — export may warn when a radio profile caps slot count."
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<IconAntenna size={20} stroke={1.75} />}
          title="No APRS slots yet"
          description="Add a slot to assign channels for digital APRS reporting."
          action={
            <Button variant="primary" size="sm" onClick={openAdd}>
              Add slot
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            variant="embedded"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.slotNumber)}
            sort={sort}
            onSortChange={(next) => {
              if (next) setSort(next);
            }}
            emptyMessage="No slots configured."
          />
          <Button
            variant="dashed"
            size="sm"
            onClick={openAdd}
            style={{ marginTop: 'var(--dsv2-space-3, 12px)' }}
          >
            Add slot
          </Button>
        </>
      )}
      <AprsChannelSlotModal
        opened={modalOpen}
        title={editIndex == null ? 'Add APRS slot' : `Edit slot ${editIndex + 1}`}
        channels={channels}
        initial={editIndex == null ? emptyAprsChannelSlot() : (slots[editIndex] ?? null)}
        onClose={() => {
          setModalOpen(false);
          setEditIndex(null);
        }}
        onSave={handleSaveSlot}
      />
    </Panel>
  );
}
