import { Alert, Button, Group } from '@mantine/core';
import { useRefreshFromDrivePrompt } from '../../hooks/useYamlImportResolver.ts';
import InterchangeOverwriteModal from '../import-export/InterchangeOverwriteModal.tsx';

export default function RefreshFromDriveBanner() {
  const {
    bannerOpen,
    diffLines,
    overwriteOpen,
    importing,
    setOverwriteOpen,
    dismissBanner,
    openOverwrite,
    confirmRefresh,
    projectName,
  } = useRefreshFromDrivePrompt();

  if (!bannerOpen) {
    return null;
  }

  return (
    <>
      <Alert color="blue" title="Newer copy on Google Drive" mb="sm">
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          <span>A newer YAML file is available for this project.</span>
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
        title="Refresh from Google Drive?"
        projectName={projectName}
        diffLines={diffLines}
        loading={importing}
        onClose={() => setOverwriteOpen(false)}
        onConfirm={() => void confirmRefresh()}
      />
    </>
  );
}
