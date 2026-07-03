import { useCallback, useMemo, useState } from 'react';
import { Stack, Text, TextInput } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { Library, Zone } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import { FormSection } from '../../components/ui/index.ts';
import ZoneMemberPicker, {
  type ZoneMemberPickerMapFilters,
} from '../../components/library/ZoneMemberPicker.tsx';
import { zoneMembersFromSelectedIds } from '../../components/library/zoneMembers.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

export default function ZoneEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: Zone | null;
  library: Library;
}) {
  const base = entity ?? newZone(projectId, '');
  const navigate = useNavigate();
  const [name, setName] = useState(base.name);
  const [selectedIds, setSelectedIds] = useState<string[]>(base.members.map((m) => m.id));
  const [comment, setComment] = useState(base.comment);
  const [mapFilters, setMapFilters] = useState<ZoneMemberPickerMapFilters>({
    hiddenMarkerChannelIds: [],
    hiddenZoneMemberIds: [],
  });
  const { save, saving, error } = useEntitySave('zones');

  const handleMapFiltersChange = useCallback((filters: ZoneMemberPickerMapFilters) => {
    setMapFilters(filters);
  }, []);

  const hiddenMarkerIds = useMemo(
    () => new Set(mapFilters.hiddenMarkerChannelIds),
    [mapFilters.hiddenMarkerChannelIds],
  );

  const previewMemberIds = useMemo(
    () => selectedIds.filter((id) => !mapFilters.hiddenZoneMemberIds.includes(id)),
    [selectedIds, mapFilters.hiddenZoneMemberIds],
  );

  const previewZone = useMemo((): Zone => {
    return {
      ...base,
      name: name.trim() || 'Untitled zone',
      members: zoneMembersFromSelectedIds(previewMemberIds),
      comment,
    };
  }, [base, name, previewMemberIds, comment]);

  const channelsForMap = useMemo(
    () => library.channels.filter((ch) => !hiddenMarkerIds.has(ch.id)),
    [library.channels, hiddenMarkerIds],
  );

  const zonesForMap = useMemo(() => {
    const others = library.zones.filter((z) => z.id !== base.id);
    return [...others, previewZone];
  }, [library.zones, base.id, previewZone]);

  const mapSkipped = useMemo(
    () => applyFilters(library.channels, DEFAULT_MAP_FILTER_OPTS).skipped,
    [library.channels],
  );

  function handleSave() {
    const row: Zone = {
      ...base,
      name: name.trim() || 'Untitled zone',
      members: zoneMembersFromSelectedIds(selectedIds),
      comment,
    };
    void save(() => persistence.putZone(row, entity ? entity.revision : null));
  }

  return (
    <Stack gap="md">
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
      </FormSection>

      <FormSection
        title="Members"
        description="Order matches export order for zone-capable builds."
      >
        <ZoneMemberPicker
          channels={library.channels}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          onMapFiltersChange={handleMapFiltersChange}
        />
        {library.channels.length === 0 ? (
          <Link to="/library/channels/new">Add a channel</Link>
        ) : null}
        <CodeplugMap
          channels={channelsForMap}
          zones={zonesForMap}
          allChannels={library.channels}
          height={360}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}
      </FormSection>

      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/zones"
      />
    </Stack>
  );
}
