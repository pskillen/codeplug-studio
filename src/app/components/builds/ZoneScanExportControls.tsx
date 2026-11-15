import { ActionIcon, Badge, Group, NumberInput, Stack, Switch, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { ZoneBehaviourContext } from '@core/import-export/zoneBehaviourDefaults/index.ts';
import {
  collectZoneScanProjectionMemberRefs,
  zoneScanMemberCounts,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import type { ExpandedMxNChannelRow } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useState } from 'react';

const DEFAULT_CARRIER_MHZ = 145.5;

export interface ZoneScanRowHeaderProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  zoneBehaviourContext?: ZoneBehaviourContext;
  scanListMemberCap: number;
  showScanCarrierControls: boolean;
  expanded: boolean;
  saving: boolean;
  onToggleExpand: () => void;
  onExportScanListChange: (enabled: boolean) => void;
  expansionByChannelId?: Map<string, ExpandedMxNChannelRow[]>;
}

export function ZoneScanRowHeader({
  zone,
  zones,
  entry,
  zoneBehaviourContext,
  scanListMemberCap,
  showScanCarrierControls,
  expanded,
  saving,
  onToggleExpand,
  onExportScanListChange,
  expansionByChannelId,
}: ZoneScanRowHeaderProps) {
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
  zoneBehaviourContext?: ZoneBehaviourContext;
  channelById: Map<string, import('@core/models/library.ts').Channel>;
  showScanCarrierControls: boolean;
  saving: boolean;
  onUpdateZoneEntry: (patch: Partial<ZoneGroupingZoneEntry>) => void;
  /** Updates build layout projection for this exported zone — not library membership. */
  onUpdateMemberScanInclusion: (
    exportedZoneId: string,
    memberKey: string,
    includeInScanList: boolean,
  ) => void;
  expansionByChannelId?: Map<string, ExpandedMxNChannelRow[]>;
  /**
   * `scanList` (default): members of a zone-derived scan list (DM32, Anytone).
   * `scanSet`: the zone's own scan set, "Scan in this zone" (zone scan set builds).
   */
  variant?: ZoneScanMemberVariant;
}

export type ZoneScanMemberVariant = 'scanList' | 'scanSet';

const MEMBER_COPY: Record<ZoneScanMemberVariant, { heading: string; hint: string; aria: string }> =
  {
    scanList: {
      heading: 'Include in scan list',
      hint: 'Changes apply to this radio build only (exported zone projection). Expanded channels can skip individual projections.',
      aria: 'in scan list',
    },
    scanSet: {
      heading: 'Scan in this zone',
      hint: 'Which channels Scan visits while this zone is selected. Applies to this radio build only; Scan in All channels is set per channel on its own page.',
      aria: 'in this zone’s scan',
    },
  };

export function ZoneScanExpandPanel({
  zone,
  zones,
  entry,
  zoneBehaviourContext,
  channelById,
  showScanCarrierControls,
  saving,
  onUpdateZoneEntry,
  onUpdateMemberScanInclusion,
  expansionByChannelId,
  variant = 'scanList',
}: ZoneScanExpandPanelProps) {
  const copy = MEMBER_COPY[variant];
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => new Set());
  const carrierMhz =
    entry?.scanCarrierFrequencyHz != null
      ? entry.scanCarrierFrequencyHz / 1_000_000
      : DEFAULT_CARRIER_MHZ;
  const memberRefs = collectZoneScanProjectionMemberRefs(
    zone,
    zones,
    {
      context: zoneBehaviourContext,
      layoutEntry: entry,
    },
    expansionByChannelId,
    (channelId) => {
      const channel = channelById.get(channelId);
      return channel ? channelDisplayLabel(channel) : channelId;
    },
  );
  const zoneById = new Map(zones.map((row) => [row.id, row]));

  return (
    <Stack gap="sm" pl="md" py="xs">
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
          {copy.heading}
        </Text>
        <Text size="xs" c="dimmed">
          {copy.hint}
        </Text>
        {memberRefs.map((member) => {
          if (member.nestRole === 'child' && collapsedParents.has(member.channelId)) {
            return null;
          }
          const ownerZone = zoneById.get(member.ownerZoneId);
          const nested = member.ownerZoneId !== zone.id;
          const baseLabel =
            member.nestRole === 'child'
              ? member.displayLabel
              : nested && ownerZone
                ? `${member.displayLabel} (${ownerZone.name})`
                : member.displayLabel;
          const isParent = member.nestRole === 'parent';
          const expanded = !collapsedParents.has(member.channelId);

          return (
            <Group
              key={`${member.ownerZoneId}:${member.memberKey}`}
              justify="space-between"
              wrap="nowrap"
              pl={member.nestRole === 'child' ? 'md' : undefined}
              style={
                isParent
                  ? { background: 'var(--mantine-color-default-hover)', borderRadius: 4 }
                  : undefined
              }
            >
              <Group gap="xs" wrap="nowrap">
                {isParent ? (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={
                      expanded
                        ? `Collapse projections for ${baseLabel}`
                        : `Expand projections for ${baseLabel}`
                    }
                    onClick={() =>
                      setCollapsedParents((prev) => {
                        const next = new Set(prev);
                        if (next.has(member.channelId)) next.delete(member.channelId);
                        else next.add(member.channelId);
                        return next;
                      })
                    }
                  >
                    {expanded ? (
                      <IconChevronDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                    ) : (
                      <IconChevronRight size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                    )}
                  </ActionIcon>
                ) : null}
                <Text size="sm" fw={isParent ? 600 : 400}>
                  {baseLabel}
                  {isParent && member.nestChildCount != null
                    ? ` (${member.nestChildCount} projections)`
                    : ''}
                </Text>
              </Group>
              <Switch
                aria-label={`Include ${baseLabel} ${copy.aria}`}
                checked={member.includeInScanList}
                disabled={saving}
                onChange={(event) =>
                  onUpdateMemberScanInclusion(
                    zone.id,
                    member.memberKey,
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
