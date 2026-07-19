import { Button, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import {
  formatOffsetMhz,
  frequencyOffsetMhz,
  offsetsMatch,
  txFrequencyHzFromOffset,
  txOffsetsForFrequencyHz,
} from '@core/domain/txOffsets.ts';
import { hzToMhzString } from '../../lib/units.ts';

export interface TxOffsetControlsProps {
  rxFrequencyHz: number | null;
  txFrequencyHz: number | null;
  onTxFrequencyChange: (txMhzString: string) => void;
}

/**
 * Live TX offset display and band-appropriate quick buttons for channel Frequencies edit.
 */
export default function TxOffsetControls({
  rxFrequencyHz,
  txFrequencyHz,
  onTxFrequencyChange,
}: TxOffsetControlsProps) {
  const offsetMhz = useMemo(
    () => frequencyOffsetMhz(rxFrequencyHz, txFrequencyHz),
    [rxFrequencyHz, txFrequencyHz],
  );
  const offsetLabel = formatOffsetMhz(offsetMhz);
  const options = useMemo(() => txOffsetsForFrequencyHz(rxFrequencyHz), [rxFrequencyHz]);
  const rxValid = rxFrequencyHz != null && Number.isFinite(rxFrequencyHz);

  if (!rxValid) return null;

  return (
    <Stack gap={6}>
      {offsetLabel != null ? (
        <Text size="sm">
          Offset:{' '}
          <Text component="span" fw={600}>
            {offsetLabel}
          </Text>
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Offset: set TX to compute, or pick a quick offset
        </Text>
      )}
      <Group gap="xs" wrap="wrap">
        {options.map((option) => {
          const active = offsetMhz != null && offsetsMatch(offsetMhz, option.offsetMhz);
          return (
            <Button
              key={`${option.label}:${option.offsetMhz}`}
              type="button"
              size="compact-sm"
              variant={active ? 'filled' : 'light'}
              onClick={() => {
                const txHz = txFrequencyHzFromOffset(rxFrequencyHz, option.offsetMhz);
                onTxFrequencyChange(hzToMhzString(txHz));
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </Group>
    </Stack>
  );
}
