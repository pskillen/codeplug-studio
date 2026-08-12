import { Badge, Code, Text } from '@mantine/core';
import { useMemo } from 'react';
import { DataTable, DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { createNameColumn } from '@app/lib/libraryListTable.tsx';
import {
  formatByteSize,
  listStorageKeys,
  storageKeyViewerPath,
  type StorageKeyRow,
} from '@integrations/debug/index.ts';

export default function DebugLocalStoragePage() {
  const rows = useMemo(() => listStorageKeys(), []);

  const columns = useMemo(
    () => [
      createNameColumn<StorageKeyRow>({
        header: 'Label',
        getName: (row) => row.label,
        getPath: (row) => storageKeyViewerPath(row.key),
      }),
      {
        key: 'key',
        header: 'Key',
        render: (row: StorageKeyRow) => <Code style={{ whiteSpace: 'nowrap' }}>{row.key}</Code>,
      },
      {
        key: 'size',
        header: 'Size',
        sortable: true,
        sortValue: (row: StorageKeyRow) => row.byteSize,
        render: (row: StorageKeyRow) => formatByteSize(row.byteSize),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row: StorageKeyRow) => (
          <Badge color={row.present ? 'green' : 'gray'} variant="light">
            {row.present ? 'Set' : 'Not set'}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <Page>
      <PageHeader
        title="LocalStorage"
        description="Keys used by Codeplug Studio in this browser."
      />
      <DesignSystemV2Provider>
        <DataTable<StorageKeyRow>
          rows={rows}
          getRowId={(row) => row.key}
          columns={columns}
          caption={
            <Text size="sm" c="dimmed">
              Select a label to open the JSON tree viewer for that key. Sensitive tokens are masked.
            </Text>
          }
        />
      </DesignSystemV2Provider>
    </Page>
  );
}
