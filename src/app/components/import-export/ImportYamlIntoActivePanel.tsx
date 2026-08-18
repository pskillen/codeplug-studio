import { useState } from 'react';
import { Alert, Stack } from '@mantine/core';
import { useYamlImportResolver } from '../../hooks/useYamlImportResolver.ts';
import { useProjects } from '../../state/useProjects.ts';
import StatusBanner from '../v2/StatusBanner.tsx';
import DriveBrowserModal from './DriveBrowserModal.tsx';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';
import InterchangeOverwriteModal from './InterchangeOverwriteModal.tsx';
import ProjectYamlFileDropzone from './ProjectYamlFileDropzone.tsx';

export default function ImportYamlIntoActivePanel() {
  const { activeProjectId, activeProject } = useProjects();
  const [driveOpen, setDriveOpen] = useState(false);
  const resolver = useYamlImportResolver({ activeProjectId });

  if (!activeProjectId || !activeProject) {
    return <Alert color="gray">Select a project before replacing from YAML.</Alert>;
  }

  return (
    <Stack gap="sm">
      {resolver.error && !resolver.overwriteOpen ? (
        <StatusBanner tone="warning">Import failed: {resolver.error}</StatusBanner>
      ) : null}
      <ProjectYamlFileDropzone
        onFileText={(text, fileName) => resolver.handleLocalFile(fileName, text)}
        disabled={resolver.importing}
        error={null}
      />
      <GoogleDriveActionButton disabled={resolver.importing} onClick={() => setDriveOpen(true)}>
        Open from Drive
      </GoogleDriveActionButton>
      <DriveBrowserModal
        opened={driveOpen}
        onClose={() => setDriveOpen(false)}
        mode="open"
        onSelectFile={(selection) => {
          setDriveOpen(false);
          resolver.handleDriveSelection(selection);
        }}
        onSaveTarget={() => undefined}
      />
      <InterchangeOverwriteModal
        opened={resolver.overwriteOpen}
        title={resolver.overwriteTitle}
        projectName={resolver.projectName || activeProject.name}
        diff={resolver.diff}
        loading={resolver.importing}
        error={resolver.error}
        idMismatch={resolver.idMismatch}
        localProjectId={resolver.localProjectId}
        remoteProjectId={resolver.remoteProjectId}
        onClose={() => resolver.resetOverwrite()}
        onConfirm={() => void resolver.confirmOverwrite()}
        onImportAsNew={resolver.idMismatch ? () => void resolver.confirmImportAsNew() : undefined}
      />
    </Stack>
  );
}
