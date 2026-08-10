import { createContext, useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '../../components/v2/index.ts';
import { formatNextPassCountdown, isPassActive, nextPassBySatelliteId } from './passTime.ts';
import type { SatellitePassRow } from './useTrackingPasses.ts';
import { useNowTick } from './useNowTick.ts';
import { colorForNoradId } from '@core/domain/satelliteTracking/satelliteColor.ts';
import classes from './PassGrid.module.css';

const PassGridTickContext = createContext(0);

function usePassGridTick(): number {
  return useContext(PassGridTickContext);
}

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

function SatelliteNameCell({
  row,
  showCountdown,
}: {
  row: SatellitePassRow;
  showCountdown: boolean;
}) {
  const nowMs = usePassGridTick();
  const countdown = showCountdown ? formatNextPassCountdown(nowMs, row.aosAt, row.losAt) : null;

  return (
    <div className={classes.satelliteCell}>
      <div className={classes.satelliteHeader}>
        <span
          className={classes.colorSwatch}
          style={{ backgroundColor: colorForNoradId(row.noradId) }}
          aria-hidden
        />
        {/* Real <Link>, not a button+navigate() — a row-level onClick still activates the row
            (see DataTable's `onActivate`), so ctrl/middle/right-click "open in new tab" only
            works here if this is a genuine anchor; stopPropagation keeps a plain click from
            also firing the row's onSelectPass. */}
        <Link
          to={`/tracking/satellites/${row.satelliteId}`}
          className={classes.satelliteLink}
          onClick={(e) => e.stopPropagation()}
        >
          {row.satelliteName}
        </Link>
      </div>
      {countdown ? <span className={classes.countdown}>{countdown}</span> : null}
    </div>
  );
}

export interface PassGridProps {
  passes: SatellitePassRow[];
  /** Unfiltered pass list for per-satellite next-pass countdown (defaults to `passes`). */
  allPasses?: SatellitePassRow[];
  /** Unfiltered pass count for the "Showing X of Y" label when filters are active. */
  totalRowCount?: number;
  loading: boolean;
  error: string | null;
  onSelectPass?: (row: SatellitePassRow) => void;
  /** Look-ahead window used only for the empty-state copy, e.g. "12 hours". */
  windowLabel: string;
  /** When true, show the filtered-empty message instead of the global empty message. */
  hasActiveFilter?: boolean;
}

export default function PassGrid({
  passes,
  allPasses,
  totalRowCount,
  loading,
  error,
  onSelectPass,
  windowLabel,
  hasActiveFilter = false,
}: PassGridProps) {
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'aos', direction: 'asc' });
  const nowMs = useNowTick();

  const nextPassMap = useMemo(
    () => nextPassBySatelliteId(allPasses ?? passes),
    [allPasses, passes],
  );

  const columns = useMemo((): DataTableColumn<SatellitePassRow>[] => {
    return [
      {
        key: 'satellite',
        header: 'Satellite',
        sortable: true,
        sortValue: (row) => row.satelliteName,
        render: (row) => {
          const next = nextPassMap.get(row.satelliteId);
          const isNextForSat = next?.aosAt === row.aosAt;
          return <SatelliteNameCell row={row} showCountdown={isNextForSat} />;
        },
      },
      {
        key: 'tx',
        header: 'TX',
        sortable: true,
        sortValue: (row) => row.txSortHz ?? -1,
        render: (row) => row.txDisplay,
      },
      {
        key: 'rx',
        header: 'RX',
        sortable: true,
        sortValue: (row) => row.rxSortHz ?? -1,
        render: (row) => row.rxDisplay,
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
  }, [nextPassMap]);

  const displayTotal = totalRowCount ?? passes.length;

  return (
    <PassGridTickContext.Provider value={nowMs}>
      <div className={classes.wrapper}>
        {error ? <p className={classes.error}>{error}</p> : null}
        <DataTable
          columns={columns}
          rows={passes}
          getRowId={(row) => `${row.satelliteId}:${row.aosAt}`}
          totalRowCount={displayTotal}
          sort={sort}
          onSortChange={setSort}
          onRowActivate={onSelectPass}
          scale="extreme"
          virtualize="auto"
          estimatedRowHeight={52}
          getRowVariant={(row) =>
            isPassActive(nowMs, row.aosAt, row.losAt) ? 'active' : undefined
          }
          emptyMessage={
            loading
              ? 'Computing passes…'
              : `No upcoming passes in the next ${windowLabel} for your enabled satellites.`
          }
          filteredEmptyMessage={
            hasActiveFilter ? 'No passes match the current filters.' : 'No passes to show.'
          }
        />
      </div>
    </PassGridTickContext.Provider>
  );
}
