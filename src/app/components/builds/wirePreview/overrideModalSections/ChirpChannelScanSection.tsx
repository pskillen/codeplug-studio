import { Stack, Text } from '@mantine/core';
import type { ScanInclusion } from '@core/models/library.ts';
import ScanInclusionSegment from '../../../channels/ScanInclusionSegment.tsx';

export interface ChirpChannelScanSectionProps {
  /** Effective value for this build: override ?? library. */
  value: ScanInclusion;
  saving: boolean;
  onScanChange: (scanInclusion: ScanInclusion) => void;
}

export default function ChirpChannelScanSection({
  value,
  saving,
  onScanChange,
}: ChirpChannelScanSectionProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Scan inclusion
      </Text>
      <Text size="xs" c="dimmed">
        Applies to this build only — does not change the library channel.
      </Text>
      <ScanInclusionSegment
        compact={false}
        disabled={saving}
        value={value}
        onChange={onScanChange}
      />
    </Stack>
  );
}
