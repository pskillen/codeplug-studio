import { Anchor, Stack, Text } from '@mantine/core';
import {
  DEBUG_FIRMWARE_LABEL,
  type DebugFirmwareFamily,
} from '@integrations/radio-io/debugView/firmware.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import { firmwaresOf } from './descriptors.ts';
import { DEBUG_FIRMWARE_COLOR } from './debugFirmware.ts';
import { getDebugReadHistory, useDebugReadHistory } from './debugReadHistory.ts';

export function SiblingReads({
  descriptor,
  onSwitch,
}: {
  descriptor: Pick<RadioDebugDescriptor, 'radio' | 'firmware'>;
  onSwitch: (firmware: DebugFirmwareFamily) => void;
}) {
  const siblings = firmwaresOf(descriptor.radio).filter(
    (s) => s.firmware !== descriptor.firmware && s.readHistory,
  );
  if (!siblings.length) return null;
  return (
    <Stack gap="xs">
      {siblings.map((sibling) => (
        <SiblingReadLine key={sibling.slug} sibling={sibling} onSwitch={onSwitch} />
      ))}
    </Stack>
  );
}

function SiblingReadLine({
  sibling,
  onSwitch,
}: {
  sibling: RadioDebugDescriptor;
  onSwitch: (firmware: DebugFirmwareFamily) => void;
}) {
  const store = getDebugReadHistory(sibling);
  const { entries, undownloaded } = useDebugReadHistory(store);
  if (!entries.length) return null;
  const label = DEBUG_FIRMWARE_LABEL[sibling.firmware];
  const count = entries.length;
  return (
    <Text c={DEBUG_FIRMWARE_COLOR[sibling.firmware]} size="sm">
      {count} {label} read{count === 1 ? '' : 's'} in this tab
      {undownloaded > 0 ? ` (${undownloaded} not downloaded)` : ''}
      {' · '}
      <Anchor component="button" type="button" onClick={() => onSwitch(sibling.firmware)}>
        Switch
      </Anchor>
    </Text>
  );
}
