import { useMemo } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { AprsSlotCallType, DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { ActionIcon, Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
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

export interface AprsChannelSlotsEditorProps {
  channels: Channel[];
  slots: AprsChannelSlot[];
  onChange: (slots: AprsChannelSlot[]) => void;
}

export default function AprsChannelSlotsEditor({
  channels,
  slots,
  onChange,
}: AprsChannelSlotsEditorProps) {
  const channelOptions = useMemo(
    () => [
      { value: CURRENT_CHANNEL_VALUE, label: 'Current channel' },
      ...sortByName(channels).map((channel) => ({
        value: channel.id,
        label: channelDisplayLabel(channel),
      })),
    ],
    [channels],
  );

  function updateSlot(index: number, patch: Partial<AprsChannelSlot>) {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number) {
    onChange(slots.filter((_, i) => i !== index));
  }

  function addSlot() {
    onChange([...slots, emptySlot()]);
  }

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Channel slots
      </Text>
      <Text size="sm" c="dimmed">
        Digital APRS transmit slots. Export may warn when a radio profile caps slot count; the
        library does not enforce a maximum here.
      </Text>
      {slots.length === 0 ? (
        <Text size="sm" c="dimmed">
          No slots configured.
        </Text>
      ) : (
        slots.map((slot, index) => (
          <Stack
            key={index}
            gap="xs"
            p="sm"
            style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}
          >
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>
                Slot {index + 1}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label={`Remove slot ${index + 1}`}
                onClick={() => removeSlot(index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <Select
              label="Channel"
              data={channelOptions}
              searchable
              value={slot.channelRef?.id ?? CURRENT_CHANNEL_VALUE}
              onChange={(value) =>
                updateSlot(index, {
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
              value={slot.timeslot != null ? String(slot.timeslot) : ''}
              onChange={(value) =>
                updateSlot(index, {
                  timeslot: value === '1' || value === '2' ? (Number(value) as DMRTimeSlot) : null,
                })
              }
            />
            <NumberInput
              label="Target DMR ID"
              value={slot.targetDmrId ?? ''}
              onChange={(value) =>
                updateSlot(index, { targetDmrId: parseOptionalPositiveInt(value) })
              }
              min={1}
              allowDecimal={false}
              allowNegative={false}
            />
            <Select
              label="Call type"
              data={CALL_TYPE_OPTIONS}
              value={slot.callType}
              onChange={(value) =>
                updateSlot(index, { callType: (value as AprsSlotCallType | null) ?? 'group' })
              }
            />
          </Stack>
        ))
      )}
      <Button variant="light" onClick={addSlot}>
        Add slot
      </Button>
    </Stack>
  );
}
