import { useState } from 'react';
import { Button, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { importProjectFromYaml } from '../../services/projectImportExportService.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal from './DriveBrowserModal.tsx';
import YamlFileDropzone from './YamlFileDropzone.tsx';

export default function ImportProjectYamlPanel() {
  const { refreshProjects, switchProject } = useProjects();
  const { connected, isConfigured } = useGoogleDrive();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  async function handleFile(text: string) {
    setImporting(true);
    setError(null);
    try {
      const result = await importProjectFromYaml(text, { kind: 'createNew' });
      await refreshProjects();
      switchProject(result.projectId);
      navigate('/summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stack gap="sm">
      <YamlFileDropzone onFileText={handleFile} disabled={importing} error={error} />
      {isConfigured ? (
        <Button
          variant="light"
          disabled={!connected || importing}
          onClick={() => setDriveOpen(true)}
        >
          Open from Drive
        </Button>
      ) : null}
      <DriveBrowserModal
        opened={driveOpen}
        onClose={() => setDriveOpen(false)}
        mode="open"
        onSelectFile={({ content }) => {
          setDriveOpen(false);
          void handleFile(content);
        }}
        onSaveTarget={() => undefined}
      />
    </Stack>
  );
}
