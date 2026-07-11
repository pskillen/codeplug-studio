import { Alert, Button, Group } from '@mantine/core';
import { useRefreshFromDrivePrompt } from '../../hooks/useYamlImportResolver.ts';
import InterchangeOverwriteModal from '../import-export/InterchangeOverwriteModal.tsx';

export default function RefreshFromDriveBanner() {
  const {
    bannerOpen,
    diffLines,
    overwriteOpen,
    importing,
    error,
    idMismatch,
    localProjectId,
    remoteProjectId,
    closeOverwrite,
    dismissBanner,
    openOverwrite,
    confirmRefresh,
    confirmImportAsNew,
    projectName,
  } = useRefreshFromDrivePrompt();

  if (!bannerOpen) {
    return null;
  }

  return (
    <>
      <Alert
        color={idMismatch ? 'yellow' : 'blue'}
        title={idMismatch ? 'Drive file project mismatch' : 'Newer copy on Google Drive'}
        mb="sm"
      >
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          <span>
            {idMismatch
              ? 'A newer YAML file is linked on Drive, but its project id does not match this project.'
              : 'A newer YAML file is available for this project.'}
          </span>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={openOverwrite}>
              Refresh from Drive
            </Button>
            <Button size="xs" variant="subtle" onClick={dismissBanner}>
              Dismiss
            </Button>
          </Group>
        </Group>
      </Alert>
      <InterchangeOverwriteModal
        opened={overwriteOpen}
        title={idMismatch ? 'Refresh from Google Drive?' : 'Refresh from Google Drive?'}
        projectName={projectName}
        diffLines={diffLines}
        loading={importing}
        error={error}
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
