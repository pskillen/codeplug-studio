import { Badge, Group, Stack, Switch, Text } from '@mantine/core';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import { zoneScanMemberCounts } from '@core/import-export/zoneDerivedScanLists/members.ts';
import { ZONE_SCAN_SET_MIN_CHANNELS } from '@core/import-export/zoneScanSets/index.ts';
import {
  ZoneScanExpandPanel,
  type ZoneScanExpandPanelProps,
  type ZoneScanMemberVariant,
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
  /**
   * `scanList` (default): DM32 / Anytone zone-derived scan list, behind **Export as scan list**.
   * `scanSet`: the zone's own scan set (**Scan in this zone**), always on; no carrier, no cap.
   */
  variant?: ZoneScanMemberVariant;
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
  variant = 'scanList',
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

  if (variant === 'scanSet') {
    const tooFew = included < ZONE_SCAN_SET_MIN_CHANNELS;
    return (
      <Stack gap="md">
        <Group gap="sm" wrap="wrap" align="center">
          <Text size="sm" fw={600}>
            Scan in this zone
          </Text>
          <Badge size="sm" variant="light" color={tooFew ? 'orange' : 'gray'}>
            {included} / {total} scan in this zone
          </Badge>
        </Group>
        {tooFew ? (
          <Text size="xs" c="orange">
            Fewer than {ZONE_SCAN_SET_MIN_CHANNELS} channels: this zone won&apos;t scan on the
            radio.
          </Text>
        ) : null}
        <ZoneScanExpandPanel
          zone={zone}
          zones={zones}
          entry={entry}
          zoneBehaviourContext={zoneBehaviourContext}
          channelById={channelById}
          showScanCarrierControls={false}
          saving={saving}
          onUpdateZoneEntry={onUpdateZoneEntry}
          onUpdateMemberScanInclusion={onUpdateMemberScanInclusion}
          expansionByChannelId={expansionByChannelId}
          variant="scanSet"
        />
      </Stack>
    );
  }

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
