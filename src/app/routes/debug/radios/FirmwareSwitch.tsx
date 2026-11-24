import { Box, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import {
  DEBUG_FIRMWARE_LABEL,
  type DebugFirmwareFamily,
} from '@integrations/radio-io/debugView/firmware.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import { DEBUG_FIRMWARE_COLOR } from './debugFirmware.ts';

export interface FirmwareSwitchProps {
  options: readonly Pick<RadioDebugDescriptor, 'firmware' | 'capture'>[];
  value: DebugFirmwareFamily;
  onChange(firmware: DebugFirmwareFamily): void;
  disabled?: boolean;
}

export function FirmwareSwitch({ options, value, onChange, disabled }: FirmwareSwitchProps) {
  const single = options.length === 1;
  return (
    <Stack gap="xs">
      <SegmentedControl
        fullWidth
        aria-label="Firmware"
        color={DEBUG_FIRMWARE_COLOR[value]}
        value={value}
        readOnly={single}
        disabled={disabled || single}
        onChange={(next) => onChange(next as DebugFirmwareFamily)}
        data={options.map((option) => ({
          value: option.firmware,
          label: (
            <Group gap={6} wrap="nowrap" justify="center">
              <Box
                w={8}
                h={8}
                style={{
                  borderRadius: '50%',
                  backgroundColor: option.capture
                    ? `var(--mantine-color-${DEBUG_FIRMWARE_COLOR[option.firmware]}-filled)`
                    : 'transparent',
                  border: `2px solid var(--mantine-color-${DEBUG_FIRMWARE_COLOR[option.firmware]}-filled)`,
                  flexShrink: 0,
                }}
              />
              {DEBUG_FIRMWARE_LABEL[option.firmware]}
            </Group>
          ),
        }))}
      />
      <Text size="sm" c="dimmed">
        Firmware you expect. The Read checks it first.
      </Text>
    </Stack>
  );
}
