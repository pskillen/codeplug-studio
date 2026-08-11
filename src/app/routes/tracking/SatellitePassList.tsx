import { useMemo, useState } from 'react';
import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import {
  DataTable,
  Panel,
  type DataTableColumn,
  type DataTableSortState,
} from '../../components/v2/index.ts';
import {
  formatLocalClockTime,
  formatNextPassCountdown,
  formatUtcClockTime,
  isPassActive,
} from './passTime.ts';
import { useNowTick } from './useNowTick.ts';
import classes from './PassGrid.module.css';

function formatDurationSec(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function DateTimeCell({ iso, countdown }: { iso: string; countdown?: string | null }) {
  const date = new Date(iso);
  const localDate = date.toLocaleDateString(undefined, { dateStyle: 'short' });
  return (
    <div className={classes.dateTimeCell}>
      <span>
        {localDate} {formatLocalClockTime(iso)} local
      </span>
      <span className={classes.utc}>{formatUtcClockTime(iso)} UTC</span>
      {countdown ? <span className={classes.countdown}>{countdown}</span> : null}
    </div>
  );
}

export interface SatellitePassListProps {
  /** Anchor target id, e.g. for NextPassCard's mobile "jump to upcoming passes" link. */
  id?: string;
  title: string;
  passes: PassResult[];
  loading: boolean;
  error: string | null;
  hasObserver: boolean;
  emptyMessage: string;
  /** When set, show a live countdown on the AOS column for the first N passes (by AOS order). */
  countdownRowLimit?: number;
}

/**
 * Single-satellite pass list — the future/past pair on the satellite detail page. Reuses the
 * same `DataTable` row shape as `PassGrid` (the multi-satellite pass grid) minus the satellite
 * name column, since every row here is already scoped to one satellite.
 */
export default function SatellitePassList({
  id,
  title,
  passes,
  loading,
  error,
  hasObserver,
  emptyMessage,
  countdownRowLimit = 0,
}: SatellitePassListProps) {
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'aos', direction: 'asc' });
  const nowMs = useNowTick();

  const countdownAosSet = useMemo(() => {
    if (countdownRowLimit <= 0) return new Set<string>();
    const sorted = [...passes].sort((a, b) => a.aosAt.localeCompare(b.aosAt));
    const set = new Set<string>();
    for (let i = 0; i < Math.min(countdownRowLimit, sorted.length); i++) {
      set.add(sorted[i].aosAt);
    }
    return set;
  }, [passes, countdownRowLimit]);

  const columns = useMemo((): DataTableColumn<PassResult>[] => {
    return [
      {
        key: 'aos',
        header: 'AOS',
        sortable: true,
        sortValue: (row) => row.aosAt,
        render: (row) => {
          const countdown = countdownAosSet.has(row.aosAt)
            ? formatNextPassCountdown(nowMs, row.aosAt, row.losAt)
            : null;
          return <DateTimeCell iso={row.aosAt} countdown={countdown} />;
        },
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
  }, [countdownAosSet, nowMs]);

  return (
    <Panel id={id} title={title}>
      {!hasObserver ? (
        <p className={classes.error}>
          Set an observer location on the Tracking Dashboard to calculate passes.
        </p>
      ) : (
        <>
          {error ? <p className={classes.error}>{error}</p> : null}
          <DataTable
            columns={columns}
            rows={passes}
            getRowId={(row) => `${row.aosAt}:${row.losAt}`}
            totalRowCount={passes.length}
            sort={sort}
            onSortChange={setSort}
            getRowVariant={(row) =>
              isPassActive(nowMs, row.aosAt, row.losAt) ? 'active' : undefined
            }
            emptyMessage={loading ? 'Computing passes…' : emptyMessage}
          />
        </>
      )}
    </Panel>
  );
}
