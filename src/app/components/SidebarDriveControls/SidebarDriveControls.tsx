import { useState } from 'react';
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { loadDriveLastAccount } from '@integrations/cloud/drivePrefs.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useDriveActionClick } from '../../hooks/useDriveActionClick.ts';
import { useDriveSaveFlowContext } from './DriveSaveFlowProvider.tsx';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjectPortableDirty } from '../../hooks/useProjectPortableDirty.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal from '../import-export/DriveBrowserModal.tsx';
import DriveSaveConflictModal from '../import-export/DriveSaveConflictModal.tsx';
import GoogleDriveNotConfiguredModal from '../import-export/GoogleDriveNotConfiguredModal.tsx';
import { useDriveRefresh } from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';

const disconnectedIconStyle = { opacity: 0.55, cursor: 'pointer' } as const;

/**
 * Compact Drive save/check cluster for AppShell `rightExtra`.
 */
export default function SidebarDriveControls() {
  const { activeProjectId, activeProject } = useProjects();
  const { sessionExpired, connected } = useGoogleDrive();
  const { dirty } = useProjectPortableDirty(activeProjectId, activeProject ?? undefined);
  const { checkNow, checking } = useDriveRefresh();
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
  } = useDriveSaveFlowContext();

  const saveAction = useDriveActionClick({ disabled: saving, loading: checking });
  const checkAction = useDriveActionClick({ disabled: saving, loading: checking });
  const [notConfiguredOpen, setNotConfiguredOpen] = useState(false);

  if (!activeProjectId || !activeProject) {
    return null;
  }

  const drive = activeProject.interchange?.googleDrive;
  const localFile = activeProject.interchange?.localFile;
  const everConnectedDrive = Boolean(loadDriveLastAccount());
  const showCluster = Boolean(drive || everConnectedDrive || (localFile && !drive));

  if (!showCluster || !drive) {
    return null;
  }

  const showExpiryHint = sessionExpired && !connected;
  const saveDisabled = saving || (!showExpiryHint && saveAction.driveReady && !dirty);
  const checkDisabled = checking || saving;

  async function handleSave() {
    if (!drive || saveDisabled) return;
    await saveAction.runAction({
      onNotConfigured: () => setNotConfiguredOpen(true),
      action: () => void startSaveToDrive(drive),
    });
  }

  async function handleCheck() {
    if (checkDisabled) return;
    await checkAction.runAction({
      onNotConfigured: () => setNotConfiguredOpen(true),
      action: () => void checkNow(),
    });
  }

  return (
    <>
      <Group gap="xs">
        <Tooltip label="Save to Drive">
          <ActionIcon
            variant="default"
            size="md"
            aria-label="Save to Drive"
            loading={saving || saveAction.driveLoading}
            disabled={saveDisabled}
            style={!saveAction.driveReady && !saveDisabled ? disconnectedIconStyle : undefined}
            onClick={() => void handleSave()}
          >
            <IconDeviceFloppy size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Check Drive">
          <ActionIcon
            variant="default"
            size="md"
            aria-label="Check Drive"
            loading={checking || checkAction.driveLoading}
            disabled={checkDisabled}
            style={!checkAction.driveReady && !checkDisabled ? disconnectedIconStyle : undefined}
            onClick={() => void handleCheck()}
          >
            <IconRefresh size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
          </ActionIcon>
        </Tooltip>
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
      <GoogleDriveNotConfiguredModal
        opened={notConfiguredOpen}
        onClose={() => setNotConfiguredOpen(false)}
      />
    </>
  );
}
