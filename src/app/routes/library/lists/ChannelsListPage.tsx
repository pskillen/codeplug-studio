import { Alert, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconWorldSearch } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@core/models/library.ts';
import { zonesWithDirectChannelMember } from '@core/domain/zoneMembership.ts';
import { applyFilters, channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { resolveChannelPrimaryMode } from '@core/domain/modeProfiles.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import { Button, DesignSystemV2Provider, MapPanel, Pill, SearchInput } from '../../../components/v2/index.ts';
import { DSV2_TOKENS } from '../../../theme-v2.ts';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { DataTable } from '../../../components/ui/index.ts';
import type { DataTableColumn, DataTableSortState } from '../../../components/ui/DataTable.tsx';
import {
  CHANNEL_OPTIONAL_COLUMNS,
  channelListColumnsKey,
  loadChannelVisibleColumns,
} from '../../../hooks/channelListQueryUtils.ts';
import { useChannelListQuery } from '../../../hooks/useChannelListQuery.ts';
import { usePersistedChannelColumnSort } from '../../../hooks/usePersistedChannelColumnSort.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
  sortDataTableRows,
} from '../../../lib/dataTable/sort.ts';
import {
  distanceLabelForChannel,
  useFilteredChannels,
} from '../../../hooks/useChannelListFilters.ts';
import { formatChannelRxTxListCell } from '../../../lib/formatFrequency.ts';
import {
  dmrContactDisplayName,
  dmrRxGroupListName,
  channelScanListName,
} from '../../../lib/entityRefs.ts';
import { bandFromChannel } from '../../../lib/bands.ts';
import { getModeDefinition, type ChannelMode } from '../../../lib/channelModes.ts';
import { channelModesForFilter } from '../../../lib/channels.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../../lib/breakpoints.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useProjects } from '../../../state/useProjects.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { useLibrary } from '../../../state/useLibrary.ts';
import AddFromDataSourceModal from '../../../components/library/AddFromDataSourceModal.tsx';
import ChannelListDeleteAction from '../../../components/library/ChannelListDeleteAction.tsx';
import ChannelBulkEditModal from '../../../components/library/ChannelBulkEditModal.tsx';
import ChannelListFilters from '../../../components/library/ChannelListFilters.tsx';
import ChannelZonesListCell from '../../../components/library/ChannelZonesListCell.tsx';
import {
  bulkDeleteAlertColor,
  formatChannelBulkDeleteMessage,
  type PersistChannelBulkDeleteOutcome,
} from '../../../lib/channelBulkDelete.ts';
import {
  formatChannelBulkEditMessage,
  type PersistChannelBulkEditSuccess,
} from '../../../lib/channelBulkEdit.ts';
import {
  channelHasDmrProfile,
  formatAprsAssignmentSummary,
} from '../../../lib/aprsBindingHelpers.ts';
import classes from './ChannelsListPage.module.css';

