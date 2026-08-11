import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, Select } from '@mantine/core';
import { IconRefresh, IconTelescope, IconUpload } from '@tabler/icons-react';
import type { Satellite } from '@core/models/satellite.ts';
import { isoNow } from '@core/models/revision.ts';
import { mergeSatnogsTransmittersIntoSatellite } from '@core/domain/satnogs/mergeSatnogsTransmitters.ts';
import { isAtD890SatelliteWriteEligible } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { fetchSatelliteSet } from '@integrations/satellites/fetchSatelliteSet.ts';
import { mergeSatelliteSet } from '@integrations/satellites/mergeSatelliteSet.ts';
import { fetchSatnogsEnrichmentForNoradIds } from '@integrations/satellites/satnogsClient.ts';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import SatelliteKepsWriteTargetModal from '../../../components/SatelliteKepsWriteTargetModal/SatelliteKepsWriteTargetModal.tsx';
import {
  Button,
  CountTile,
  DataTable,
  DesignSystemV2Provider,
  RowActionIcon,
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
import {
  distinctVisibleModes,
  formatFrequenciesCell,
  satelliteHasVisibleMode,
  transmitterWriteEligibleCount,
} from './satelliteKepsListHelpers.ts';
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
  const [satnogsWarning, setSatnogsWarning] = useState<string | null>(null);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [bulkToggling, setBulkToggling] = useState(false);
  const [modeFilter, setModeFilter] = useState<string | null>(null);
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('satellite-keps');
  const [sort, setSort] = usePersistedEntityListSort('satellite-keps', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const nameFiltered = useMemo(
    () => filterRowsByName(satellites, nameFilter, (r) => r.name),
    [satellites, nameFilter],
  );
  /**
   * Available modes for the "satellites with mode" filter — deliberately built from
   * non-dismissed transmitters (`distinctVisibleModes`), not write-eligibility
   * (`isAtD890SatelliteWriteEligible`), which also folds in `Satellite.enabled` and
   * `includeInWrite` and would hide modes belonging to a currently-disabled satellite.
   */
  const availableModes = useMemo(() => distinctVisibleModes(satellites), [satellites]);
  const filtered = useMemo(() => {
    if (!modeFilter) return nameFiltered;
    return nameFiltered.filter((s) => satelliteHasVisibleMode(s, modeFilter));
  }, [nameFiltered, modeFilter]);

  async function handleToggle(satellite: Satellite, enabled: boolean) {
    await persistence.putSatellite({ ...satellite, enabled }, satellite.revision);
  }

  const allVisibleEnabled = filtered.length > 0 && filtered.every((s) => s.enabled);

  /** Enable/disable every currently-**visible** (search + mode filtered) row in one batch. */
  async function handleToggleAllVisible() {
    if (filtered.length === 0 || bulkToggling) return;
    const nextEnabled = !allVisibleEnabled;
    const puts = filtered
      .filter((s) => s.enabled !== nextEnabled)
      .map((s) => ({ row: { ...s, enabled: nextEnabled }, expectedRevision: s.revision }));
    if (puts.length === 0) return;
    setBulkToggling(true);
    try {
      await persistence.putSatellitesBatch(puts);
    } finally {
      setBulkToggling(false);
    }
  }

  async function handleRefresh() {
    if (!projectId) return;
    setRefreshing(true);
    setRefreshError(null);
    setSatnogsWarning(null);
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

      const noradIds = merged.rows.map((row) => row.noradId);
      if (noradIds.length > 0) {
        const { entries: satnogsEntries, failures } = await fetchSatnogsEnrichmentForNoradIds(
          noradIds,
          { refresh: true },
        );
        if (failures.length > 0) {
          setSatnogsWarning(
            `TLE refresh succeeded, but SatNOGS enrichment failed for ${failures.length} satellite(s).`,
          );
        }
        if (satnogsEntries.length > 0) {
          // Re-read current rows (with up-to-date revisions) — the TLE-refresh batch above
          // may have bumped revisions, and `library.satellites` in this closure is stale.
          const current = await persistence.listSatellites(projectId);
          const byNoradId = new Map(current.map((row) => [row.noradId, row]));
          const puts: { row: Satellite; expectedRevision: number | null }[] = [];
          for (const entry of satnogsEntries) {
            const satellite = byNoradId.get(entry.noradId);
            if (!satellite) continue;
            const result = mergeSatnogsTransmittersIntoSatellite(satellite, entry.transmitters);
            if (result.added + result.updated > 0) {
              puts.push({ row: result.satellite, expectedRevision: satellite.revision });
            }
          }
          if (puts.length > 0) {
            await persistence.putSatellitesBatch(puts);
            await reload();
          }
        }
      }
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
        key: 'frequencies',
        header: 'Frequencies',
        render: (r) => formatFrequenciesCell(r),
      },
      {
        key: 'writeEligible',
        header: 'Radios for write',
        width: '110px',
        render: (r) => {
          const { eligible, total } = transmitterWriteEligibleCount(r);
          return `${eligible}/${total}`;
        },
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
        width: '84px',
        render: (r) => (
          <span className={staleClasses.rowActions}>
            <RowActionIcon
              label={`Edit ${r.name} frequencies`}
              icon={<IconTelescope size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              onClick={() => navigate(`/library/satellite-keps/${r.id}`)}
            />
            <EntityListRowDeleteAction kind="satellite" entityId={r.id} label={r.name} />
          </span>
        ),
      },
    ];
  }, [navigate]);

  const enabledCount = satellites.filter((s) => s.enabled).length;
  /**
   * "Enabled radios" — write-eligible transmitters across the whole library, per the
   * operator's vocabulary ("radio" == transmitter that would actually be written). Mirrors
   * `writeSatellitesToRadio`/`packSatelliteWriteRecords`'s own eligibility predicate
   * (`Satellite.enabled && transmitter.includeInWrite && !transmitter.dismissed`) rather than
   * inventing a new one — see the flagged concern in the PR about this predicate currently
   * living in a D890-specific module despite being vendor-neutral in substance.
   */
  const enabledTransmitterCount = satellites.reduce(
    (sum, s) => sum + s.transmitters.filter((t) => isAtD890SatelliteWriteEligible(s, t)).length,
    0,
  );
  const { label: lastUpdatedLabel, stale } = formatLastUpdated(
    activeProject?.satelliteLibraryLastUpdated,
  );

  const listActions = (
    <Group gap="xs" wrap="nowrap">
      <Button
        variant="secondary"
        leftSection={<IconUpload size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => setWriteModalOpen(true)}
      >
        Write Keps to Radio
      </Button>
      <Button
        variant="primary"
        leftSection={<IconRefresh size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => void handleRefresh()}
        disabled={refreshing}
      >
        {refreshing ? 'Updating…' : 'Update from CelesTrak/AMSAT'}
      </Button>
    </Group>
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
        {satnogsWarning ? <p className={staleClasses.refreshError}>{satnogsWarning}</p> : null}

        <div className={staleClasses.summaryGrid}>
          <CountTile value={enabledCount} total={satellites.length} label="Enabled satellites" />
          <CountTile value={enabledTransmitterCount} label="Enabled radios" />
        </div>

        <div className={staleClasses.toolbarRow}>
          <Select
            data={availableModes}
            value={modeFilter}
            onChange={setModeFilter}
            placeholder="All modes"
            clearable
            size="sm"
            aria-label="Filter by mode"
            className={staleClasses.modeFilter}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleToggleAllVisible()}
            disabled={filtered.length === 0 || bulkToggling}
          >
            {allVisibleEnabled ? 'Disable all visible' : 'Enable all visible'}
          </Button>
        </div>

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
          onRowActivate={(r) => navigate(`/tracking/satellites/${r.id}`)}
          emptyMessage="No satellites yet. Use “Update from CelesTrak/AMSAT” to fetch the amateur satellite list."
          filteredEmptyMessage={
            nameFilter.trim()
              ? `No satellites match “${nameFilter.trim()}”.`
              : 'No satellites match your filter.'
          }
        />
      </div>
      <SatelliteKepsWriteTargetModal
        opened={writeModalOpen}
        onClose={() => setWriteModalOpen(false)}
        projectId={projectId}
      />
    </DesignSystemV2Provider>
  );
}
