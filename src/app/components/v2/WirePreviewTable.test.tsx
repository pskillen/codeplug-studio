import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import WirePreviewTable, { type WirePreviewTableColumn } from './WirePreviewTable.tsx';

interface Row {
  id: string;
  name: string;
  wireName: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'GB3DA Stornoway', wireName: 'GB3DA-DMR' },
  { id: '2', name: 'GB3IV Inverness', wireName: 'GB3IV-DMR' },
];

const COLUMNS: WirePreviewTableColumn<Row>[] = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'wireName', label: 'Wire name', render: (row) => row.wireName, dim: true },
];

describe('WirePreviewTable', () => {
  it('renders every row and column', () => {
    render(
      <DesignSystemV2Provider>
        <WirePreviewTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('GB3DA Stornoway')).toBeInTheDocument();
    expect(screen.getByText('GB3IV-DMR')).toBeInTheDocument();
  });

  it('shows the "Overridden rows highlighted" pill only when a row is changed', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <WirePreviewTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          isRowChanged={() => false}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByText('Overridden rows highlighted')).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <WirePreviewTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          isRowChanged={(row) => row.id === '1'}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Overridden rows highlighted')).toBeInTheDocument();
  });
});
