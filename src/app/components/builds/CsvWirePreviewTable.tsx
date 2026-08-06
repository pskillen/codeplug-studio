import type { CsvTable } from '@core/import-export/csvParse.ts';
import WirePreviewTable, { type WirePreviewTableColumn } from '../v2/WirePreviewTable.tsx';

export interface CsvWirePreviewTableProps {
  table: CsvTable;
}

interface CsvPreviewRow {
  id: string;
  cells: string[];
}

/**
 * R2 — monospace CPS dump via v2 WirePreviewTable (read-only).
 */
export default function CsvWirePreviewTable({ table }: CsvWirePreviewTableProps) {
  if (table.headers.length === 0) {
    return <span>No data rows.</span>;
  }

  const rows: CsvPreviewRow[] = table.rows.map((cells, index) => ({
    id: String(index),
    cells,
  }));

  const columns: WirePreviewTableColumn<CsvPreviewRow>[] = table.headers.map(
    (header, columnIndex) => ({
      key: `col-${columnIndex}`,
      label: header,
      width: columnIndex === 0 ? '1.2fr' : '1fr',
      render: (row) => row.cells[columnIndex] ?? '',
    }),
  );

  return (
    <WirePreviewTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      caption={`${rows.length} row${rows.length === 1 ? '' : 's'}`}
    />
  );
}
