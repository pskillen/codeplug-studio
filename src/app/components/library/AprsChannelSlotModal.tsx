import { useEffect, useState } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { AprsSlotCallType, DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack } from '@mantine/core';
import { sortByName } from '../../lib/channels.ts';

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

export function channelLabelForSlot(
  slot: AprsChannelSlot,
  channels: Channel[],
): string {
  if (!slot.channelRef) return 'Current channel';
  const channel = channels.find((c) => c.id === slot.channelRef?.id);
  return channel ? channelDisplayLabel(channel) : 'Missing channel';
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
  const [draft, setDraft] = useState<AprsChannelSlot>(initial ?? emptySlot());

  useEffect(() => {
    if (opened) {
      setDraft(initial ?? emptySlot());
    }
  }, [opened, initial]);

  const channelOptions = [
    { value: CURRENT_CHANNEL_VALUE, label: 'Current channel' },
    ...sortByName(channels).map((channel) => ({
      value: channel.id,
      label: channelDisplayLabel(channel),
    })),
  ];

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Channel"
            data={channelOptions}
            searchable
            value={draft.channelRef?.id ?? CURRENT_CHANNEL_VALUE}
            onChange={(value) =>
              setDraft({
                ...draft,
                channelRef:
                  value && value !== CURRENT_CHANNEL_VALUE
                    ? { kind: 'channel', id: value }
                    : null,
              })
            }
          />
          <Select
            label="Timeslot"
            data={TIMESLOT_OPTIONS}
            value={draft.timeslot != null ? String(draft.timeslot) : ''}
            onChange={(value) =>
              setDraft({
                ...draft,
                timeslot: value === '1' || value === '2' ? (Number(value) as DMRTimeSlot) : null,
              })
            }
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Target DMR ID"
            value={draft.targetDmrId ?? ''}
            onChange={(value) =>
              setDraft({ ...draft, targetDmrId: parseOptionalPositiveInt(value) })
            }
            min={1}
            allowDecimal={false}
            allowNegative={false}
          />
          <Select
            label="Call type"
            data={CALL_TYPE_OPTIONS}
            value={draft.callType}
            onChange={(value) =>
              setDraft({ ...draft, callType: (value as AprsSlotCallType | null) ?? 'group' })
            }
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save slot</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export { emptySlot as emptyAprsChannelSlot };
