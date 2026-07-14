import { useState } from 'react';
import { ActionIcon, Anchor, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { loadDriveLastAccount } from '@integrations/cloud/drivePrefs.ts';
import { portableInterchangeLabel } from '@core/services/projectSyncSummary.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useDriveActionClick } from '../../hooks/useDriveActionClick.ts';
import { useDriveSaveFlow } from '../../hooks/useDriveSaveFlow.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjectPortableDirty } from '../../hooks/useProjectPortableDirty.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal from '../import-export/DriveBrowserModal.tsx';
import DriveSaveConflictModal from '../import-export/DriveSaveConflictModal.tsx';
import GoogleDriveNotConfiguredModal from '../import-export/GoogleDriveNotConfiguredModal.tsx';
import BrowserOnlyWarning from '../ProjectInterchangeBar/BrowserOnlyWarning.tsx';
import { useDriveRefresh } from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';
import SoftWarning from '../ui/SoftWarning.tsx';

const disconnectedIconStyle = { opacity: 0.55, cursor: 'pointer' } as const;

export default function SidebarDriveControls() {
  const { activeProjectId, activeProject } = useProjects();
  const { sessionExpired, connected } = useGoogleDrive();
  const { dirty, hasPortableDestination } = useProjectPortableDirty(
    activeProjectId,
    activeProject ?? undefined,
  );
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
  } = useDriveSaveFlow();

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

  if (!showCluster) {
    return null;
  }

  const sourceLabel = portableInterchangeLabel(activeProject);
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

  const driveButtons = (
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
  );

  return (
    <>
      <Stack gap="xs">
        {sourceLabel ? (
          <Text size="xs" c="dimmed" truncate>
            {sourceLabel}
          </Text>
        ) : null}
        {drive ? (
          showExpiryHint ? (
            <SoftWarning tone="danger">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  Session expired — click Save or Check to reconnect. You can keep working locally.
                </Text>
                {driveButtons}
              </Stack>
            </SoftWarning>
          ) : (
            driveButtons
          )
        ) : null}
        {localFile && !drive ? (
          <Anchor component={Link} to="/import-export" size="xs">
            Export YAML
          </Anchor>
        ) : null}
        {!hasPortableDestination && everConnectedDrive ? (
          <BrowserOnlyWarning projectId={activeProjectId} />
        ) : null}
        {error && !conflictOpen ? (
          <Text size="xs" c="red">
            {error}
          </Text>
        ) : null}
      </Stack>
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
