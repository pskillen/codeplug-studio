import { useState } from 'react';
import { Alert, Button, Modal, Stack, Text } from '@mantine/core';
import { useDriveSaveFlow } from '../../hooks/useDriveSaveFlow.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal, { type DriveSaveTarget } from './DriveBrowserModal.tsx';
import DriveSaveConflictModal from './DriveSaveConflictModal.tsx';
import GoogleDriveActionButton from './GoogleDriveActionButton.tsx';

export default function ExportToDrivePanel() {
  const { activeProjectId } = useProjects();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [nameCollisionOpen, setNameCollisionOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<DriveSaveTarget | null>(null);

  const {
    saving,
    error,
    conflictOpen,
    conflict,
    projectName,
    saveAsBrowserOpen,
    setSaveAsBrowserOpen,
    suggestedFileName,
    interchangeFolderId,
    startOverwriteToTarget,
    saveToNewTarget,
    confirmSaveAnyway,
    confirmRefreshFromDrive,
    openSaveAsNew,
    closeConflict,
  } = useDriveSaveFlow({
    onSaved: () => {
      setBrowserOpen(false);
      setNameCollisionOpen(false);
      setPendingTarget(null);
    },
  });

  async function handleSaveTarget(target: DriveSaveTarget) {
    if (target.existingFileId) {
      setPendingTarget(target);
      setNameCollisionOpen(true);
      return;
    }
    await saveToNewTarget(target);
  }

  function confirmNameCollisionOverwrite() {
    if (!pendingTarget?.existingFileId) return;
    setNameCollisionOpen(false);
    void startOverwriteToTarget(pendingTarget, pendingTarget.existingFileId);
  }

  if (!activeProjectId) {
    return <Alert color="gray">Select a project to export.</Alert>;
  }

  return (
    <Stack gap="sm">
      {error && !conflictOpen ? <Alert color="red">{error}</Alert> : null}
      <GoogleDriveActionButton
        loading={saving}
        disabled={saving}
        onClick={() => setBrowserOpen(true)}
      >
        Save to Drive
      </GoogleDriveActionButton>
      <DriveBrowserModal
        opened={browserOpen}
        onClose={() => {
          if (!saving) setBrowserOpen(false);
        }}
        mode="save"
        saving={saving}
        interchangeFolderId={interchangeFolderId}
        defaultFileName={suggestedFileName}
        onSelectFile={() => undefined}
        onSaveTarget={(target) => void handleSaveTarget(target)}
      />
      <Modal
        opened={nameCollisionOpen}
        onClose={() => {
          if (!saving) {
            setNameCollisionOpen(false);
            setPendingTarget(null);
          }
        }}
        title="Overwrite file on Drive?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            <strong>{pendingTarget?.fileName}</strong> already exists in this folder. Overwrite it?
          </Text>
          <Button color="red" loading={saving} onClick={confirmNameCollisionOverwrite}>
            Overwrite
          </Button>
        </Stack>
      </Modal>
      <DriveSaveConflictModal
        opened={conflictOpen}
        projectName={projectName}
        conflict={conflict}
        loading={saving}
        error={error}
        onClose={closeConflict}
        onRefreshFromDrive={
          conflict?.kinds.includes('remoteNewer') ? () => void confirmRefreshFromDrive() : undefined
        }
        onSaveAnyway={() => void confirmSaveAnyway()}
        onSaveAsNew={openSaveAsNew}
      />
      <DriveBrowserModal
        opened={saveAsBrowserOpen}
        onClose={() => {
          if (!saving) setSaveAsBrowserOpen(false);
        }}
        mode="save"
        saving={saving}
        interchangeFolderId={interchangeFolderId}
        defaultFileName={suggestedFileName}
        onSelectFile={() => undefined}
        onSaveTarget={(target) => void saveToNewTarget(target)}
      />
    </Stack>
  );
}
