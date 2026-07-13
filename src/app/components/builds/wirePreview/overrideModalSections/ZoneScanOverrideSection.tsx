import { Badge, Group, Stack, Switch, Text } from '@mantine/core';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import { zoneScanMemberCounts } from '@core/import-export/zoneDerivedScanLists/members.ts';
import {
  ZoneScanExpandPanel,
  type ZoneScanExpandPanelProps,
} from '../../ZoneScanExportControls.tsx';

export interface ZoneScanOverrideSectionProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  channelById: ZoneScanExpandPanelProps['channelById'];
  isDm32: boolean;
  showScanCarrierControls: boolean;
  scanListMemberCap: number;
  saving: boolean;
  onUpdateZoneEntry: (patch: Partial<ZoneGroupingZoneEntry>) => void;
  onUpdateMemberScanInclusion: ZoneScanExpandPanelProps['onUpdateMemberScanInclusion'];
}

export default function ZoneScanOverrideSection({
  zone,
  zones,
  entry,
  channelById,
  isDm32,
  showScanCarrierControls,
  scanListMemberCap,
  saving,
  onUpdateZoneEntry,
  onUpdateMemberScanInclusion,
}: ZoneScanOverrideSectionProps) {
  const { included, total } = zoneScanMemberCounts(zone, zones);
  const capExceeded = included > scanListMemberCap;

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>
        Zone scan export
      </Text>
      <Group gap="sm" wrap="wrap" align="center">
        <Switch
          size="sm"
          label="Export as scan list"
          checked={entry?.exportScanList ?? false}
          disabled={saving}
          onChange={(event) => onUpdateZoneEntry({ exportScanList: event.currentTarget.checked })}
        />
        <Badge size="sm" variant="light" color={capExceeded ? 'orange' : 'gray'}>
          {included} / {total} scan members (cap {scanListMemberCap})
        </Badge>
      </Group>
      {entry?.exportScanList || isDm32 ? (
        <ZoneScanExpandPanel
          zone={zone}
          zones={zones}
          entry={entry}
          channelById={channelById}
          isDm32={isDm32}
          showScanCarrierControls={showScanCarrierControls}
          saving={saving}
          onUpdateZoneEntry={onUpdateZoneEntry}
          onUpdateMemberScanInclusion={onUpdateMemberScanInclusion}
        />
      ) : null}
    </Stack>
  );
}
