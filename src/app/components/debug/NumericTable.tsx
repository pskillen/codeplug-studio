import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import {
  NOT_CAPTURED_TEXT,
  formatDelta,
  formatNumber,
  type NumericTableView,
} from '@integrations/radio-io/debugView';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './DebugTable.module.css';

export interface NumericTableProps {
  table: NumericTableView;
  /** The same table from a second read; columns pair by id, rows by index. */
  overlay?: NumericTableView;
  /** Label for the read's values when overlaid. */
  readLabel?: string;
  /** Label for the overlay's values. */
  overlayLabel?: string;
  /** Open on first render (the table is built only while open). */
  defaultOpen?: boolean;
  /** Fold label. Default "Numeric table". */
  label?: string;
}

type Column = NumericTableView['columns'][number];

function cellText(column: Column, index: number): string {
  const v = column.values[index];
  return v === undefined
    ? NOT_CAPTURED_TEXT
    : formatNumber(v, column.format ?? 'hex-dec', column.width);
}

function NumericBody({ table, overlay, readLabel, overlayLabel }: NumericTableProps) {
  return (
    <div className={classes.scroll}>
      <table className={classes.table} aria-label="Numeric table">
        <thead>
          <tr>
            <th scope="col">{table.key.label}</th>
            {table.columns.map((c) => (
              <th key={c.id} scope="col">
                {c.label}
                {overlay && readLabel ? <span className={classes.dim}>{readLabel}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={`${row.key}-${i}`}>
              <th scope="row" className={`${classes.mono} ${classes.num}`}>
                {row.key}
                {row.mark === 'reference' ? <span className={classes.dim}>(ref)</span> : null}
              </th>
              {table.columns.map((c) => {
                const v = c.values[i];
                const refIndex = c.deltaFromRow;
                const ref = refIndex === undefined ? undefined : c.values[refIndex];
                const showRef = refIndex !== undefined && refIndex !== i;
                const o = overlay?.columns.find((oc) => oc.id === c.id);
                const ov = o?.values[i];
                return (
                  <td key={c.id} className={`${classes.mono} ${classes.num}`}>
                    {cellText(c, i)}
                    {showRef && v !== undefined && ref !== undefined ? (
                      <span className={classes.dim}>Δref {formatDelta(v - ref)}</span>
                    ) : null}
                    {overlay ? (
                      <span
                        className={ov !== v ? `${classes.dim} ${classes.changed}` : classes.dim}
                      >
                        {overlayLabel ? `${overlayLabel}: ` : ''}
                        {o ? cellText(o, i) : NOT_CAPTURED_TEXT}
                        {v !== undefined && ov !== undefined && ov !== v
                          ? ` · Δread ${formatDelta(ov - v)}`
                          : ''}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The numbers behind a chart, in a striped table that is built only while its fold is open.
 * Cells follow each column's number format; radio-neutral.
 */
export default function NumericTable(props: NumericTableProps) {
  const { defaultOpen = false, label = 'Numeric table' } = props;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        className={classes.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <IconChevronDown
          size={ICON_SIZE_NAV}
          stroke={ICON_STROKE}
          aria-hidden
          style={{ transform: open ? undefined : 'rotate(-90deg)' }}
        />
      </button>
      {open ? <NumericBody {...props} /> : null}
    </div>
  );
}
