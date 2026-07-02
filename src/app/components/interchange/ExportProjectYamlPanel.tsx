import { useState } from 'react';
import { Alert, Button, Stack, TextInput } from '@mantine/core';
import {
  defaultLocalExportFileName,
  suggestExportDestination,
} from '@core/services/interchangeMeta.ts';
import { downloadBlob } from '../../lib/downloadBlob.ts';
import { exportProjectToYaml } from '../../services/projectInterchangeService.ts';
import { useProjects } from '../../state/useProjects.ts';

export default function ExportProjectYamlPanel() {
  const { activeProjectId, activeProject, refreshProjects } = useProjects();
  const suggestedFileName = activeProject
    ? (suggestExportDestination(activeProject, 'localFile')?.fileName ??
      defaultLocalExportFileName(activeProject.name))
    : '';
  const [fileName, setFileName] = useState(suggestedFileName);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!activeProjectId) return;
    setError(null);
    setExporting(true);
    try {
      const result = await exportProjectToYaml(activeProjectId, {
        fileName,
        recordDestination: 'localFile',
      });
      downloadBlob(
        new Blob([result.content], { type: 'application/yaml;charset=utf-8' }),
        result.fileName,
      );
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  if (!activeProjectId) {
    return <Alert color="gray">Select a project to export.</Alert>;
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Download filename"
        value={fileName}
        onChange={(event) => setFileName(event.currentTarget.value)}
      />
      {error ? <Alert color="red">{error}</Alert> : null}
      <Button onClick={() => void handleExport()} loading={exporting}>
        Download YAML
      </Button>
    </Stack>
  );
}
