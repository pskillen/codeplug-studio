import { useMemo, useState, type ReactNode } from 'react';
import {
  DataTable,
  DesignSystemV2Provider,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import classes from './MemoryCategoryPanel.module.css';

/** Lines shown before the rest of the caveat fold behind **More**. */
export const MEMORY_CAVEAT_VISIBLE_LINES = 2;

/**
 * One identity text for a channel: callsign first, then name; the name alone when there is no
 * callsign (a radio that stores one name field). Empty parts are dropped, never shown as labels.
 */
export function identityLabel(callsign: string | undefined, name: string | undefined): string {
  const c = callsign?.trim();
  const n = name?.trim();
  if (c && n) return `${c} · ${n}`;
  return c || n || '';
}

export interface MemoryCategoryPanelProps<T> {
  /** The count sentence above the table. */
  summary: ReactNode;
  /** Dimmed explanation lines; after two, the rest fold behind **More**. */
  caveat?: readonly string[];
  /** Placeholder of the search box (also its accessible name). */
  searchPlaceholder: string;
  /** Accessible table caption. */
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** The text a search matches for a row (include callsign, name, slot and frequencies). */
  searchText: (row: T) => string;
  /** Initial sort; omit for source order. */
  defaultSort?: DataTableSortState;
  /** Region below the table for the clicked row; omit for rows that are not clickable. */
  details?: (row: T) => ReactNode;
  /** Narrow-viewport identity line, see `DataTable.mobileIdentity`. */
  mobileIdentity?: (row: T) => ReactNode;
  mobileIdentityLabel?: ReactNode;
  stickyFirstColumn?: boolean;
  emptyMessage?: ReactNode;
}

/**
 * One Memory category in the DM-32 shape: count sentence, dimmed caveat, search, sortable v2
 * `DataTable`, and an optional details region for the clicked row. Radio-neutral: every sentence
 * and column comes from the caller.
 */
export default function MemoryCategoryPanel<T>({
  summary,
  caveat,
  searchPlaceholder,
  caption,
  columns,
  rows,
  getRowId,
  searchText,
  defaultSort,
  details,
  mobileIdentity,
  mobileIdentityLabel,
  stickyFirstColumn,
  emptyMessage,
}: MemoryCategoryPanelProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>(defaultSort ?? null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = query.trim().toLocaleLowerCase();
  const shown = useMemo(
    () => (q ? rows.filter((r) => searchText(r).toLocaleLowerCase().includes(q)) : rows),
    [rows, q, searchText],
  );
  const selected = selectedId === null ? undefined : shown.find((r) => getRowId(r) === selectedId);
  const folds = (caveat?.length ?? 0) > MEMORY_CAVEAT_VISIBLE_LINES;
  const lines = caveat
    ? folds && !open
      ? caveat.slice(0, MEMORY_CAVEAT_VISIBLE_LINES)
      : caveat
    : [];
  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <p className={classes.summary}>{summary}</p>
        {caveat && caveat.length > 0 ? (
          <div className={classes.caveat}>
            {lines.map((line, i) => (
              <p key={i} className={classes.caveatLine}>
                {line}
              </p>
            ))}
            {folds ? (
              <button
                type="button"
                className={classes.more}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? 'Less' : 'More'}
              </button>
            ) : null}
          </div>
        ) : null}
        <DataTable
          caption={caption}
          columns={columns}
          rows={shown}
          getRowId={getRowId}
          totalRowCount={rows.length}
          search={{ value: query, onChange: setQuery, placeholder: searchPlaceholder }}
          sort={sort}
          onSortChange={setSort}
          stickyFirstColumn={stickyFirstColumn}
          mobileIdentity={mobileIdentity}
          mobileIdentityLabel={mobileIdentityLabel}
          emptyMessage={emptyMessage}
          filteredEmptyMessage={`No rows match “${query.trim()}”.`}
          onRowActivate={
            details
              ? (row) => {
                  const id = getRowId(row);
                  setSelectedId((cur) => (cur === id ? null : id));
                }
              : undefined
          }
        />
        {details && selected !== undefined ? (
          <div className={classes.details} data-testid="memory-row-details">
            {details(selected)}
          </div>
        ) : null}
      </div>
    </DesignSystemV2Provider>
  );
}
