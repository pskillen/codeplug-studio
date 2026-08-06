import { useCallback, useMemo, useState } from 'react';
import { IconMapPin, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { formatZoneDirectMemberSummary } from '@core/domain/zoneMembers.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import { applyDenseZoneOrders, sortZonesByExportOrder } from '@core/domain/zoneOrder.ts';
import { sortZonesByName } from '@core/domain/membershipSort.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import LibraryMapStack from '../../../components/library/LibraryMapStack.tsx';
import MembershipSortMenu from '../../../components/library/MembershipSortMenu.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  MapPanel,
  SearchInput,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { createNameColumn } from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { persistence } from '../../../state/persistence.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import pageClasses from '../../../components/library/LibraryInventoryPage.module.css';
import classes from './ZonesListPage.module.css';

export default function ZonesListPage() {
  const { library, loading, reload } = useLibrary();
  const navigate = useNavigate();
  const { channels, zones } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('zones');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const orderedZones = useMemo(() => sortZonesByExportOrder(zones), [zones]);
  const filtered = useMemo(
    () => filterRowsByName(orderedZones, nameFilter, (z) => z.name),
    [orderedZones, nameFilter],
  );
  const filterActive = nameFilter.trim().length > 0;
  const { skipped: mapSkipped } = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS);
  const reorderDisabled = filterActive || savingOrder;

  const persistZoneOrders = useCallback(
    async (nextZones: Zone[]) => {
      setSavingOrder(true);
      setOrderError(null);
      try {
        for (const zone of nextZones) {
          const prev = zones.find((row) => row.id === zone.id);
          if (!prev || prev.order === zone.order) continue;
          const result = await persistence.putZone(zone, prev.revision);
          if (!result.ok) {
            throw new Error(
              result.reason === 'revision_conflict'
                ? 'Zone was updated elsewhere — reload and try again'
                : 'Failed to save zone order',
            );
          }
        }
        await reload();
      } catch (err) {
        setOrderError(err instanceof Error ? err.message : 'Failed to save zone order');
      } finally {
        setSavingOrder(false);
      }
    },
    [reload, zones],
  );

  const handleReorder = useCallback(
    async (nextRows: Zone[]) => {
      if (reorderDisabled) return;
      const nextIds = nextRows.map((z) => z.id);
      const currentIds = orderedZones.map((z) => z.id);
      if (nextIds.every((id, index) => id === currentIds[index])) return;
      await persistZoneOrders(applyDenseZoneOrders(zones, nextIds));
    },
    [orderedZones, persistZoneOrders, reorderDisabled, zones],
  );

  const sortZonesAlphabetically = useCallback(async () => {
    if (filterActive || savingOrder || !zones.length) return;
    await persistZoneOrders(sortZonesByName(zones));
  }, [filterActive, persistZoneOrders, savingOrder, zones]);

  const listActions = (
    <div className={pageClasses.toolbarActions}>
      <Button
        variant="primary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/zones/new')}
      >
        New zone
      </Button>
      <Button
        variant="secondary"
        leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/zones/new-from-location')}
      >
        New zone from location
      </Button>
      <Button variant="ghost" onClick={() => navigate('/library/zones/defaults')}>
        Zone defaults
      </Button>
    </div>
  );

  const columns = useMemo((): DataTableColumn<Zone>[] => {
    return [
      createNameColumn<Zone>({
        getName: (z) => z.name,
        getPath: (z) => `/library/zones/${z.id}`,
      }),
      {
        key: 'members',
        header: 'Members',
        render: (z) => {
          const countLabel = formatZoneDirectMemberSummary(z);
          return (
            <div className={classes.membersCell}>
              <span>{countLabel}</span>
              {z.omitFromExport ? <span className={classes.nestedBadge}>Nested only</span> : null}
            </div>
          );
        },
        sortValue: (z) => z.members.length,
      },
      {
        key: 'comment',
        header: 'Comment',
        hideOnMobile: true,
        render: (z) => z.comment || '—',
        sortValue: (z) => z.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '40px',
        render: (z) => <EntityListRowDeleteAction kind="zone" entityId={z.id} label={z.name} />,
      },
    ];
  }, []);

  const tableRows = filterActive ? filtered : orderedZones;

  const mapPanel = (
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
        title="Zone map"
        height={420}
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
          channels={channels}
          zones={zones}
          allChannels={channels}
          height="100%"
          operatorPosition={position}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
      </MapPanel>
    </>
  );

  const listContent = (
    <>
      <div className={classes.toolbarRow}>
        <SearchInput
          value={nameFilterInput}
          onChange={(e) => setNameFilter(e.currentTarget.value)}
          placeholder="Filter name…"
          detectedTag={nameFilterPending ? 'Filtering…' : undefined}
          aria-label="Filter zones by name"
        />
        <MembershipSortMenu
          modes={['name']}
          disabled={filterActive || savingOrder || !zones.length}
          onSort={() => void sortZonesAlphabetically()}
          label="Sort zones…"
        />
      </div>
      {filterActive ? (
        <p className={classes.warning}>
          Reorder is locked while searching. Clear the filter to rearrange export order.
        </p>
      ) : null}
      {orderError ? <p className={classes.error}>{orderError}</p> : null}
      <DataTable
        columns={columns}
        rows={tableRows}
        getRowId={(z) => z.id}
        totalRowCount={zones.length}
        reorderMode={!reorderDisabled}
        onReorder={(next) => void handleReorder(next)}
        emptyMessage="No zones in this project yet."
        filteredEmptyMessage={
          nameFilter.trim()
            ? `No zones match “${nameFilter.trim()}”.`
            : 'No zones match your filter.'
        }
        onRowActivate={(z) => navigate(`/library/zones/${z.id}`)}
      />
    </>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={pageClasses.page}>
          <LibraryInventoryHeader title="Zones" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    zones.length === 1 ? '1 zone in this project' : `${zones.length} zones in this project`;

  return (
    <DesignSystemV2Provider>
      <div className={pageClasses.page}>
        <LibraryInventoryHeader title="Zones" subtitle={countLabel} actions={listActions} />

        <LibraryMapStack layout="split" list={listContent} map={mapPanel} />
      </div>
    </DesignSystemV2Provider>
  );
}
