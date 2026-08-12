import { useRef, useState } from 'react';
import { Group } from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import type { DirectoryInterchangeFormat } from '@integrations/persistence/digitalIdDirectoryInterchange.ts';
import { downloadTextFile } from '@integrations/download/browserDownload.ts';
import {
  exportDirectoryInterchangeContent,
  importDirectoryInterchangeContent,
} from '../../services/digitalIdDirectoryInterchangeService.ts';
import { persistence } from '../../state/persistence.ts';
import { Button, SegmentedControl, StatusBanner } from '../v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';

type DigitalIdDirectoryInterchangeToolbarProps = {
  projectId: string | null;
  onImported?: () => void;
};

const FORMAT_OPTIONS = [
  { value: 'yaml', label: 'YAML' },
  { value: 'csv', label: 'CSV' },
] as const;

export default function DigitalIdDirectoryInterchangeToolbar({
  projectId,
  onImported,
}: DigitalIdDirectoryInterchangeToolbarProps) {
  const [format, setFormat] = useState<DirectoryInterchangeFormat>('yaml');
  const [busy, setBusy] = useState<'download' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = !projectId || busy !== null;

  async function handleDownloadDirectory() {
    if (!projectId) return;
    setError(null);
    setBusy('download');
    try {
      const result = await exportDirectoryInterchangeContent(persistence, projectId, format);
      const mimeType =
        format === 'yaml' ? 'application/yaml;charset=utf-8' : 'text/csv;charset=utf-8';
      downloadTextFile(result.content, result.fileName, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Directory download failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleImportFile(file: File) {
    if (!projectId) return;
    setError(null);
    setBusy('import');
    try {
      const text = await file.text();
      const inferredFormat = inferDirectoryFormat(file.name, format);
      await importDirectoryInterchangeContent(persistence, projectId, text, inferredFormat);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Directory import failed');
    } finally {
      setBusy(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <>
      {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      <Group gap="sm" wrap="wrap" align="center" style={{ marginBottom: 12 }}>
        <SegmentedControl
          value={format}
          onChange={(value) => setFormat(value as DirectoryInterchangeFormat)}
          options={[...FORMAT_OPTIONS]}
          size="sm"
          disabled={isDisabled}
        />
        <Button
          variant="secondary"
          size="sm"
          leftSection={<IconDownload size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          disabled={isDisabled}
          loading={busy === 'download'}
          onClick={() => void handleDownloadDirectory()}
        >
          Download directory
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftSection={<IconUpload size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          disabled={isDisabled}
          loading={busy === 'import'}
          onClick={() => fileInputRef.current?.click()}
        >
          Import directory
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,.csv,text/yaml,text/csv"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleImportFile(file);
          }}
        />
      </Group>
    </>
  );
}

function inferDirectoryFormat(
  fileName: string,
  selectedFormat: DirectoryInterchangeFormat,
): DirectoryInterchangeFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  return selectedFormat;
}
