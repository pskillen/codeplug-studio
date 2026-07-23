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
  zoneBehaviourContext?: ZoneScanExpandPanelProps['zoneBehaviourContext'];
  showScanCarrierControls: boolean;
  scanListMemberCap: number;
  saving: boolean;
  onUpdateZoneEntry: (patch: Partial<ZoneGroupingZoneEntry>) => void;
  onUpdateMemberScanInclusion: ZoneScanExpandPanelProps['onUpdateMemberScanInclusion'];
  expansionByChannelId?: ZoneScanExpandPanelProps['expansionByChannelId'];
}

export default function ZoneScanOverrideSection({
  zone,
  zones,
  entry,
  channelById,
  zoneBehaviourContext,
  showScanCarrierControls,
  scanListMemberCap,
  saving,
  onUpdateZoneEntry,
  onUpdateMemberScanInclusion,
  expansionByChannelId,
}: ZoneScanOverrideSectionProps) {
  const { included, total } = zoneScanMemberCounts(
    zone,
    zones,
    {
      context: zoneBehaviourContext,
      layoutEntry: entry,
    },
    expansionByChannelId,
  );
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
      {entry?.exportScanList ? (
        <ZoneScanExpandPanel
          zone={zone}
          zones={zones}
          entry={entry}
          zoneBehaviourContext={zoneBehaviourContext}
          channelById={channelById}
          showScanCarrierControls={showScanCarrierControls}
          saving={saving}
          onUpdateZoneEntry={onUpdateZoneEntry}
          onUpdateMemberScanInclusion={onUpdateMemberScanInclusion}
          expansionByChannelId={expansionByChannelId}
        />
      ) : null}
    </Stack>
  );
}
