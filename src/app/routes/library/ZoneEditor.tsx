import { useCallback, useMemo, useState } from 'react';
import { Button, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import {
  applyFilters,
  channelHasGeolocation,
  DEFAULT_MAP_FILTER_OPTS,
} from '@core/domain/mapProjection.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import { FormSection } from '../../components/ui/index.ts';
import ZoneMemberEditor, {
  type ZoneMemberEditorMapFilters,
} from '../../components/library/ZoneMemberEditor.tsx';
import {
  normalizeZoneMembers,
  zoneMembersFromSelectedIds,
} from '../../components/library/zoneMembers.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';
import { readInitialChannelIds } from './zoneEditorState.ts';

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
  const location = useLocation();
  const { deleteEntity } = useLibrary();
  const initialChannelIds = entity === null ? readInitialChannelIds(location.state) : [];
  const [name, setName] = useState(base.name);
  const [members, setMembers] = useState<ZoneMemberEntry[]>(() =>
    initialChannelIds.length > 0
      ? zoneMembersFromSelectedIds(initialChannelIds)
      : normalizeZoneMembers(base.members),
  );
  const [comment, setComment] = useState(base.comment);
  const [omitFromExport, setOmitFromExport] = useState(base.omitFromExport === true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mapFilters, setMapFilters] = useState<ZoneMemberEditorMapFilters>({
    hiddenMarkerChannelIds: [],
    hiddenZoneMemberIds: [],
  });
  const { save, saving, error } = useEntitySave('zones');

  const handleMapFiltersChange = useCallback((filters: ZoneMemberEditorMapFilters) => {
    setMapFilters(filters);
  }, []);

  const hiddenMarkerIds = useMemo(
    () => new Set(mapFilters.hiddenMarkerChannelIds),
    [mapFilters.hiddenMarkerChannelIds],
  );

  const previewZone = useMemo((): Zone => {
    return {
      ...base,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
  }, [base, name, members, comment, omitFromExport]);

  const channelsForMap = useMemo(
    () => library.channels.filter((ch) => !hiddenMarkerIds.has(ch.id)),
    [library.channels, hiddenMarkerIds],
  );

  const zonesForMap = useMemo(() => {
    const others = library.zones.filter((z) => z.id !== base.id);
    return [...others, previewZone];
  }, [library.zones, base.id, previewZone]);

  const fitBoundsChannelIds = useMemo(
    () => resolveEffectiveZoneChannelIds(previewZone, zonesForMap),
    [previewZone, zonesForMap],
  );

  const dimmedChannelIds = useMemo(() => {
    const memberIds = new Set(fitBoundsChannelIds);
    return channelsForMap
      .filter((ch) => channelHasGeolocation(ch) && !memberIds.has(ch.id))
      .map((ch) => ch.id);
  }, [channelsForMap, fitBoundsChannelIds]);

  const mapSkipped = useMemo(
    () => applyFilters(library.channels, DEFAULT_MAP_FILTER_OPTS).skipped,
    [library.channels],
  );

  function handleSave() {
    const row: Zone = {
      ...base,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
    try {
      const libraryForValidation = {
        ...library,
        zones: entity
          ? library.zones.map((zone) => (zone.id === row.id ? row : zone))
          : [...library.zones, row],
      };
      validateZoneMembership(row.id, members, libraryForValidation);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid zone membership');
      return;
    }
    void save(() => persistence.putZone(row, entity ? entity.revision : null));
  }

  const handleDelete = useCallback(async () => {
    if (!entity) return;
    if (!window.confirm(`Delete zone “${entity.name}”? Channels stay in the library.`)) return;
    setDeleteError(null);
    const result = await deleteEntity('zone', entity.id);
    if (result.ok) {
      navigate('/library/zones');
    } else {
      setDeleteError(
        `Delete blocked — ${result.references.length} entit${result.references.length === 1 ? 'y' : 'ies'} still reference this zone.`,
      );
    }
  }, [deleteEntity, entity, navigate]);

  const displayError = validationError ?? error ?? deleteError;

  return (
    <Stack gap="md" maw={960}>
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Switch
          label="Don't export as its own zone"
          checked={omitFromExport}
          onChange={(e) => setOmitFromExport(e.currentTarget.checked)}
        />
        <Text size="sm" c="dimmed">
          Enable when this zone is only a building block for other zones — for example a PMR446
          simplex set you nest inside every city zone. Its channels still export inside parent
          zones; this zone will not get its own row in Zones.csv.
        </Text>
        {entity ? (
          <Group>
            <Button variant="light" color="red" size="compact-sm" onClick={() => void handleDelete()}>
              Delete zone
            </Button>
          </Group>
        ) : null}
      </FormSection>

      <FormSection
        title="Members"
        description="Order matches export order for zone-capable builds. Nested zones flatten at export."
      >
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={base.id}
          members={members}
          onChange={setMembers}
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
          mapControlMode="zoneEmphasis"
          emphasisZoneId={base.id}
          fitBoundsChannelIds={fitBoundsChannelIds}
          dimmedChannelIds={dimmedChannelIds}
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
        error={displayError}
        onSave={handleSave}
        cancelPath="/library/zones"
      />
    </Stack>
  );
}
