import { Alert, Button, Stack, Text } from '@mantine/core';
import type { DebugWrongFirmwareError } from '@integrations/radio-io/debugHandoff.ts';
import {
  DEBUG_FIRMWARE_LABEL,
  type DebugFirmwareFamily,
} from '@integrations/radio-io/debugView/firmware.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import { DEBUG_FIRMWARE_COLOR } from './debugFirmware.ts';

function hexPreview(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export interface WrongFirmwareNoticeProps {
  error: DebugWrongFirmwareError;
  target?: Pick<RadioDebugDescriptor, 'firmware' | 'capture'>;
  stockSibling?: Pick<RadioDebugDescriptor, 'firmware'>;
  portOpen: boolean;
  secondsLeft?: number;
  portClosedMessage?: boolean;
  onSwitchAndRead(): void;
  onSwitchOnly(firmware: DebugFirmwareFamily): void;
  onClose(): void;
}

export function WrongFirmwareNotice({
  error,
  target,
  stockSibling,
  portOpen,
  secondsLeft,
  portClosedMessage,
  onSwitchAndRead,
  onSwitchOnly,
  onClose,
}: WrongFirmwareNoticeProps) {
  const accent = error.found === 'unknown' ? 'gray' : DEBUG_FIRMWARE_COLOR[error.found];
  const foundLabel =
    error.found === 'unknown' ? 'Unknown firmware' : DEBUG_FIRMWARE_LABEL[error.found];
  return (
    <Alert color={accent} title={foundLabel} data-testid="wrong-firmware-notice">
      <Stack gap="sm">
        <Text size="sm">{error.message}</Text>
        {error.received && error.received.length > 0 ? (
          <Text size="xs" c="dimmed">
            Received: {hexPreview(error.received)}
            {error.received.length > 16 ? ' …' : ''}
          </Text>
        ) : null}
        {error.found !== 'unknown' && !target?.capture ? (
          <Text size="sm">
            Studio has no {DEBUG_FIRMWARE_LABEL[error.found]} Debug page for this radio.
          </Text>
        ) : null}
        {error.found === 'unknown' && stockSibling ? (
          <Text size="sm">If it runs the stock firmware, use the Stock / MM9PDY page.</Text>
        ) : null}
        {error.port && target?.capture && portOpen ? (
          <Text size="sm" c="dimmed">
            Nothing was read. The port is still open.
            {secondsLeft != null && secondsLeft > 0
              ? ` Closing in ${secondsLeft} s unless you continue.`
              : ''}
          </Text>
        ) : null}
        {portClosedMessage ? (
          <Text size="sm" c="dimmed">
            The port was closed. Read radio again on this page.
          </Text>
        ) : null}
        <Stack gap="xs">
          {error.port && target?.capture && portOpen ? (
            <>
              <Button onClick={onSwitchAndRead}>
                Switch to {DEBUG_FIRMWARE_LABEL[target.firmware]} and read
              </Button>
              <Button variant="default" onClick={onClose}>
                Stop and close the port
              </Button>
            </>
          ) : null}
          {error.found === 'unknown' && stockSibling ? (
            <Button variant="default" onClick={() => onSwitchOnly('stock')}>
              Switch to Stock / MM9PDY
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Alert>
  );
}
