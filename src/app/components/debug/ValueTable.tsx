import type { ReactNode } from 'react';
import {
  NOT_CAPTURED_TEXT,
  type ValueRow,
  type ValueTableView,
} from '@integrations/radio-io/debugView';
import ConfidenceBadge from './ConfidenceBadge.tsx';
import HexDecValue, { MASKED_TEXT } from './HexDecValue.tsx';
import classes from './DebugTable.module.css';

export interface ValueTableProps {
  table: ValueTableView;
  /** The same table from a second read; rows pair by id, cells by position. */
  overlay?: ValueTableView;
  /** Sensitive cells print `••` until true. The page owns the Show password control. */
  revealed?: boolean;
  /** Overlay column heading. */
  overlayLabel?: string;
}

type Cell = ValueRow['cells'][number];

const rawHex = (raw: Uint8Array) =>
  Array.from(raw, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** Plain text of a cell's value, used to decide whether the overlay differs. */
function valueKey(cell: Cell | undefined, revealed: boolean): string {
  if (!cell || cell.availability === 'not-captured') return NOT_CAPTURED_TEXT;
  if (cell.sensitive && !revealed) return MASKED_TEXT;
  return [cell.decoded, cell.unit, cell.value, cell.raw ? rawHex(cell.raw) : undefined].join('|');
}

function ValueCell({ cell, revealed }: { cell: Cell | undefined; revealed: boolean }): ReactNode {
  if (!cell || cell.availability === 'not-captured') return NOT_CAPTURED_TEXT;
  if (cell.sensitive && !revealed) return <span className={classes.mono}>{MASKED_TEXT}</span>;
  const partial =
    cell.availability === 'partial' ? <span className={classes.dim}>partial</span> : null;
  if (cell.decoded !== undefined) {
    return (
      <>
        {cell.unit ? `${cell.decoded} ${cell.unit}` : cell.decoded}
        {partial}
      </>
    );
  }
  if (cell.value !== undefined) {
    return (
      <>
        <HexDecValue
          value={cell.value}
          width={cell.raw ? (Math.min(Math.max(cell.raw.length, 1), 4) as 1 | 2 | 3 | 4) : 1}
          format={cell.format}
          unit={cell.unit}
        />
        {partial}
      </>
    );
  }
  return <span className={classes.dim}>Raw only</span>;
}

function RawCell({ cell, revealed }: { cell: Cell | undefined; revealed: boolean }): ReactNode {
  if (!cell || cell.availability === 'not-captured') return NOT_CAPTURED_TEXT;
  if (cell.sensitive && !revealed) return MASKED_TEXT;
  // A decoded value the radio home gave no raw bytes for: empty, not "Not captured" (it was).
  return cell.raw ? rawHex(cell.raw) : '';
}

function Confidence({ row }: { row: ValueRow }) {
  if (!row.confidence) return null;
  return (
    <span className={classes.badges}>
      <ConfidenceBadge value={row.confidence.layout} kind="layout" />
      <ConfidenceBadge value={row.confidence.meaning} kind="meaning" />
    </span>
  );
}

function ValueHeads({ overlay, overlayLabel }: { overlay: boolean; overlayLabel: string }) {
  return (
    <>
      <th scope="col">Value</th>
      <th scope="col">Raw</th>
      {overlay ? <th scope="col">{overlayLabel}</th> : null}
    </>
  );
}

function ValueGroup({
  cell,
  otherCell,
  overlay,
  changed,
  revealed,
}: {
  cell: Cell | undefined;
  otherCell: Cell | undefined;
  overlay: boolean;
  changed: boolean;
  revealed: boolean;
}) {
  return (
    <>
      <td>
        <ValueCell cell={cell} revealed={revealed} />
      </td>
      <td className={`${classes.mono} ${classes.num}`}>
        <RawCell cell={cell} revealed={revealed} />
      </td>
      {overlay ? (
        <td className={changed ? classes.changed : undefined} data-changed={changed || undefined}>
          <ValueCell cell={otherCell} revealed={revealed} />
        </td>
      ) : null}
    </>
  );
}

/**
 * Striped table of named values. Single or per-band layout; an optional overlay column marks
 * changed cells amber. Missing values read "Not captured"; sensitive ones `••` until revealed.
 */
export default function ValueTable({
  table,
  overlay,
  revealed = false,
  overlayLabel = 'Overlay',
}: ValueTableProps) {
  const banded = table.layout !== 'single';
  const bands: (string | undefined)[] =
    table.layout === 'single' ? [undefined] : [...table.layout.bands];
  const span = banded ? 2 : 1;
  const overlayRows = new Map(overlay?.rows.map((r) => [r.id, r]));
  return (
    <div className={classes.scroll}>
      <table className={classes.table} aria-label={table.title}>
        <thead>
          <tr>
            <th scope="col" rowSpan={span}>
              Field
            </th>
            {banded ? (
              bands.map((band) => (
                <th
                  key={band}
                  scope="colgroup"
                  colSpan={overlay ? 3 : 2}
                  className={classes.bandHead}
                >
                  {band}
                </th>
              ))
            ) : (
              <ValueHeads overlay={Boolean(overlay)} overlayLabel={overlayLabel} />
            )}
            <th scope="col" rowSpan={span} className={classes.wideOnly}>
              Confidence
            </th>
            <th scope="col" rowSpan={span} className={classes.wideOnly}>
              Source
            </th>
          </tr>
          {banded ? (
            <tr>
              {bands.map((band) => (
                <ValueHeads key={band} overlay={Boolean(overlay)} overlayLabel={overlayLabel} />
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const other = overlayRows.get(row.id);
            return (
              <tr key={row.id}>
                <th scope="row">
                  {row.label}
                  {row.group ? <span className={classes.dim}>{row.group}</span> : null}
                  {row.address ? (
                    <span className={`${classes.dim} ${classes.mono}`}>{row.address}</span>
                  ) : null}
                  {row.note ? <span className={classes.dim}>{row.note}</span> : null}
                  <span className={classes.phoneOnly}>
                    <Confidence row={row} />
                    {row.source ? (
                      <span className={`${classes.dim} ${classes.mono}`}>{row.source}</span>
                    ) : null}
                  </span>
                </th>
                {bands.map((band, b) => {
                  const cell = row.cells[b];
                  const otherCell = other?.cells[b];
                  const changed =
                    overlay !== undefined &&
                    valueKey(cell, revealed) !== valueKey(otherCell, revealed);
                  return (
                    <ValueGroup
                      key={band ?? 'single'}
                      cell={cell}
                      otherCell={otherCell}
                      overlay={Boolean(overlay)}
                      changed={changed}
                      revealed={revealed}
                    />
                  );
                })}
                <td className={classes.wideOnly}>
                  <Confidence row={row} />
                </td>
                <td className={`${classes.wideOnly} ${classes.mono}`}>{row.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
