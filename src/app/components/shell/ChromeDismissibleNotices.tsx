import { useState } from 'react';
import { useDriveActionClick } from '../../hooks/useDriveActionClick.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useDriveRefresh } from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useDriveSaveFlowContext } from '../SidebarDriveControls/DriveSaveFlowProvider.tsx';
import DismissibleNotice from '../v2/DismissibleNotice.tsx';
import GoogleDriveNotConfiguredModal from '../import-export/GoogleDriveNotConfiguredModal.tsx';
import InterchangeOverwriteModal from '../import-export/InterchangeOverwriteModal.tsx';

/**
 * mk2 S4 chrome-level dismissible notices — Drive drift and session expiry.
 * Renders below all chrome strips (contextual + build sub-nav), distinct from page `StatusBanner`.
 */
export default function ChromeDismissibleNotices() {
  const { activeProject, activeProjectId } = useProjects();
  const { sessionExpired, connected } = useGoogleDrive();
  const reconnectAction = useDriveActionClick();
  const [notConfiguredOpen, setNotConfiguredOpen] = useState(false);
  const {
    bannerOpen,
    diff,
    overwriteOpen,
    importing,
    error: refreshError,
    idMismatch,
    localProjectId,
    remoteProjectId,
    dismissBanner,
    openOverwrite,
    closeOverwrite,
    confirmRefresh,
    confirmImportAsNew,
    clearRefreshError,
    projectName,
  } = useDriveRefresh();
  const { error: saveError, conflictOpen, clearSaveError } = useDriveSaveFlowContext();

  const driveLinked = Boolean(activeProject?.interchange?.googleDrive);
  const showDriveUpdate = bannerOpen && activeProjectId != null;
  const showRefreshError =
    Boolean(refreshError) && !showDriveUpdate && !overwriteOpen && driveLinked;
  const showSaveError = Boolean(saveError) && !conflictOpen && driveLinked;
  const showDisconnected = driveLinked && sessionExpired && !connected && activeProjectId != null;

  return (
    <>
      {showDriveUpdate ? (
        <DismissibleNotice
          tone="warning"
          action={{ label: 'Review', onClick: openOverwrite }}
          onDismiss={dismissBanner}
        >
          {idMismatch
            ? 'Google Drive has a newer file linked, but its project id does not match this project.'
            : "Google Drive has a newer version of this project than what's loaded here."}
        </DismissibleNotice>
      ) : null}
      {showRefreshError ? (
        <DismissibleNotice tone="warning" onDismiss={clearRefreshError}>
          Could not refresh from Google Drive: {refreshError}
        </DismissibleNotice>
      ) : null}
      {showSaveError ? (
        <DismissibleNotice tone="warning" onDismiss={clearSaveError}>
          Could not save to Google Drive: {saveError}
        </DismissibleNotice>
      ) : null}
      {showDisconnected ? (
        <DismissibleNotice
          tone="info"
          action={{
            label: 'Reconnect',
            onClick: () =>
              void reconnectAction.runAction({
                onNotConfigured: () => setNotConfiguredOpen(true),
                action: () => undefined,
              }),
          }}
        >
          You&apos;re signed out of Google Drive — changes are saving to this device only.
        </DismissibleNotice>
      ) : null}
      <GoogleDriveNotConfiguredModal
        opened={notConfiguredOpen}
        onClose={() => setNotConfiguredOpen(false)}
      />
      <InterchangeOverwriteModal
        opened={overwriteOpen}
        title="Refresh from Google Drive?"
        projectName={projectName}
        diff={diff}
        loading={importing}
        error={refreshError}
        idMismatch={idMismatch}
        localProjectId={localProjectId}
        remoteProjectId={remoteProjectId}
        onClose={closeOverwrite}
        onConfirm={() => void confirmRefresh()}
        onImportAsNew={idMismatch ? () => void confirmImportAsNew() : undefined}
      />
    </>
  );
}
