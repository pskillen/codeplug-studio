import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconMapPin, IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { formatZoneDirectMemberSummary } from '@core/domain/zoneMembers.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import {
  applyDenseZoneOrders,
  reorderZoneIds,
  sortZonesByExportOrder,
} from '@core/domain/zoneOrder.ts';
import { sortZonesByName } from '@core/domain/membershipSort.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import MembershipSortMenu from '../../../components/library/MembershipSortMenu.tsx';
import { Button, DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { DataTable } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { persistence } from '../../../state/persistence.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
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
  const reorderDisabled = filterActive || savingOrder;
  const { skipped: mapSkipped } = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS);

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

  const moveZone = useCallback(
    async (zoneId: string, direction: 'up' | 'down') => {
      if (reorderDisabled) return;
      const orderedIds = orderedZones.map((zone) => zone.id);
      const nextIds = reorderZoneIds(orderedIds, new Set([zoneId]), direction);
      if (nextIds.every((id, index) => id === orderedIds[index])) return;
      await persistZoneOrders(applyDenseZoneOrders(zones, nextIds));
    },
    [orderedZones, persistZoneOrders, reorderDisabled, zones],
  );

  const sortZonesAlphabetically = useCallback(async () => {
    if (filterActive || savingOrder || !zones.length) return;
    await persistZoneOrders(sortZonesByName(zones));
  }, [filterActive, persistZoneOrders, savingOrder, zones]);

  const listActions = (
    <Group gap="xs" className={classes.toolbarActions}>
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
    </Group>
  );

  const columns = useMemo((): DataTableColumn<Zone>[] => {
    return [
      {
        key: 'exportOrder',
        header: 'Export order',
        hideable: false,
        render: (z) => {
          const index = orderedZones.findIndex((row) => row.id === z.id);
          return (
            <div className={classes.reorderCell}>
              <span className={classes.orderLabel}>{z.order ?? '—'}</span>
              <Tooltip label="Move up">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${z.name} up`}
                  disabled={reorderDisabled || index <= 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void moveZone(z.id, 'up');
                  }}
                >
                  <IconArrowUp size={14} stroke={ICON_STROKE} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Move down">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${z.name} down`}
                  disabled={reorderDisabled || index < 0 || index >= orderedZones.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    void moveZone(z.id, 'down');
                  }}
                >
                  <IconArrowDown size={14} stroke={ICON_STROKE} />
                </ActionIcon>
              </Tooltip>
            </div>
          );
        },
      },
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
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (z) => z.comment || '—',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (z) => <EntityListDeleteAction kind="zone" entityId={z.id} label={z.name} />,
      },
    ];
  }, [moveZone, orderedZones, reorderDisabled]);

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <div className={classes.headerRow}>
            <div>
              <h1 className={classes.title}>Zones</h1>
              <p className={classes.description}>Loading library…</p>
            </div>
            {listActions}
          </div>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <div className={classes.headerRow}>
          <div>
            <h1 className={classes.title}>Zones</h1>
            <p className={classes.description}>
              Every zone in this project. Reorder export order or open one to edit members.
            </p>
          </div>
          {listActions}
        </div>

        <p className={classes.hint}>
          Zones appear on your radio in this order. Use the arrows to rearrange them (clear the name
          filter first). <strong>Sort zones…</strong> rewrites the list permanently by name — it is
          not a temporary browse sort.
        </p>
        {filterActive ? (
          <p className={classes.warning}>Reorder is disabled while a name filter is active.</p>
        ) : null}
        {orderError ? <p className={classes.error}>{orderError}</p> : null}
        <div className={classes.sortRow}>
          <MembershipSortMenu
            modes={['name']}
            disabled={filterActive || savingOrder || !zones.length}
            onSort={() => void sortZonesAlphabetically()}
            label="Sort zones…"
          />
        </div>

        <DataTable
          variant="list"
          reorderMode
          selectionChrome="v2"
          rows={filtered}
          totalRowCount={zones.length}
          search={nameFilterInput}
          searchPending={nameFilterPending}
          onSearchChange={setNameFilter}
          searchPlaceholder="Filter name…"
          rowKey={(z) => z.id}
          nameColumn={{
            getName: (z) => z.name,
            getPath: (z) => `/library/zones/${z.id}`,
          }}
          columns={columns}
        />

        <section className={classes.mapSection}>
          <h2 className={classes.mapSectionTitle}>Map</h2>
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

          <CodeplugMap
            channels={channels}
            zones={zones}
            allChannels={channels}
            height={420}
            operatorPosition={position}
            onChannelClick={(id) => navigate(`/library/channels/${id}`)}
            onZoneClick={(id) => navigate(`/library/zones/${id}`)}
          />
          {mapSkipped.length > 0 ? (
            <p className={classes.mapSkipped}>
              {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
              (missing coordinates, Use Location = No, or 0,0).
            </p>
          ) : null}
        </section>
      </div>
    </DesignSystemV2Provider>
  );
}
