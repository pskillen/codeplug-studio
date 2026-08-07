import { Badge, Code, Group, Loader, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import type { CsvTable } from '@core/import-export/csvParse.ts';
import { isCsvPreviewFileName } from '../../hooks/useBuildCpsExportPreview.ts';
import CsvWirePreviewTable from './CsvWirePreviewTable.tsx';

export interface CpsCsvPreviewProps {
  fileNames: readonly string[];
  tablesByFile: Record<string, CsvTable>;
  /** Non-CSV export files (e.g. APRS.md) shown as raw text. */
  textByFile?: Record<string, string>;
  loading?: boolean;
  error?: string | null;
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
            <CsvWirePreviewTable table={tablesByFile[fileName] ?? { headers: [], rows: [] }} />
          ) : (
            <ScrollArea.Autosize mah="60vh" type="auto" offsetScrollbars>
              <Code block style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--dsv2-font-mono)' }}>
                {textByFile[fileName] ?? ''}
              </Code>
            </ScrollArea.Autosize>
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
