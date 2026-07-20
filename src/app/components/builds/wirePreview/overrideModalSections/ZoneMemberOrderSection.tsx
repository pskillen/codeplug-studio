import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { Channel, Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
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

export interface ZoneMemberOrderSectionProps {
  zone: Zone;
  zones: Zone[];
  entry: ZoneGroupingZoneEntry | undefined;
  channelById: ReadonlyMap<string, Channel>;
  saving: boolean;
  onSetChannelIds: (channelIds: string[]) => void;
}

export default function ZoneMemberOrderSection({
  zone,
  zones,
  entry,
  channelById,
  saving,
  onSetChannelIds,
}: ZoneMemberOrderSectionProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const effective = resolveEffectiveZoneChannelIds(zone, zones);
  const orderedIds = entry?.channelIds?.length
    ? orderChannelIdsByLayoutHint(effective, entry.channelIds)
    : effective;
  const orderOverridden = isZoneMemberOrderOverridden(zone, zones, entry?.channelIds);

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

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Member export order
      </Text>
      <Text size="sm" c="dimmed">
        Build override for channel order inside this zone. Does not change the library zone.
      </Text>
      <ExportOrderOverrideBanner
        visible={orderOverridden}
        disabled={saving}
        onReset={handleResetOrder}
        message="Member export order on this build differs from the library zone membership order."
      />
      <SelectedItemList
        title="Channels (export order)"
        description={`${orderedIds.length} channel${orderedIds.length === 1 ? '' : 's'}`}
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
          return (
            <Group key={itemKey} gap="xs" wrap="nowrap">
              <Checkbox checked={rowSelected} onChange={onToggleSelect} aria-label="Select" />
              <SelectedItemDragHandle dragHandle={dragHandle} />
              <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }}>
                {channel ? channelDisplayLabel(channel) : itemKey}
              </Text>
              <SelectedItemRowMoveButtons
                rowMove={rowMove}
                upLabel={`Move ${channel ? channelDisplayLabel(channel) : itemKey} up`}
                downLabel={`Move ${channel ? channelDisplayLabel(channel) : itemKey} down`}
              />
            </Group>
          );
        }}
      />
    </Stack>
  );
}
