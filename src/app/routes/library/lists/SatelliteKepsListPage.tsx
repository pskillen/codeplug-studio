import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconRefresh } from '@tabler/icons-react';
import type { Satellite } from '@core/models/satellite.ts';
import { isoNow } from '@core/models/revision.ts';
import { fetchSatelliteSet } from '@integrations/satellites/fetchSatelliteSet.ts';
import { mergeSatelliteSet } from '@integrations/satellites/mergeSatelliteSet.ts';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  ToggleSwitch,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { v1SortToV2, v2SortToV1 } from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { persistence } from '../../../state/persistence.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { useProjects } from '../../../state/useProjects.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';
import staleClasses from './SatelliteKepsListPage.module.css';

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function formatLastUpdated(iso: string | null | undefined): { label: string; stale: boolean } {
  if (!iso) return { label: 'Never refreshed', stale: true };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { label: 'Never refreshed', stale: true };
  const stale = Date.now() - at.getTime() > STALE_AFTER_MS;
  return { label: `Last updated: ${at.toLocaleString()}`, stale };
}

export default function SatelliteKepsListPage() {
  const { library, loading, projectId, reload } = useLibrary();
  const { activeProject, refreshProjects } = useProjects();
  const navigate = useNavigate();
  const { satellites } = library;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('satellite-keps');
  const [sort, setSort] = usePersistedEntityListSort('satellite-keps', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(satellites, nameFilter, (r) => r.name),
    [satellites, nameFilter],
  );

  async function handleToggle(satellite: Satellite, enabled: boolean) {
    await persistence.putSatellite({ ...satellite, enabled }, satellite.revision);
  }

  async function handleRefresh() {
    if (!projectId) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const { source, entries } = await fetchSatelliteSet({ refresh: true });
      const merged = mergeSatelliteSet(library.satellites, entries, source, projectId);
      if (merged.rows.length > 0) {
        await persistence.putSatellitesBatch(
          merged.rows.map((row) => ({ row, expectedRevision: null })),
        );
      }
      const meta = await persistence.loadProjectMeta(projectId);
      if (meta) {
        await persistence.putProjectMeta(
          { ...meta, satelliteLibraryLastUpdated: isoNow() },
          meta.revision,
        );
        await refreshProjects();
      }
      await reload();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Failed to refresh satellites.');
    } finally {
      setRefreshing(false);
    }
  }

  const columns = useMemo((): DataTableColumn<Satellite>[] => {
    return [
      {
        key: DATATABLE_NAME_SORT_KEY,
        header: 'Name',
        sortable: true,
        sortValue: (r) => r.name,
        render: (r) => r.name,
      },
      {
        key: 'noradId',
        header: 'NORAD ID',
        sortable: true,
        sortValue: (r) => r.noradId,
        render: (r) => r.noradId,
      },
      {
        key: 'epoch',
        header: 'Epoch',
        sortable: true,
        sortValue: (r) => r.epoch,
        render: (r) => new Date(r.epoch).toLocaleDateString(),
      },
      {
        key: 'source',
        header: 'Source',
        render: (r) => (r.source === 'celestrak' ? 'CelesTrak' : 'AMSAT'),
      },
      {
        key: 'enabled',
        header: 'Enabled',
        width: '90px',
        render: (r) => (
          <span onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch
              checked={r.enabled}
              onChange={(next) => void handleToggle(r, next)}
              aria-label={`Enable ${r.name}`}
            />
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '52px',
        render: (r) => (
          <EntityListRowDeleteAction kind="satellite" entityId={r.id} label={r.name} />
        ),
      },
    ];
  }, []);

  const enabledCount = satellites.filter((s) => s.enabled).length;
  const { label: lastUpdatedLabel, stale } = formatLastUpdated(
    activeProject?.satelliteLibraryLastUpdated,
  );

  const listActions = (
    <Button
      variant="primary"
      leftSection={<IconRefresh size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => void handleRefresh()}
      disabled={refreshing}
    >
      {refreshing ? 'Updating…' : 'Update from CelesTrak/AMSAT'}
    </Button>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Satellite Keps" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    satellites.length === 1
      ? `1 satellite · ${enabledCount} enabled`
      : `${satellites.length} satellites · ${enabledCount} enabled`;

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader
          title="Satellite Keps"
          subtitle={
            <>
              <span>{countLabel}</span>
              {' · '}
              <span className={stale ? staleClasses.lastUpdatedStale : staleClasses.lastUpdated}>
                {lastUpdatedLabel}
              </span>
            </>
          }
          actions={listActions}
        />
        {refreshError ? <p className={staleClasses.refreshError}>{refreshError}</p> : null}

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          totalRowCount={satellites.length}
          search={{
            value: nameFilterInput,
            onChange: setNameFilter,
            placeholder: 'Filter name…',
            pending: nameFilterPending,
          }}
          sort={v1SortToV2(sort)}
          onSortChange={(next) => {
            const v1 = v2SortToV1(next);
            if (v1) setSort(v1);
          }}
          onRowActivate={(r) => navigate(`/library/satellite-keps/${r.id}`)}
          emptyMessage="No satellites yet. Use “Update from CelesTrak/AMSAT” to fetch the amateur satellite list."
          filteredEmptyMessage={
            nameFilter.trim()
              ? `No satellites match “${nameFilter.trim()}”.`
              : 'No satellites match your filter.'
          }
        />
      </div>
    </DesignSystemV2Provider>
  );
}
