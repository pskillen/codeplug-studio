import { useState } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { AprsSlotCallType, DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { NumberInput, Select, SimpleGrid, Stack } from '@mantine/core';
import { IconAntenna } from '@tabler/icons-react';
import { aprsSlotChannelSelectGroups } from '../../lib/aprsBindingHelpers.ts';
import { modalComboboxProps } from '../../theme.ts';
import { Button, ModalShell } from '../v2/index.ts';

export { channelLabelForSlot } from '../../lib/aprsBindingHelpers.ts';

const CURRENT_CHANNEL_VALUE = '';

const TIMESLOT_OPTIONS = [
  { value: '', label: 'Unspecified' },
  { value: '1', label: 'Slot 1' },
  { value: '2', label: 'Slot 2' },
] satisfies { value: string; label: string }[];

const CALL_TYPE_OPTIONS = [
  { value: 'group', label: 'Group' },
  { value: 'private', label: 'Private' },
] satisfies { value: AprsSlotCallType; label: string }[];

function emptySlot(): AprsChannelSlot {
  return {
    channelRef: null,
    timeslot: null,
    targetDmrId: null,
    callType: 'group',
  };
}

function parseOptionalPositiveInt(value: string | number): number | null {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface AprsChannelSlotModalProps {
  opened: boolean;
  title: string;
  channels: Channel[];
  initial: AprsChannelSlot | null;
  onClose: () => void;
  onSave: (slot: AprsChannelSlot) => void;
}

export default function AprsChannelSlotModal({
  opened,
  title,
  channels,
  initial,
  onClose,
  onSave,
}: AprsChannelSlotModalProps) {
  const formKey = opened
    ? `${initial?.channelRef?.id ?? 'current'}-${initial?.timeslot ?? 'x'}-${initial?.targetDmrId ?? 'x'}`
    : 'closed';

  return (
    <ModalShell
      open={opened}
      onClose={onClose}
      title={title}
      icon={<IconAntenna size={20} stroke={1.75} />}
      iconTone="accent"
      size="sm"
    >
      {opened ? (
        <AprsChannelSlotForm
          key={formKey}
          channels={channels}
          initial={initial}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </ModalShell>
  );
}

function AprsChannelSlotForm({
  channels,
  initial,
  onClose,
  onSave,
}: {
  channels: Channel[];
  initial: AprsChannelSlot | null;
  onClose: () => void;
  onSave: (slot: AprsChannelSlot) => void;
}) {
  const [draft, setDraft] = useState<AprsChannelSlot>(initial ?? emptySlot());

  const channelOptions = aprsSlotChannelSelectGroups(channels);

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="Channel"
          data={channelOptions}
          searchable
          comboboxProps={modalComboboxProps()}
          value={draft.channelRef?.id ?? CURRENT_CHANNEL_VALUE}
          onChange={(value) =>
            setDraft({
              ...draft,
              channelRef:
                value && value !== CURRENT_CHANNEL_VALUE ? { kind: 'channel', id: value } : null,
            })
          }
        />
        <Select
          label="Timeslot"
          data={TIMESLOT_OPTIONS}
          comboboxProps={modalComboboxProps()}
          value={draft.timeslot != null ? String(draft.timeslot) : ''}
          onChange={(value) =>
            setDraft({
              ...draft,
              timeslot: value === '1' || value === '2' ? (Number(value) as DMRTimeSlot) : null,
            })
          }
        />
        <NumberInput
          label="Target DMR ID"
          value={draft.targetDmrId ?? ''}
          onChange={(value) => setDraft({ ...draft, targetDmrId: parseOptionalPositiveInt(value) })}
          min={1}
          allowDecimal={false}
          allowNegative={false}
        />
        <Select
          label="Call type"
          data={CALL_TYPE_OPTIONS}
          comboboxProps={modalComboboxProps()}
          value={draft.callType}
          onChange={(value) =>
            setDraft({ ...draft, callType: (value as AprsSlotCallType | null) ?? 'group' })
          }
        />
      </SimpleGrid>
      <Stack gap="sm" align="flex-end">
        <div style={{ display: 'flex', gap: 'var(--mantine-spacing-sm)' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save slot
          </Button>
        </div>
      </Stack>
    </Stack>
  );
}

export { emptySlot as emptyAprsChannelSlot };
