import { useMemo, useState } from 'react';
import {
  DataTable,
  TextInput,
  type DataTableColumn,
  type DataTableSortState,
} from '../../components/v2/index.ts';
import SatelliteFilter from './SatelliteFilter.tsx';
import type { SatellitePassRow } from './useTrackingPasses.ts';
import classes from './PassGrid.module.css';

function formatDurationSec(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function DateTimeCell({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <div className={classes.dateTimeCell}>
      <span>{date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
      <span className={classes.utc}>{date.toISOString().slice(11, 16)} UTC</span>
    </div>
  );
}

export interface PassGridProps {
  passes: SatellitePassRow[];
  loading: boolean;
  error: string | null;
  onSelectPass?: (row: SatellitePassRow) => void;
}

export default function PassGrid({ passes, loading, error, onSelectPass }: PassGridProps) {
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'aos', direction: 'asc' });
  const [minElevation, setMinElevation] = useState('');
  const [selectedSatelliteIds, setSelectedSatelliteIds] = useState<Set<string>>(new Set());

  const columns = useMemo((): DataTableColumn<SatellitePassRow>[] => {
    return [
      {
        key: 'satellite',
        header: 'Satellite',
        sortable: true,
        sortValue: (row) => row.satelliteName,
        render: (row) => row.satelliteName,
      },
      {
        key: 'aos',
        header: 'AOS',
        sortable: true,
        sortValue: (row) => row.aosAt,
        render: (row) => <DateTimeCell iso={row.aosAt} />,
      },
      {
        key: 'los',
        header: 'LOS',
        sortable: true,
        sortValue: (row) => row.losAt,
        render: (row) => <DateTimeCell iso={row.losAt} />,
      },
      {
        key: 'duration',
        header: 'Duration',
        sortable: true,
        sortValue: (row) => row.durationSec,
        render: (row) => formatDurationSec(row.durationSec),
      },
      {
        key: 'maxElevation',
        header: 'Max elevation',
        sortable: true,
        sortValue: (row) => row.maxElevationDeg,
        render: (row) => `${row.maxElevationDeg.toFixed(1)}°`,
      },
    ];
  }, []);

  const satelliteOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const pass of passes) {
      if (!byId.has(pass.satelliteId)) byId.set(pass.satelliteId, pass.satelliteName);
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [passes]);

  const minElevationValue = Number.parseFloat(minElevation);
  const filtered = useMemo(() => {
    return passes.filter((pass) => {
      if (!Number.isNaN(minElevationValue) && pass.maxElevationDeg < minElevationValue) {
        return false;
      }
      if (selectedSatelliteIds.size > 0 && !selectedSatelliteIds.has(pass.satelliteId)) {
        return false;
      }
      return true;
    });
  }, [passes, minElevationValue, selectedSatelliteIds]);

  const hasActiveFilter = !Number.isNaN(minElevationValue) || selectedSatelliteIds.size > 0;

  return (
    <div className={classes.wrapper}>
      <div className={classes.filters}>
        <TextInput
          label="Min elevation (°)"
          type="number"
          placeholder="0"
          value={minElevation}
          onChange={(event) => setMinElevation(event.target.value)}
        />
        <SatelliteFilter
          options={satelliteOptions}
          selectedIds={selectedSatelliteIds}
          onChange={setSelectedSatelliteIds}
        />
      </div>
      {error ? <p className={classes.error}>{error}</p> : null}
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(row) => `${row.satelliteId}:${row.aosAt}`}
        totalRowCount={passes.length}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={onSelectPass}
        emptyMessage={
          loading
            ? 'Computing passes…'
            : 'No upcoming passes in the next 72 hours for your enabled satellites.'
        }
        filteredEmptyMessage={
          hasActiveFilter ? 'No passes match the current filters.' : 'No passes to show.'
        }
      />
    </div>
  );
}
