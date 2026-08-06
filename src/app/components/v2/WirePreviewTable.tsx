import type { ReactNode } from 'react';
import classes from './WirePreviewTable.module.css';

export interface WirePreviewTableColumn<T> {
  key: string;
  label: ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
  /** Muted/secondary text styling for this cell. */
  dim?: boolean;
}

export interface WirePreviewTableProps<T> {
  title?: ReactNode;
  columns: WirePreviewTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Highlights a row and shows the "Overridden rows highlighted" header pill when any row matches. */
  isRowChanged?: (row: T) => boolean;
  caption?: ReactNode;
}

/**
 * Read-only, monospace preview table for build wire output — **stub only**
 * this PR (static fixture props, no sort/select/actions). Full data wiring
 * to real build/wire-preview types lands in the builds ticket (#924). Visual
 * shape referenced from `builds/wirePreview/WirePreviewDataTable.tsx` — not
 * imported from it.
 */
export default function WirePreviewTable<T>({
  title,
  columns,
  rows,
  getRowId,
  isRowChanged,
  caption,
}: WirePreviewTableProps<T>) {
  const hasChangedRows = !!isRowChanged && rows.some(isRowChanged);
  const gridTemplateColumns = columns.map((col) => col.width ?? '1fr').join(' ');

  return (
    <div className={classes.root}>
      {title || hasChangedRows ? (
        <div className={classes.header}>
          {title ? <span className={classes.title}>{title}</span> : null}
          {hasChangedRows ? (
            <span className={classes.overriddenPill}>Overridden rows highlighted</span>
          ) : null}
        </div>
      ) : null}
      <div className={classes.table} role="table">
        <div className={classes.headerRow} role="row" style={{ gridTemplateColumns }}>
          {columns.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              className={[classes.headerCell, col.align === 'right' ? classes.alignRight : '']
                .filter(Boolean)
                .join(' ')}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className={classes.body}>
          {rows.map((row) => {
            const changed = isRowChanged?.(row) ?? false;
            return (
              <div
                key={getRowId(row)}
                role="row"
                className={[classes.dataRow, changed ? classes.rowChanged : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{ gridTemplateColumns }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    role="cell"
                    className={[
                      classes.dataCell,
                      col.align === 'right' ? classes.alignRight : '',
                      col.dim ? classes.dim : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render(row)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {caption ? <div className={classes.caption}>{caption}</div> : null}
    </div>
  );
}
