import { ActionIcon, Badge, Group, NumberInput, Stack, Switch, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import {
  collectZoneScanMemberRefs,
  zoneScanMemberCounts,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';

const DEFAULT_CARRIER_MHZ = 145.5;

export interface ZoneScanRowHeaderProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  scanListMemberCap: number;
  showScanCarrierControls: boolean;
  expanded: boolean;
  saving: boolean;
  onToggleExpand: () => void;
  onExportScanListChange: (enabled: boolean) => void;
}

export function ZoneScanRowHeader({
  zone,
  zones,
  entry,
  scanListMemberCap,
  showScanCarrierControls,
  expanded,
  saving,
  onToggleExpand,
  onExportScanListChange,
}: ZoneScanRowHeaderProps) {
  const { included, total } = zoneScanMemberCounts(zone, zones);
  const capExceeded = included > scanListMemberCap;

  return (
    <Group gap="sm" wrap="wrap" align="center" mt={4}>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label={
          expanded ? `Collapse ${zone.name} scan settings` : `Expand ${zone.name} scan settings`
        }
        onClick={onToggleExpand}
      >
        {expanded ? (
          <IconChevronDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
        ) : (
          <IconChevronRight size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
        )}
      </ActionIcon>
      <Switch
        size="xs"
        label="Export as scan list"
        checked={entry?.exportScanList ?? false}
        disabled={saving}
        onChange={(event) => onExportScanListChange(event.currentTarget.checked)}
      />
      <Badge size="sm" variant="light" color={capExceeded ? 'orange' : 'gray'}>
        {included} / {total} scan members (cap {scanListMemberCap})
      </Badge>
      {showScanCarrierControls && entry?.exportScanList ? (
        <Text size="xs" c="dimmed">
          Carrier channel + scan list when export toggle is on
        </Text>
      ) : null}
    </Group>
  );
}

export interface ZoneScanExpandPanelProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  channelById: Map<string, import('@core/models/library.ts').Channel>;
  isDm32: boolean;
  showScanCarrierControls: boolean;
  saving: boolean;
  onUpdateZoneEntry: (patch: Partial<ZoneGroupingZoneEntry>) => void;
  onUpdateMemberScanInclusion: (
    ownerZoneId: string,
    channelId: string,
    includeInScanList: boolean,
  ) => void;
}

export function ZoneScanExpandPanel({
  zone,
  zones,
  entry,
  channelById,
  isDm32,
  showScanCarrierControls,
  saving,
  onUpdateZoneEntry,
  onUpdateMemberScanInclusion,
}: ZoneScanExpandPanelProps) {
  const carrierMhz =
    entry?.scanCarrierFrequencyHz != null
      ? entry.scanCarrierFrequencyHz / 1_000_000
      : DEFAULT_CARRIER_MHZ;
  const memberRefs = collectZoneScanMemberRefs(zone, zones);
  const zoneById = new Map(zones.map((row) => [row.id, row]));

  return (
    <Stack gap="sm" pl="md" py="xs">
      {isDm32 ? (
        <Switch
          label="Export scratch channel"
          description="Deferred on wire — layout flag only until scratch serialise ships."
          checked={entry?.exportScratchChannel ?? false}
          disabled={saving}
          onChange={(event) =>
            onUpdateZoneEntry({ exportScratchChannel: event.currentTarget.checked })
          }
        />
      ) : null}
      {showScanCarrierControls && entry?.exportScanList ? (
        <NumberInput
          label="Scan carrier (MHz)"
          value={carrierMhz}
          decimalScale={3}
          min={0}
          disabled={saving}
          onChange={(value) =>
            onUpdateZoneEntry({
              scanCarrierFrequencyHz:
                typeof value === 'number' ? Math.round(value * 1_000_000) : null,
            })
          }
        />
      ) : null}
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Include in scan list
        </Text>
        {memberRefs.map((member) => {
          const channel = channelById.get(member.channelId);
          const ownerZone = zoneById.get(member.ownerZoneId);
          const label = channel ? channelDisplayLabel(channel) : member.channelId;
          const nested = member.ownerZoneId !== zone.id;
          const displayLabel =
            nested && ownerZone ? `${label} (${ownerZone.name})` : label;
          return (
            <Group key={`${member.ownerZoneId}:${member.channelId}`} justify="space-between" wrap="nowrap">
              <Text size="sm">{displayLabel}</Text>
              <Switch
                aria-label={`Include ${displayLabel} in scan list`}
                checked={member.includeInScanList}
                disabled={saving}
                onChange={(event) =>
                  onUpdateMemberScanInclusion(
                    member.ownerZoneId,
                    member.channelId,
                    event.currentTarget.checked,
                  )
                }
              />
            </Group>
          );
        })}
      </Stack>
    </Stack>
  );
}
