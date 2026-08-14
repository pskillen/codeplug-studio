import { Alert, Loader, TextInput } from '@mantine/core';
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
import {
  Button,
  Checkbox,
  DataTable,
  DesignSystemV2Provider,
  DismissibleNotice,
  MapPanel,
  Pill,
  SegmentedControl,
  type DataTableColumn,
  type DataTableSortState as V2Sort,
} from '../../../components/v2/index.ts';
import { sortRowsByColumn } from '../../../components/v2/DataTable.tsx';
import { DSV2_TOKENS } from '../../../theme-v2.ts';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import AddFromDataSourceModal from '../../../components/library/AddFromDataSourceModal.tsx';
import ChannelBulkEditModal from '../../../components/library/ChannelBulkEditModal.tsx';
import ChannelCard from '../../../components/library/ChannelCard.tsx';
import ChannelListBulkActions from '../../../components/library/ChannelListBulkActions.tsx';
import ChannelListDeleteAction from '../../../components/library/ChannelListDeleteAction.tsx';
import ChannelListFilters from '../../../components/library/ChannelListFilters.tsx';
import ChannelZonesListCell from '../../../components/library/ChannelZonesListCell.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import LibraryMapStack from '../../../components/library/LibraryMapStack.tsx';
import {
  CHANNEL_OPTIONAL_COLUMNS,
  channelListCardColumnsKey,
  channelListColumnsKey,
  loadChannelCardVisibleColumns,
  loadChannelVisibleColumns,
} from '../../../hooks/channelListQueryUtils.ts';
import { useChannelListQuery } from '../../../hooks/useChannelListQuery.ts';
import { usePersistedChannelColumnSort } from '../../../hooks/usePersistedChannelColumnSort.ts';
import { usePersistedChannelListLayout } from '../../../hooks/usePersistedChannelListLayout.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
  type DataTableSortState as V1Sort,
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
import {
  createNameColumn,
  usePersistedColumnVisibility,
  v1SortToV2,
  v2SortToV1,
} from '../../../lib/libraryListTable.tsx';
import { useProjects } from '../../../state/useProjects.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { useLibrary } from '../../../state/useLibrary.ts';
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
import pageClasses from '../../../components/library/LibraryInventoryPage.module.css';
import { groupChannelsForCardView } from './groupChannels.ts';
import classes from './ChannelsListPage.module.css';

const CHANNEL_LAYOUT_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'cards', label: 'Cards' },
] as const;

