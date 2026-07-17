import { useMemo, useState } from 'react';
import {
  Badge,
  Code,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import type { CsvTable } from '@core/import-export/csvParse.ts';
import { isCsvPreviewFileName } from '../../hooks/useBuildCpsExportPreview.ts';
import { projectCsvTableRows, type CsvPreviewSortState } from './csvPreviewTable.ts';

export interface CpsCsvPreviewProps {
  fileNames: readonly string[];
  tablesByFile: Record<string, CsvTable>;
  /** Non-CSV export files (e.g. APRS.md) shown as raw text. */
  textByFile?: Record<string, string>;
  loading?: boolean;
  error?: string | null;
}

function nextCsvSortState(
  current: CsvPreviewSortState | null,
  columnIndex: number,
): CsvPreviewSortState {
  if (current?.columnIndex === columnIndex) {
    return { columnIndex, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { columnIndex, direction: 'asc' };
}

function CsvSortableHeader({
  label,
  columnIndex,
  sort,
  onSort,
}: {
  label: string;
  columnIndex: number;
  sort: CsvPreviewSortState | null;
  onSort: (columnIndex: number) => void;
}) {
  const active = sort?.columnIndex === columnIndex;
  const Icon = active ? (sort.direction === 'asc' ? IconChevronUp : IconChevronDown) : IconSelector;

  return (
    <UnstyledButton
      onClick={() => onSort(columnIndex)}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
    >
      <span>{label}</span>
      <Icon size={14} stroke={1.5} opacity={active ? 1 : 0.45} aria-hidden />
    </UnstyledButton>
  );
}

function CsvFileTable({ table }: { table: CsvTable }) {
  const [filters, setFilters] = useState<string[]>(() => table.headers.map(() => ''));
  const [sort, setSort] = useState<CsvPreviewSortState | null>(null);

  const displayRows = useMemo(
    () => projectCsvTableRows(table.rows, filters, sort),
    [table.rows, filters, sort],
  );

  const hasActiveFilters = filters.some((filter) => filter.trim().length > 0);

  if (table.headers.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Empty file.
      </Text>
    );
  }

  const setFilter = (columnIndex: number, value: string) => {
    setFilters((current) =>
      current.map((filter, index) => (index === columnIndex ? value : filter)),
    );
  };

  return (
    <Stack gap="xs">
      {hasActiveFilters || sort ? (
        <Text size="xs" c="dimmed">
          Showing {displayRows.length} of {table.rows.length} row
          {table.rows.length === 1 ? '' : 's'}
        </Text>
      ) : null}
      <ScrollArea.Autosize mah="60vh" type="auto" offsetScrollbars>
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              {table.headers.map((header, columnIndex) => (
                <Table.Th key={`header-${columnIndex}`}>
                  <CsvSortableHeader
                    label={header}
                    columnIndex={columnIndex}
                    sort={sort}
                    onSort={(index) => setSort((current) => nextCsvSortState(current, index))}
                  />
                </Table.Th>
              ))}
            </Table.Tr>
            <Table.Tr>
              {table.headers.map((header, columnIndex) => (
                <Table.Th key={`filter-${columnIndex}`} p={4} style={{ minWidth: '6rem' }}>
                  <TextInput
                    size="xs"
                    placeholder="Filter"
                    value={filters[columnIndex] ?? ''}
                    onChange={(event) => setFilter(columnIndex, event.currentTarget.value)}
                    aria-label={`Filter ${header}`}
                  />
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {displayRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={table.headers.length}>
                  <Text size="sm" c="dimmed">
                    {hasActiveFilters ? 'No rows match the current filters.' : 'No data rows.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              displayRows.map((row, rowIndex) => (
                <Table.Tr key={rowIndex}>
                  {table.headers.map((header, columnIndex) => (
                    <Table.Td key={`${header}-${columnIndex}`}>{row[columnIndex] ?? ''}</Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
    </Stack>
  );
}

export default function CpsCsvPreview({
  fileNames,
  tablesByFile,
  textByFile = {},
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
          const isCsv = isCsvPreviewFileName(fileName);
          const rowCount = isCsv ? (tablesByFile[fileName]?.rows.length ?? 0) : null;
          return (
            <Tabs.Tab key={fileName} value={fileName}>
              <Group gap={6} wrap="nowrap">
                {fileName}
                {rowCount != null ? (
                  <Badge size="xs" variant="light">
                    {rowCount}
                  </Badge>
                ) : (
                  <Badge size="xs" variant="outline">
                    text
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      {fileNames.map((fileName) => (
        <Tabs.Panel key={fileName} value={fileName} pt="md">
          {isCsvPreviewFileName(fileName) ? (
            <CsvFileTable table={tablesByFile[fileName] ?? { headers: [], rows: [] }} />
          ) : (
            <ScrollArea.Autosize mah="60vh" type="auto" offsetScrollbars>
              <Code block style={{ whiteSpace: 'pre-wrap' }}>
                {textByFile[fileName] ?? ''}
              </Code>
            </ScrollArea.Autosize>
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
