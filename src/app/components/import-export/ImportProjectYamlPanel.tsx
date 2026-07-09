import { useState } from 'react';
import { Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useYamlImportResolver } from '../../hooks/useYamlImportResolver.ts';
import DriveBrowserModal from './DriveBrowserModal.tsx';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';
import InterchangeOverwriteModal from './InterchangeOverwriteModal.tsx';
import YamlFileDropzone from './YamlFileDropzone.tsx';

export default function ImportProjectYamlPanel() {
  const navigate = useNavigate();
  const [driveOpen, setDriveOpen] = useState(false);
  const resolver = useYamlImportResolver({
    onImported: () => navigate('/summary'),
  });

  return (
    <Stack gap="sm">
      <YamlFileDropzone
        onFileText={(text, fileName) => resolver.handleLocalFile(fileName, text)}
        disabled={resolver.importing}
        error={resolver.error}
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
        projectName={resolver.projectName}
        diffLines={resolver.diffLines}
        loading={resolver.importing}
        onClose={() => resolver.resetOverwrite()}
        onConfirm={() => void resolver.confirmOverwrite()}
      />
    </Stack>
  );
}
