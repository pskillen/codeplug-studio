import { Badge, Loader, ScrollArea, Stack, Table, Tabs, Text } from '@mantine/core';
import type { CsvTable } from '@core/import-export/csvParse.ts';

export interface CpsCsvPreviewProps {
  fileNames: readonly string[];
  tablesByFile: Record<string, CsvTable>;
  loading?: boolean;
  error?: string | null;
}

function CsvFileTable({ table }: { table: CsvTable }) {
  if (table.headers.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Empty file.
      </Text>
    );
  }

  return (
    <ScrollArea.Autosize mah="60vh" type="auto" offsetScrollbars>
      <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
        <Table.Thead>
          <Table.Tr>
            {table.headers.map((header) => (
              <Table.Th key={header}>{header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {table.rows.map((row, rowIndex) => (
            <Table.Tr key={rowIndex}>
              {table.headers.map((header, columnIndex) => (
                <Table.Td key={`${header}-${columnIndex}`}>{row[columnIndex] ?? ''}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  );
}

export default function CpsCsvPreview({
  fileNames,
  tablesByFile,
  loading = false,
  error = null,
}: CpsCsvPreviewProps) {
  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Generating export preview…
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Text size="sm" c="red">
        {error}
      </Text>
    );
  }

  if (fileNames.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No export files available for this format.
      </Text>
    );
  }

  const defaultTab = fileNames[0] ?? '';

  return (
    <Tabs defaultValue={defaultTab} keepMounted={false}>
      <Tabs.List>
        {fileNames.map((fileName) => {
          const rowCount = tablesByFile[fileName]?.rows.length ?? 0;
          return (
            <Tabs.Tab key={fileName} value={fileName}>
              {fileName}
              <Badge ml={6} size="xs" variant="light">
                {rowCount}
              </Badge>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      {fileNames.map((fileName) => (
        <Tabs.Panel key={fileName} value={fileName} pt="md">
          <CsvFileTable table={tablesByFile[fileName] ?? { headers: [], rows: [] }} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
