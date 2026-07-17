import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { Channel, Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import { orderChannelIdsByLayoutHint } from '@core/domain/zoneGroupingLayout.ts';
import { reorderScanListMembers } from '@core/domain/membershipOrder.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import SelectedItemDragHandle from '../../../ui/SelectedItemDragHandle.tsx';
import SelectedItemList from '../../../ui/SelectedItemList.tsx';

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

  const orderedIds = (() => {
    const effective = resolveEffectiveZoneChannelIds(zone, zones);
    return entry?.channelIds?.length
      ? orderChannelIdsByLayoutHint(effective, entry.channelIds)
      : effective;
  })();

  const moveSelected = (direction: 'up' | 'down') => {
    if (!selected.length) return;
    onSetChannelIds(reorderScanListMembers(orderedIds, new Set(selected), direction));
  };

  const canMoveUp = selected.some((id) => orderedIds.indexOf(id) > 0);
  const canMoveDown = selected.some((id) => {
    const index = orderedIds.indexOf(id);
    return index >= 0 && index < orderedIds.length - 1;
  });

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Member export order
      </Text>
      <Text size="sm" c="dimmed">
        Build override for channel order inside this zone. Does not change the library zone.
      </Text>
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
        canMoveUp={!saving && canMoveUp}
        canMoveDown={!saving && canMoveDown}
        renderItem={({ itemKey, selected: rowSelected, onToggleSelect, dragHandle }) => {
          const channel = channelById.get(itemKey);
          return (
            <Group key={itemKey} gap="xs" wrap="nowrap">
              <Checkbox checked={rowSelected} onChange={onToggleSelect} aria-label="Select" />
              <SelectedItemDragHandle dragHandle={dragHandle} />
              <Text size="sm" truncate>
                {channel ? channelDisplayLabel(channel) : itemKey}
              </Text>
            </Group>
          );
        }}
      />
    </Stack>
  );
}
