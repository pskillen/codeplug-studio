import { useState } from 'react';
import { Alert, Anchor, Button, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { portableInterchangeLabel } from '@core/services/projectSyncSummary.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjectPortableDirty } from '../../hooks/useProjectPortableDirty.ts';
import { useProjects } from '../../state/useProjects.ts';
import { saveProjectToDrive } from '../../services/saveProjectToDriveService.ts';
import BrowserOnlyWarning from './BrowserOnlyWarning.tsx';

export default function ProjectInterchangeBar() {
  const { activeProjectId, activeProject, refreshProjects } = useProjects();
  const { port, withDriveAuthRetry, loading: driveLoading } = useGoogleDrive();
  const {
    dirty,
    hasPortableDestination,
    refresh: refreshDirty,
  } = useProjectPortableDirty(activeProjectId, activeProject ?? undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeProjectId || !activeProject) {
    return null;
  }

  const drive = activeProject.interchange?.googleDrive;
  const localFile = activeProject.interchange?.localFile;
  const sourceLabel = portableInterchangeLabel(activeProject);

  async function handleSaveToDrive() {
    if (!drive || !activeProjectId) return;
    setSaving(true);
    setError(null);
    try {
      await withDriveAuthRetry(() =>
        saveProjectToDrive(port, { projectId: activeProjectId, drive }),
      );
      await refreshProjects();
      await refreshDirty();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
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
          onClick={() => void handleSaveToDrive()}
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
      {error ? (
        <Alert color="red" styles={{ root: { flex: 1, minWidth: 0 } }}>
          {error}
        </Alert>
      ) : null}
    </Group>
  );
}
