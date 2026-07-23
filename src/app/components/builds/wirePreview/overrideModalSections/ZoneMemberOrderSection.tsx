import { ActionIcon, Badge, Checkbox, Group, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { Channel, Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { ExpandedMxNChannelRow } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import {
  isZoneMemberOrderOverridden,
  orderChannelIdsByLayoutHint,
  zoneMemberOrderResetConfirmMessage,
} from '@core/domain/zoneGroupingLayout.ts';
import { reorderScanListMembers } from '@core/domain/membershipOrder.ts';
import {
  buildExportSortConfirmMessage,
  sortChannelIdsByMode,
  type MembershipSortMode,
} from '@core/domain/membershipSort.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import MembershipSortMenu from '../../../library/MembershipSortMenu.tsx';
import SelectedItemDragHandle from '../../../ui/SelectedItemDragHandle.tsx';
import SelectedItemList from '../../../ui/SelectedItemList.tsx';
import SelectedItemRowMoveButtons from '../../../ui/SelectedItemRowMoveButtons.tsx';
import ExportOrderOverrideBanner from '../ExportOrderOverrideBanner.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../../lib/iconSizes.ts';

export interface ZoneMemberOrderSectionProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  channelById: ReadonlyMap<string, Channel>;
  saving: boolean;
  onSetChannelIds: (channelIds: string[]) => void;
  /** MxN expansion keyed by parent channel — nests projection wire names under each member. */
  expansionByChannelId?: Map<string, ExpandedMxNChannelRow[]>;
}

export default function ZoneMemberOrderSection({
  zone,
  zones,
  entry,
  channelById,
  saving,
  onSetChannelIds,
  expansionByChannelId,
}: ZoneMemberOrderSectionProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => new Set());

  const effective = resolveEffectiveZoneChannelIds(zone, zones);
  const orderedIds = entry?.channelIds?.length
    ? orderChannelIdsByLayoutHint(effective, entry.channelIds)
    : effective;
  const orderOverridden = isZoneMemberOrderOverridden(zone, zones, entry?.channelIds);

  const projectionTotal = useMemo(() => {
    if (!expansionByChannelId) return orderedIds.length;
    return orderedIds.reduce(
      (sum, channelId) => sum + (expansionByChannelId.get(channelId)?.length ?? 1),
      0,
    );
  }, [orderedIds, expansionByChannelId]);

  const moveSelected = (direction: 'up' | 'down') => {
    if (!selected.length) return;
    onSetChannelIds(reorderScanListMembers(orderedIds, new Set(selected), direction));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    onSetChannelIds(reorderScanListMembers(orderedIds, new Set([id]), direction));
  };

  const canMoveUp = selected.some((id) => orderedIds.indexOf(id) > 0);
  const canMoveDown = selected.some((id) => {
    const index = orderedIds.indexOf(id);
    return index >= 0 && index < orderedIds.length - 1;
  });

  function handleResetOrder() {
    if (!window.confirm(zoneMemberOrderResetConfirmMessage())) return;
    onSetChannelIds(effective);
  }

  function handleSortMembers(mode: MembershipSortMode) {
    onSetChannelIds(sortChannelIdsByMode(orderedIds, channelById, mode));
  }

  function toggleCollapse(channelId: string) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  const listDescription =
    expansionByChannelId && projectionTotal !== orderedIds.length
      ? `${orderedIds.length} channels · ${projectionTotal} export wires`
      : `${orderedIds.length} channel${orderedIds.length === 1 ? '' : 's'}`;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Member export order
      </Text>
      <Text size="sm" c="dimmed">
        Build override for channel order inside this zone. Does not change the library zone.
        {expansionByChannelId
          ? ' Reorder applies to library channels; expanded export wires are shown nested.'
          : null}
      </Text>
      <ExportOrderOverrideBanner
        visible={orderOverridden}
        disabled={saving}
        onReset={handleResetOrder}
        message="Member export order on this build differs from the library zone membership order."
      />
      <SelectedItemList
        title="Channels (export order)"
        description={listDescription}
        itemKeys={orderedIds}
        selectedKeys={selected}
        onToggleSelect={(id) =>
          setSelected((prev) =>
            prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
          )
        }
        onRemove={() => undefined}
        emptyMessage="No channels in this zone"
        onReorder={onSetChannelIds}
        reorderDisabled={saving}
        onMoveSelected={moveSelected}
        onMoveItem={moveItem}
        canMoveUp={!saving && canMoveUp}
        canMoveDown={!saving && canMoveDown}
        toolbar={
          <MembershipSortMenu
            label="Sort channels…"
            disabled={saving || orderedIds.length < 2}
            confirmMessage={buildExportSortConfirmMessage}
            onSort={handleSortMembers}
          />
        }
        renderItem={({ itemKey, selected: rowSelected, onToggleSelect, dragHandle, rowMove }) => {
          const channel = channelById.get(itemKey);
          const label = channel ? channelDisplayLabel(channel) : itemKey;
          const projections = expansionByChannelId?.get(itemKey);
          const hasNest = projections != null && projections.length > 1;
          const nestExpanded = !collapsedParents.has(itemKey);

          return (
            <Stack gap={4}>
              <Group
                gap="xs"
                wrap="nowrap"
                p={hasNest ? 'xs' : undefined}
                style={
                  hasNest
                    ? {
                        background: 'var(--mantine-color-default-hover)',
                        borderRadius: 4,
                      }
                    : undefined
                }
              >
                {hasNest ? (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={
                      nestExpanded
                        ? `Collapse projections for ${label}`
                        : `Expand projections for ${label}`
                    }
                    onClick={() => toggleCollapse(itemKey)}
                  >
                    {nestExpanded ? (
                      <IconChevronDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                    ) : (
                      <IconChevronRight size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                    )}
                  </ActionIcon>
                ) : null}
                <Checkbox checked={rowSelected} onChange={onToggleSelect} aria-label="Select" />
                <SelectedItemDragHandle dragHandle={dragHandle} />
                <Text size="sm" fw={hasNest ? 600 : 400} truncate style={{ flex: 1, minWidth: 0 }}>
                  {label}
                </Text>
                {hasNest ? (
                  <Badge size="sm" variant="light" color="gray">
                    {projections.length} projections
                  </Badge>
                ) : null}
                <SelectedItemRowMoveButtons
                  rowMove={rowMove}
                  upLabel={`Move ${label} up`}
                  downLabel={`Move ${label} down`}
                />
              </Group>
              {hasNest && nestExpanded
                ? projections.map((projection) => (
                    <Text key={projection.key} size="sm" c="dimmed" pl="xl">
                      {projection.wireName}
                    </Text>
                  ))
                : null}
              {!hasNest && projections?.[0]?.wireName ? (
                <Text size="xs" c="dimmed" pl="xl">
                  Export wire: {projections[0].wireName}
                </Text>
              ) : null}
            </Stack>
          );
        }}
      />
    </Stack>
  );
}