function percentLabel(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

function v2ModePill(mode: ChannelMode, primary: boolean) {
  const def = getModeDefinition(mode);
  const textColor =
    mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
      ? DSV2_TOKENS.colors.pillTextLight
      : DSV2_TOKENS.colors.pillTextDark;
  const label = primary ? `${def.label} (primary)` : def.label;
  return (
    <Pill key={mode} tone="semantic" color={def.color} textColor={textColor}>
      {label}
    </Pill>
  );
}

export default function ChannelsListPage() {
  const navigate = useNavigate();
  const { library, loading, projectId, deleteEntity, reload } = useLibrary();
  const { activeProjectId } = useProjects();
  const { channels, zones } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const query = useChannelListQuery();
  const isMobileTable = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const filtered = useFilteredChannels(channels, query, position, { skipSort: true });
  const [columnSortOverride, setColumnSortOverride] = usePersistedChannelColumnSort();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [addFromOpen, setAddFromOpen] = useState(false);
  const [bulkEditMessage, setBulkEditMessage] = useState<string | null>(null);
  const [bulkEditMessageColor, setBulkEditMessageColor] = useState<'green' | 'orange' | 'red'>(
    'green',
  );

  const listActions = (
    <Group gap="xs" className={classes.toolbarActions}>
      <Button
        variant="primary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/channels/new')}
      >
        New channel
      </Button>
      <Button
        variant="secondary"
        leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => setAddFromOpen(true)}
      >
        Add from…
      </Button>
      <Button variant="ghost" onClick={() => navigate('/library/channels/defaults')}>
        Channel defaults
      </Button>
    </Group>
  );

  const mapChannels = filtered;
  const { skipped } = applyFilters(filtered, { requireUseLocation: true, skipZero: true });

  const effectiveSort = useMemo((): DataTableSortState => {
    if (columnSortOverride) return columnSortOverride;
    if (query.sortMode === 'distance' && position) {
      return { columnKey: 'distance', direction: 'asc' };
    }
    return { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' };
  }, [columnSortOverride, query.sortMode, position]);

  const handleSortChange = useCallback(
    (state: DataTableSortState | null) => {
      if (!state) return;
      if (
        state.columnKey === DATATABLE_NAME_SORT_KEY ||
        state.columnKey === DATATABLE_CALLSIGN_SORT_KEY
      ) {
        setColumnSortOverride(state);
        if (query.sortMode === 'distance') {
          query.setSortMode('name');
        }
        return;
      }
      if (state.columnKey === 'distance') {
        setColumnSortOverride(state);
        query.setSortMode('distance');
        return;
      }
      setColumnSortOverride(state);
      if (query.sortMode === 'distance') {
        query.setSortMode('name');
      }
    },
    [query, setColumnSortOverride],
  );

  const optionalColumnDefs = useMemo((): DataTableColumn<Channel>[] => {
    return CHANNEL_OPTIONAL_COLUMNS.map((col) => {
      const base = {
        key: col.key,
        header: col.header,
        hideable: true,
        defaultVisible: col.defaultVisible,
        hideOnMobile: col.key !== 'band' && col.key !== 'mode' && col.key !== 'rxTx',
      };

      if (col.key === 'zones') {
        return {
          ...base,
          render: (ch: Channel) => <ChannelZonesListCell channel={ch} zones={zones} />,
          sortValue: (ch: Channel) =>
            zonesWithDirectChannelMember(ch.id, zones)
              .map((z) => z.name)
              .join(', '),
        };
      }
      if (col.key === 'abbreviation') {
        return {
          ...base,
          render: (ch: Channel) => ch.abbreviation?.trim() || '—',
          sortValue: (ch: Channel) => ch.abbreviation?.trim() || '',
        };
      }
      if (col.key === 'band') {
        return {
          ...base,
          render: (ch: Channel) => {
            const band = bandFromChannel(ch.rxFrequency, ch.txFrequency);
            if (!band) return '—';
            return (
              <Pill tone="semantic" color={band.color} textColor={DSV2_TOKENS.colors.pillTextLight}>
                {band.label}
              </Pill>
            );
          },
          sortValue: (ch: Channel) => ch.rxFrequency ?? ch.txFrequency ?? 0,
        };
      }
      if (col.key === 'mode') {
        return {
          ...base,
          render: (ch: Channel) => {
            const modes = channelModesForFilter(ch);
            const primary = modes.length > 1 ? resolveChannelPrimaryMode(ch) : null;
            return (
              <div className={classes.pillRow}>
                {modes.map((mode) => v2ModePill(mode, mode === primary))}
              </div>
            );
          },
          sortValue: (ch: Channel) => channelModesForFilter(ch).join(','),
        };
      }
      if (col.key === 'rxTx') {
        return {
          ...base,
          render: (ch: Channel) => formatChannelRxTxListCell(ch.rxFrequency, ch.txFrequency),
          sortValue: (ch: Channel) => ch.rxFrequency ?? ch.txFrequency,
        };
      }
      if (col.key === 'contact') {
        return {
          ...base,
          render: (ch: Channel) => dmrContactDisplayName(library, ch.id) || '—',
          sortValue: (ch: Channel) => dmrContactDisplayName(library, ch.id),
        };
      }
      if (col.key === 'rgl') {
        return {
          ...base,
          render: (ch: Channel) => dmrRxGroupListName(library, ch.id) || '—',
          sortValue: (ch: Channel) => dmrRxGroupListName(library, ch.id),
        };
      }
      if (col.key === 'scanList') {
        return {
          ...base,
          render: (ch: Channel) => channelScanListName(library, ch.id) || '—',
          sortValue: (ch: Channel) => channelScanListName(library, ch.id),
        };
      }
      if (col.key === 'aprs') {
        const slots = library.aprsConfiguration?.channelSlots ?? [];
        return {
          ...base,
          render: (ch: Channel) => {
            if (!channelHasDmrProfile(ch)) return '—';
            return formatAprsAssignmentSummary(ch.aprs, slots, channels);
          },
          sortValue: (ch: Channel) => {
            if (!channelHasDmrProfile(ch)) return '';
            return formatAprsAssignmentSummary(ch.aprs, slots, channels);
          },
        };
      }
      if (col.key === 'distance') {
        return {
          ...base,
          render: (ch: Channel) => (position ? distanceLabelForChannel(ch, position) : '—'),
          sortValue: (ch: Channel) => {
            if (!position || !channelHasGeolocation(ch)) return null;
            return haversineDistanceM(
              position.lat,
              position.lon,
              ch.location!.lat,
              ch.location!.lon,
            );
          },
        };
      }
      if (col.key === 'power') {
        return {
          ...base,
          render: (ch: Channel) => percentLabel(ch.power),
          sortValue: (ch: Channel) => ch.power,
        };
      }
      if (col.key === 'comment') {
        return {
          ...base,
          render: (ch: Channel) => ch.comment || '—',
          sortValue: (ch: Channel) => ch.comment || '',
        };
      }
      return {
        ...base,
        render: (ch: Channel) =>
          ch.location && ch.useLocation
            ? coordsToLocator(ch.location.lat, ch.location.lon, 6)
            : '—',
        sortValue: (ch: Channel) =>
          ch.location && ch.useLocation ? coordsToLocator(ch.location.lat, ch.location.lon, 6) : '',
      };
    });
  }, [channels, library, position, zones]);

  const tableColumns = useMemo((): DataTableColumn<Channel>[] => {
    return [
      ...optionalColumnDefs,
      {
        key: 'actions',
        header: '',
        hideable: false,
        defaultVisible: true,
        render: (ch: Channel) => <ChannelListDeleteAction channel={ch} />,
      },
    ];
  }, [optionalColumnDefs]);

  const sortCtx = useMemo(
    () => ({
      columns: tableColumns,
      callsignColumn: {
        getName: (ch: Channel) => ch.callsign || '—',
        getPath: (ch: Channel) => `/library/channels/${ch.id}`,
        sortValue: (ch: Channel) => ch.callsign || '',
      },
      nameColumn: {
        getName: (ch: Channel) => ch.name || '—',
        getPath: (ch: Channel) => `/library/channels/${ch.id}`,
        render: isMobileTable
          ? (ch: Channel) => {
              const zoneNames = zonesWithDirectChannelMember(ch.id, zones)
                .map((z) => z.name)
                .join(', ');
              const power = percentLabel(ch.power);
              const secondary = [ch.callsign, power !== '—' ? `Power ${power}` : null, zoneNames]
                .filter(Boolean)
                .join(' · ');
              return (
                <div className={classes.nameCell}>
                  <div className={classes.namePrimary}>{ch.name || '—'}</div>
                  {secondary ? <div className={classes.nameMeta}>{secondary}</div> : null}
                </div>
              );
            }
          : undefined,
      },
    }),
    [isMobileTable, tableColumns, zones],
  );

  const sortedRows = useMemo(
    () => sortDataTableRows(filtered, effectiveSort, sortCtx),
    [filtered, effectiveSort, sortCtx],
  );

  const selectedChannels = useMemo(() => {
    const selectedSet = new Set(selectedKeys);
    return sortedRows.filter((ch) => selectedSet.has(ch.id));
  }, [selectedKeys, sortedRows]);

  const handleCreateZoneFromSelected = useCallback(() => {
    const selectedSet = new Set(selectedKeys);
    const orderedIds = sortedRows.filter((ch) => selectedSet.has(ch.id)).map((ch) => ch.id);
    if (orderedIds.length === 0) return;
    setSelectedKeys([]);
    navigate('/library/zones/new', { state: { initialChannelIds: orderedIds } });
  }, [navigate, selectedKeys, sortedRows]);

  const handleBulkEdit = useCallback(() => {
    if (selectedChannels.length === 0) return;
    if (selectedChannels.length === 1) {
      navigate(`/library/channels/${selectedChannels[0]!.id}`);
      return;
    }
    setBulkEditMessage(null);
    setBulkEditMessageColor('green');
    setBulkEditOpen(true);
  }, [navigate, selectedChannels]);

  const handleBulkEditApplied = useCallback((outcome: PersistChannelBulkEditSuccess) => {
    setBulkEditMessage(formatChannelBulkEditMessage(outcome));
    setBulkEditMessageColor('green');
    setSelectedKeys([]);
  }, []);

  const handleBulkDeleted = useCallback((outcome: PersistChannelBulkDeleteOutcome) => {
    setBulkEditMessage(formatChannelBulkDeleteMessage(outcome));
    setBulkEditMessageColor(bulkDeleteAlertColor(outcome));
    setSelectedKeys([]);
  }, []);

  const distanceSortPending = query.sortMode === 'distance' && !position;

  const columnStorageKey = activeProjectId ? channelListColumnsKey(activeProjectId) : undefined;
  const loadVisibleColumns = useCallback(
    () => (activeProjectId ? loadChannelVisibleColumns(activeProjectId) : []),
    [activeProjectId],
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <h1 className={classes.title}>Channels</h1>
          <p className={classes.description}>Loading library…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <div className={classes.headerRow}>
          <div>
            <h1 className={classes.title}>Channels</h1>
            <p className={classes.description}>
              Every channel in this project. Search, filter, or open one to edit.
            </p>
          </div>
          {listActions}
        </div>

        <Stack gap="lg">
          {distanceSortPending ? (
            <Text size="sm" c="dimmed" className={classes.alert}>
              Distance sort needs your location. Sorted by name until set — use the Distance column
              header after setting location.
            </Text>
          ) : null}

          {bulkEditMessage ? (
            <Alert
              color={bulkEditMessageColor}
              withCloseButton
              onClose={() => setBulkEditMessage(null)}
              className={classes.alert}
            >
              {bulkEditMessage}
            </Alert>
          ) : null}

          <div className={classes.filterRow}>
            <div className={classes.searchWrap}>
              <SearchInput
                value={query.nameFilterInput}
                onChange={(e) => query.setNameFilter(e.currentTarget.value)}
                placeholder="Filter name or callsign…"
                detectedTag={query.nameFilterPending ? 'Filtering…' : undefined}
                aria-label="Filter name or callsign"
              />
            </div>
          </div>

          <ChannelListFilters />

          <DataTable
            variant="list"
            rows={filtered}
            totalRowCount={channels.length}
            rowKey={(ch) => ch.id}
            sort={effectiveSort}
            onSortChange={handleSortChange}
            columnVisibilityStorageKey={columnStorageKey}
            columnVisibilityLoad={columnStorageKey ? loadVisibleColumns : undefined}
            callsignColumn={sortCtx.callsignColumn}
            nameColumn={sortCtx.nameColumn}
            columns={tableColumns}
            showSearch={false}
            search={query.nameFilterInput}
            searchPending={query.nameFilterPending}
            selectable
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            mobileColumnPolicy="collapse"
            selectionChrome="v2"
            toolbar={
              <Group gap="xs">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedKeys.length === 0}
                  onClick={handleBulkEdit}
                >
                  Bulk edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedKeys.length === 0}
                  onClick={handleCreateZoneFromSelected}
                >
                  New zone from selected
                </Button>
              </Group>
            }
          />

          <ChannelBulkEditModal
            opened={bulkEditOpen}
            onClose={() => setBulkEditOpen(false)}
            channels={selectedChannels}
            projectId={projectId}
            deleteEntity={deleteEntity}
            reload={reload}
            onApplied={handleBulkEditApplied}
            onDeleted={handleBulkDeleted}
          />

          <AddFromDataSourceModal opened={addFromOpen} onClose={() => setAddFromOpen(false)} />

          <section className={classes.mapSection}>
            {position ? (
              <Group gap="sm" align="center">
                {position.accuracyMeters != null && Number.isFinite(position.accuracyMeters) ? (
                  <Text size="sm" c="dimmed">
                    My location accuracy ±{Math.round(position.accuracyMeters)} m
                  </Text>
                ) : null}
                <Button variant="ghost" size="sm" onClick={clearPosition}>
                  Clear my location
                </Button>
              </Group>
            ) : (
              <UseMyLocationButton
                label="Show my location"
                onLocation={(lat, lon, accuracyMeters) =>
                  setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
                }
              />
            )}

            <MapPanel
              title="Map"
              height={420}
              legend={
                skipped.length > 0 ? (
                  <Text size="sm" c="dimmed">
                    {skipped.length} channel{skipped.length === 1 ? '' : 's'} not shown on map
                    (missing coordinates, Use Location = No, or 0,0).
                  </Text>
                ) : undefined
              }
            >
              <CodeplugMap
                channels={mapChannels}
                zones={zones}
                allChannels={mapChannels}
                height="100%"
                operatorPosition={position}
                onChannelClick={(id) => navigate(`/library/channels/${id}`)}
                onZoneClick={(id) => navigate(`/library/zones/${id}`)}
              />
            </MapPanel>
          </section>
        </Stack>
      </div>
    </DesignSystemV2Provider>
  );
}
