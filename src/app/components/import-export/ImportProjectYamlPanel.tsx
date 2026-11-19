import { useState } from 'react';
import { Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useYamlImportResolver } from '../../hooks/useYamlImportResolver.ts';
import StatusBanner from '../v2/StatusBanner.tsx';
import DriveBrowserModal from './DriveBrowserModal.tsx';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';
import InterchangeOverwriteModal from './InterchangeOverwriteModal.tsx';
import ProjectYamlFileDropzone from './ProjectYamlFileDropzone.tsx';

export interface ImportProjectYamlPanelProps {
  /** Controlled Drive browser state, so a page can open it from elsewhere (landing path cards). */
  driveOpen?: boolean;
  onDriveOpenChange?: (open: boolean) => void;
}

export default function ImportProjectYamlPanel({
  driveOpen: driveOpenProp,
  onDriveOpenChange,
}: ImportProjectYamlPanelProps = {}) {
  const navigate = useNavigate();
  const [driveOpenState, setDriveOpenState] = useState(false);
  const driveOpen = driveOpenProp ?? driveOpenState;
  const setDriveOpen = (open: boolean) => {
    setDriveOpenState(open);
    onDriveOpenChange?.(open);
  };
  const resolver = useYamlImportResolver({
    onImported: () => navigate('/summary'),
  });

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
        projectName={resolver.projectName}
        diff={resolver.diff}
        source={resolver.overwriteSource}
        localProjectId={resolver.localProjectId}
        remoteProjectId={resolver.remoteProjectId}
        loading={resolver.importing}
        error={resolver.error}
        onClose={() => resolver.resetOverwrite()}
        onConfirm={() => void resolver.confirmOverwrite()}
      />
    </Stack>
  );
}
