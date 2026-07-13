import { Stack, Text } from '@mantine/core';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import ScanInclusionSegment from '../../channels/ScanInclusionSegment.tsx';

export interface ChirpChannelScanSectionProps {
  channel: Channel;
  saving: boolean;
  onScanChange: (scanInclusion: ScanInclusion) => void;
}

export default function ChirpChannelScanSection({
  channel,
  saving,
  onScanChange,
}: ChirpChannelScanSectionProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Scan inclusion
      </Text>
      <ScanInclusionSegment
        compact={false}
        disabled={saving}
        value={channel.scanInclusion}
        onChange={onScanChange}
      />
    </Stack>
  );
}