const CHANNEL_CARD_GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'zone', label: 'Zone' },
  { value: 'band', label: 'Band' },
  { value: 'duplex', label: 'Simplex/split' },
] as const;

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
  const filtered = useFilteredChannels(channels, query, position, zones, { skipSort: true });
  const [columnSortOverride, setColumnSortOverride] = usePersistedChannelColumnSort();
  const [layoutState, { setLayout, setCardGroup }] = usePersistedChannelListLayout();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [addFromOpen, setAddFromOpen] = useState(false);
  const [bulkEditMessage, setBulkEditMessage] = useState<string | null>(null);
  const [bulkEditMessageColor, setBulkEditMessageColor] = useState<'green' | 'orange' | 'red'>(
    'green',
  );
  const [cardDetailsPickerOpen, setCardDetailsPickerOpen] = useState(false);

  const columnStorageKey = activeProjectId ? channelListColumnsKey(activeProjectId) : undefined;
  const cardColumnStorageKey = activeProjectId ? channelListCardColumnsKey(activeProjectId) : undefined;
  const loadVisibleColumns = useCallback(
    () => (activeProjectId ? loadChannelVisibleColumns(activeProjectId) : []),
    [activeProjectId],
  );
  const loadVisibleCardColumns = useCallback(
    () => (activeProjectId ? loadChannelCardVisibleColumns(activeProjectId) : []),
    [activeProjectId],
  );
  const hideableDefs = useMemo(
    () =>
      CHANNEL_OPTIONAL_COLUMNS.map((col) => ({
        key: col.key,
        defaultVisible: col.defaultVisible,
      })),
    [],
  );
  const [visibleKeys, setVisibleKeys] = usePersistedColumnVisibility(
    columnStorageKey,
    hideableDefs,
    columnStorageKey ? loadVisibleColumns : undefined,
  );
  const [cardVisibleKeys, setCardVisibleKeys] = usePersistedColumnVisibility(
    cardColumnStorageKey,
    hideableDefs,
    cardColumnStorageKey ? loadVisibleCardColumns : undefined,
  );

  const effectiveV1Sort = useMemo((): V1Sort => {
    if (columnSortOverride) return columnSortOverride;
    if (query.sortMode === 'distance' && position) {
      return { columnKey: 'distance', direction: 'asc' };
    }
    return { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' };
  }, [columnSortOverride, query.sortMode, position]);

  const handleSortChange = useCallback(
    (state: V2Sort | null) => {
      if (!state) return;
      const v1 = v2SortToV1(state);
      if (!v1) return;
      if (
        v1.columnKey === DATATABLE_NAME_SORT_KEY ||
        v1.columnKey === DATATABLE_CALLSIGN_SORT_KEY
      ) {
        setColumnSortOverride(v1);
        if (query.sortMode === 'distance') {
          query.setSortMode('name');
        }
        return;
      }
      if (v1.columnKey === 'distance') {
        setColumnSortOverride(v1);
        query.setSortMode('distance');
        return;
      }
      setColumnSortOverride(v1);
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
          header: 'Frequency',
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

  const columns = useMemo((): DataTableColumn<Channel>[] => {
    const callsignColumn: DataTableColumn<Channel> = {
      key: DATATABLE_CALLSIGN_SORT_KEY,
      header: 'Callsign',
      hideable: true,
      hideOnMobile: true,
      sortable: true,
      render: (ch) => ch.callsign || '—',
      sortValue: (ch) => ch.callsign || '',
    };

    const nameColumn = createNameColumn<Channel>({
      getName: (ch) => ch.name || '—',
      getPath: (ch) => `/library/channels/${ch.id}`,
    });

    return [
      nameColumn,
      callsignColumn,
      ...optionalColumnDefs,
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '52px',
        render: (ch: Channel) => <ChannelListDeleteAction channel={ch} />,
      },
    ];
  }, [optionalColumnDefs]);

  const cardFieldColumns = useMemo(
    () => optionalColumnDefs.filter((col) => cardVisibleKeys.includes(col.key)),
    [optionalColumnDefs, cardVisibleKeys],
  );

  const zoneGroupFieldColumns = useMemo(
    () => cardFieldColumns.filter((col) => col.key !== 'zones'),
    [cardFieldColumns],
  );

  const effectiveV2Sort = useMemo(() => v1SortToV2(effectiveV1Sort), [effectiveV1Sort]);

  const sortedFiltered = useMemo(
    () => sortRowsByColumn(filtered, columns, effectiveV2Sort),
    [filtered, columns, effectiveV2Sort],
  );

  const cardGroups = useMemo(() => {
    if (layoutState.layout !== 'cards' || layoutState.cardGroup === 'none') return null;
    return groupChannelsForCardView(
      sortedFiltered,
      zones,
      layoutState.cardGroup,
      query.zoneFilter,
    );
  }, [layoutState, sortedFiltered, zones, query.zoneFilter]);

  const filteredUniqueIds = useMemo(
    () => [...new Set(filtered.map((ch) => ch.id))],
    [filtered],
  );

  const allCardsSelected =
    filteredUniqueIds.length > 0 && filteredUniqueIds.every((id) => selectedKeys.includes(id));
  const someCardsSelected = selectedKeys.length > 0 && !allCardsSelected;

  const toggleChannelSelected = useCallback((channelId: string, selected: boolean) => {
    setSelectedKeys((prev) => {
      if (selected) return prev.includes(channelId) ? prev : [...prev, channelId];
      return prev.filter((key) => key !== channelId);
    });
  }, []);

  const toggleSelectAllCards = useCallback(() => {
    setSelectedKeys(allCardsSelected ? [] : filteredUniqueIds);
  }, [allCardsSelected, filteredUniqueIds]);

  const clearCardSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const renderChannelCard = useCallback(
    (channel: Channel, fieldCols: DataTableColumn<Channel>[]) => (
      <ChannelCard
        key={channel.id}
        channel={channel}
        fieldColumns={fieldCols}
        selected={selectedKeys.includes(channel.id)}
        onSelectedChange={(selected) => toggleChannelSelected(channel.id, selected)}
      />
    ),
    [selectedKeys, toggleChannelSelected],
  );

  const toggleCardDetailVisible = useCallback(
    (key: string, checked: boolean) => {
      if (checked) {
        setCardVisibleKeys([...cardVisibleKeys, key]);
        return;
      }
      setCardVisibleKeys(cardVisibleKeys.filter((visibleKey) => visibleKey !== key));
    },
    [cardVisibleKeys, setCardVisibleKeys],
  );

  const selectedChannels = useMemo(() => {
    const selectedSet = new Set(selectedKeys);
    return filtered.filter((ch) => selectedSet.has(ch.id));
  }, [filtered, selectedKeys]);

  const handleCreateZoneFromSelected = useCallback(() => {
    const selectedSet = new Set(selectedKeys);
    const orderedIds = filtered.filter((ch) => selectedSet.has(ch.id)).map((ch) => ch.id);
    if (orderedIds.length === 0) return;
    setSelectedKeys([]);
    navigate('/library/zones/new', { state: { initialChannelIds: orderedIds } });
  }, [filtered, navigate, selectedKeys]);

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
  const mapChannels = filtered;
  const { skipped } = applyFilters(filtered, { requireUseLocation: true, skipZero: true });

  const channelsEmptyMessage = 'No channels in this project yet.';
  const channelsFilteredEmptyMessage = query.nameFilter.trim()
    ? `No channels match “${query.nameFilter.trim()}”.`
    : 'No channels match your filters.';

  const listActions = (
    <div className={pageClasses.toolbarActions}>
      <Button
        variant="secondary"
        leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => setAddFromOpen(true)}
      >
        Add from directory
      </Button>
      <Button
        variant="primary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/channels/new')}
      >
        New channel
      </Button>
      <Button variant="outline" onClick={() => navigate('/library/channels/defaults')}>
        Channel defaults
      </Button>
    </div>
  );

  const listContent = (
    <>
      {distanceSortPending ? (
        <DismissibleNotice tone="info">
          Distance sort needs your location. Sorted by name until set — use the Distance column
          header after setting location.
        </DismissibleNotice>
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

      <ChannelListFilters />

      <TextInput
        value={query.nameFilterInput}
        onChange={(event) => query.setNameFilter(event.currentTarget.value)}
        placeholder="Filter name or callsign…"
        rightSection={query.nameFilterPending ? <Loader size={16} /> : undefined}
        aria-label="Search table"
        className={classes.search}
      />

      <SegmentedControl
        value={layoutState.layout}
        onChange={(value) => setLayout(value as 'table' | 'cards')}
        options={CHANNEL_LAYOUT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        className={classes.layoutControls}
      />

      {layoutState.layout === 'cards' ? (
        <SegmentedControl
          value={layoutState.cardGroup}
          onChange={(value) =>
            setCardGroup(value as 'none' | 'zone' | 'band' | 'duplex')
          }
          options={CHANNEL_CARD_GROUP_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          className={classes.groupModeControl}
        />
      ) : null}

      {layoutState.layout === 'cards' ? (
        <div className={classes.cardChrome}>
          <div className={classes.cardMetaRow}>
            <span className={classes.cardCount}>
              {sortedFiltered.length === channels.length
                ? `${sortedFiltered.length} result${sortedFiltered.length === 1 ? '' : 's'}`
                : `Showing ${sortedFiltered.length} of ${channels.length}`}
            </span>
            <div className={classes.cardDetailsPickerWrapper}>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={cardDetailsPickerOpen}
                onClick={() => setCardDetailsPickerOpen((open) => !open)}
              >
                Show/hide details
              </Button>
              {cardDetailsPickerOpen ? (
                <div className={classes.cardDetailsPicker} role="menu">
                  {CHANNEL_OPTIONAL_COLUMNS.map((col) => (
                    <label key={col.key} className={classes.cardDetailsPickerRow}>
                      <Checkbox
                        checked={cardVisibleKeys.includes(col.key)}
                        onCheckedChange={(checked) => toggleCardDetailVisible(col.key, checked)}
                      />
                      <span>{col.header}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className={classes.cardSelectionToolbar}>
            <label className={classes.cardSelectAll}>
              <Checkbox
                checked={allCardsSelected}
                indeterminate={someCardsSelected}
                onCheckedChange={toggleSelectAllCards}
                aria-label="Select all channels"
              />
              <span>Select all</span>
            </label>
            <span className={classes.cardSelectionCount}>{selectedKeys.length} selected</span>
            <div className={classes.cardBulkActions}>
              <ChannelListBulkActions
                selectedCount={selectedKeys.length}
                onBulkEdit={handleBulkEdit}
                onCreateZoneFromSelected={handleCreateZoneFromSelected}
              />
            </div>
            <button type="button" className={classes.clearSelection} onClick={clearCardSelection}>
              Clear
            </button>
          </div>

          {sortedFiltered.length === 0 ? (
            <p className={classes.zoneGroupsEmpty}>
              {channels.length === 0 ? channelsEmptyMessage : channelsFilteredEmptyMessage}
            </p>
          ) : cardGroups ? (
            <div className={classes.zoneGroups}>
              {cardGroups.map((group) => (
                <section key={group.key} className={classes.zoneSection}>
                  <h2 className={classes.zoneSectionTitle}>{group.title}</h2>
                  <div className={classes.zoneCardGrid}>
                    {sortRowsByColumn(
                      group.channels,
                      columns,
                      effectiveV2Sort,
                    ).map((ch) =>
                      renderChannelCard(
                        ch,
                        layoutState.cardGroup === 'zone' ? zoneGroupFieldColumns : cardFieldColumns,
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={classes.zoneCardGrid}>
              {sortedFiltered.map((ch) => renderChannelCard(ch, cardFieldColumns))}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(ch) => ch.id}
          totalRowCount={channels.length}
          visibleKeys={visibleKeys}
          onVisibleKeysChange={setVisibleKeys}
          sort={effectiveV2Sort}
          onSortChange={handleSortChange}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          bulkActions={
            <ChannelListBulkActions
              selectedCount={selectedKeys.length}
              onBulkEdit={handleBulkEdit}
              onCreateZoneFromSelected={handleCreateZoneFromSelected}
            />
          }
          emptyMessage={channelsEmptyMessage}
          filteredEmptyMessage={channelsFilteredEmptyMessage}
          onRowActivate={(ch) => navigate(`/library/channels/${ch.id}`)}
        />
      )}

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
    </>
  );

  const mapContent = (
    <>
      <div className={classes.mapMeta}>
        {position ? (
          <>
            {position.accuracyMeters != null && Number.isFinite(position.accuracyMeters) ? (
              <span>My location accuracy ±{Math.round(position.accuracyMeters)} m</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={clearPosition}>
              Clear my location
            </Button>
          </>
        ) : (
          <UseMyLocationButton
            label="Show my location"
            onLocation={(lat, lon, accuracyMeters) =>
              setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
            }
          />
        )}
      </div>
      <MapPanel
        title="Channel locations"
        height={isMobileTable ? 560 : 420}
        legend={
          skipped.length > 0 ? (
            <span>
              {skipped.length} channel{skipped.length === 1 ? '' : 's'} not shown on map (missing
              coordinates, Use Location = No, or 0,0).
            </span>
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
    </>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={pageClasses.page}>
          <LibraryInventoryHeader title="Channels" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    channels.length === 1
      ? '1 channel in this project'
      : `${channels.length} channels in this project`;

  return (
    <DesignSystemV2Provider>
      <div className={pageClasses.page}>
        <LibraryInventoryHeader title="Channels" subtitle={countLabel} actions={listActions} />

        <LibraryMapStack layout="stacked" list={listContent} map={mapContent} />
      </div>
    </DesignSystemV2Provider>
  );
}
