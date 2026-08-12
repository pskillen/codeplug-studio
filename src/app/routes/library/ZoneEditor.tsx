import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
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
import { UnsavedChangesModal } from '../../components/v2/index.ts';
import {
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  MapPanel,
  Panel,
  StickyFooter,
  TextInput,
  ToggleSwitch,
} from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import ZoneMemberEditor, {
  type ZoneMemberEditorMapFilters,
} from '../../components/library/ZoneMemberEditor.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import {
  normalizeZoneMembers,
  zoneMembersFromSelectedIds,
} from '../../components/library/zoneMembers.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import { readInitialChannelIds } from './zoneEditorState.ts';
import classes from './zones/ZoneEditLayout.module.css';

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
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const location = useLocation();
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

  function buildRow(): Zone {
    return {
      ...base,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
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
    void save(() => persistence.putZone(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const displayError = validationError ?? error;

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          compact={isMobile}
          crumb="Zones"
          crumbTo="/library/zones"
          title={previewZone.name || 'Untitled zone'}
          subtitle={entity ? 'Edit zone' : 'New zone'}
        />

        {displayError ? <p className={classes.error}>{displayError}</p> : null}

        <div
          className={[classes.createScrollBody, isMobile ? classes.createScrollBodyCompact : '']
            .filter(Boolean)
            .join(' ')}
        >
          <Panel title="Identity">
            <div className={classes.fieldStack}>
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
              <FormField label="Comment">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  aria-label="Comment"
                />
              </FormField>
              <ToggleSwitch
                label="Don't export as its own zone"
                checked={omitFromExport}
                onChange={(checked) => setOmitFromExport(checked)}
              />
              <p className={classes.hint}>
                Enable when this zone is only a building block for other zones — for example a
                PMR446 simplex set you nest inside every city zone. Its channels still export inside
                parent zones; this zone will not get its own row in Zones.csv.
              </p>
              {entity ? (
                <EntityDeleteButton
                  kind="zone"
                  entityId={entity.id}
                  label={entity.name}
                  onDeleted={() => navigate('/library/zones')}
                />
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Members"
            sub="Order matches export order for zone-capable builds. Nested zones flatten at export."
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
          </Panel>

          <MapPanel
            title="Map"
            height={360}
            legend={
              mapSkipped.length > 0 ? (
                <p className={classes.mapSkipped}>
                  {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
                  (missing coordinates, Use Location = No, or 0,0).
                </p>
              ) : undefined
            }
          >
            <CodeplugMap
              channels={channelsForMap}
              zones={zonesForMap}
              allChannels={library.channels}
              height="100%"
              mapControlMode="zoneEmphasis"
              emphasisZoneId={base.id}
              fitBoundsChannelIds={fitBoundsChannelIds}
              dimmedChannelIds={dimmedChannelIds}
              onChannelClick={(id) => navigate(`/library/channels/${id}`)}
            />
          </MapPanel>
        </div>

        <StickyFooter
          compact={isMobile}
          saveLabel="Save zone"
          onCancel={() => navigate('/library/zones')}
          onSave={handleSave}
          saving={saving}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
