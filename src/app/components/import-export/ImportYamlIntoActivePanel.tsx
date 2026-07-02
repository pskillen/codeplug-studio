import { useState } from 'react';
import { Alert, Button, Modal, Stack, Text } from '@mantine/core';
import { importProjectFromYaml } from '../../services/projectImportExportService.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal from './DriveBrowserModal.tsx';
import YamlFileDropzone from './YamlFileDropzone.tsx';

export default function ImportYamlIntoActivePanel() {
  const { activeProjectId, activeProject, refreshProjects } = useProjects();
  const { connected, isConfigured } = useGoogleDrive();
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);

  async function handleFile(text: string) {
    setError(null);
    setPendingText(text);
    setConfirmOpen(true);
  }

  async function confirmReplace() {
    if (!pendingText || !activeProjectId) return;
    setImporting(true);
    setError(null);
    try {
      await importProjectFromYaml(pendingText, {
        kind: 'replaceExisting',
        projectId: activeProjectId,
      });
      await refreshProjects();
      setConfirmOpen(false);
      setPendingText(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmOpen(false);
    } finally {
      setImporting(false);
    }
  }

  if (!activeProjectId || !activeProject) {
    return <Alert color="gray">Select a project before replacing from YAML.</Alert>;
  }

  return (
    <Stack gap="sm">
      <YamlFileDropzone onFileText={handleFile} disabled={importing} />
      {isConfigured ? (
        <Button
          variant="light"
          disabled={!connected || importing}
          onClick={() => setDriveOpen(true)}
        >
          Open from Drive
        </Button>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
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
      <Modal
        opened={confirmOpen}
        onClose={() => {
          if (!importing) {
            setConfirmOpen(false);
            setPendingText(null);
          }
        }}
        title="Replace active project?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This will permanently replace <strong>{activeProject.name}</strong> with the imported
            YAML. Library rows and format builds not in the file will be removed.
          </Text>
          <Button color="red" loading={importing} onClick={() => void confirmReplace()}>
            Replace project
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
