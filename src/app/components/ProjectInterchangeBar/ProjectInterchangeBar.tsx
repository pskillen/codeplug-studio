import { Alert, Anchor, Button, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { portableInterchangeLabel } from '@core/services/projectSyncSummary.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useDriveSaveFlow } from '../../hooks/useDriveSaveFlow.ts';
import { useProjectPortableDirty } from '../../hooks/useProjectPortableDirty.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal from '../import-export/DriveBrowserModal.tsx';
import DriveSaveConflictModal from '../import-export/DriveSaveConflictModal.tsx';
import BrowserOnlyWarning from './BrowserOnlyWarning.tsx';

export default function ProjectInterchangeBar() {
  const { activeProjectId, activeProject } = useProjects();
  const { loading: driveLoading } = useGoogleDrive();
  const { dirty, hasPortableDestination } = useProjectPortableDirty(
    activeProjectId,
    activeProject ?? undefined,
  );
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
    startSaveToDrive,
    confirmSaveAnyway,
    confirmRefreshFromDrive,
    openSaveAsNew,
    saveToNewTarget,
    closeConflict,
  } = useDriveSaveFlow();

  if (!activeProjectId || !activeProject) {
    return null;
  }

  const drive = activeProject.interchange?.googleDrive;
  const localFile = activeProject.interchange?.localFile;
  const sourceLabel = portableInterchangeLabel(activeProject);

  return (
    <>
      <Group gap="sm" wrap="wrap" align="center" mb="sm">
        {sourceLabel ? (
          <Text size="sm" c="dimmed">
            {sourceLabel}
          </Text>
        ) : null}
        {drive ? (
          <Button
            size="xs"
            variant="light"
            loading={saving || driveLoading}
            disabled={!dirty || saving}
            onClick={() => void startSaveToDrive(drive)}
          >
            Save to Drive
          </Button>
        ) : null}
        {localFile && !drive ? (
          <Anchor component={Link} to="/import-export" size="sm">
            Export YAML
          </Anchor>
        ) : null}
        {!hasPortableDestination ? <BrowserOnlyWarning projectId={activeProjectId} /> : null}
        {error && !conflictOpen ? (
          <Alert color="red" styles={{ root: { flex: 1, minWidth: 0 } }}>
            {error}
          </Alert>
        ) : null}
      </Group>
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
    </>
  );
}
