import { Select, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import { updateZoneChannelIds } from '@core/domain/zoneGroupingLayout.ts';
import ZoneMemberPicker from '../library/ZoneMemberPicker.tsx';

export interface BuildZoneLayoutEditorProps {
  section: ZoneGroupingLayout;
  channels: Channel[];
  saving?: boolean;
  onSectionChange: (section: ZoneGroupingLayout) => void;
}

export default function BuildZoneLayoutEditor({
  section,
  channels,
  saving = false,
  onSectionChange,
}: BuildZoneLayoutEditorProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    section.zones[0]?.id ?? null,
  );

  const zoneOptions = useMemo(
    () =>
      section.zones.map((zone) => ({
        value: zone.id,
        label: zone.name,
      })),
    [section.zones],
  );

  const activeZone = section.zones.find((zone) => zone.id === selectedZoneId) ?? section.zones[0];

  if (!section.zones.length) {
    return (
      <Text size="sm" c="dimmed">
        No library zones yet. Add zones in the library first.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <Title order={4}>Zone layout</Title>
      <Text size="sm" c="dimmed">
        Member order here controls export order. Only channels included in this build are listed.
      </Text>
      <Select
        label="Zone"
        data={zoneOptions}
        value={activeZone?.id ?? null}
        onChange={(value) => setSelectedZoneId(value)}
        disabled={saving}
      />
      {activeZone ? (
        <ZoneMemberPicker
          channels={channels}
          selectedIds={activeZone.channelIds}
          onChange={(channelIds) => {
            onSectionChange(updateZoneChannelIds(section, activeZone.id, channelIds));
          }}
        />
      ) : null}
    </Stack>
  );
}
