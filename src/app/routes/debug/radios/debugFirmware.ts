import type { MantineColor } from '@mantine/core';
import type { DebugFirmwareFamily } from '@integrations/radio-io/debugView/firmware.ts';

/** One colour per firmware family on every Debug surface (owner decision). */
export const DEBUG_FIRMWARE_COLOR: Record<DebugFirmwareFamily, MantineColor> = {
  radiofoundry: 'teal',
  opengd77: 'orange',
  stock: 'blue',
};
