import { Button, Modal, Stack, Text, Alert } from '@mantine/core';
import type { DriveSaveConflict } from '@core/services/driveSaveConflict.ts';

export interface DriveSaveConflictModalProps {
  opened: boolean;
  projectName: string;
  conflict: DriveSaveConflict | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefreshFromDrive?: () => void;
  onSaveAnyway: () => void;
  onSaveAsNew: () => void;
}

function hasRemoteNewer(conflict: DriveSaveConflict | null): boolean {
  return conflict?.kinds.includes('remoteNewer') ?? false;
}

function hasIdMismatch(conflict: DriveSaveConflict | null): boolean {
  return conflict?.kinds.includes('projectIdMismatch') ?? false;
}

export default function DriveSaveConflictModal({
  opened,
  projectName,
  conflict,
  loading = false,
  error = null,
  onClose,
  onRefreshFromDrive,
  onSaveAnyway,
  onSaveAsNew,
}: DriveSaveConflictModalProps) {
  const remoteNewer = hasRemoteNewer(conflict);
  const idMismatch = hasIdMismatch(conflict);

  let title = 'Save to Google Drive?';
  if (remoteNewer && idMismatch) {
    title = 'Drive file conflict';
  } else if (remoteNewer) {
    title = 'Remote file is newer';
  } else if (idMismatch) {
    title = 'Drive file project mismatch';
  }

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        {remoteNewer ? (
          <Text size="sm">
            The linked Drive file was saved more recently on another device. Saving now will
            overwrite those changes to <strong>{projectName}</strong>.
          </Text>
        ) : null}
        {idMismatch ? (
          <>
            <Text size="sm">
              The linked Drive file belongs to a different project than{' '}
              <strong>{projectName}</strong>. Saving now will replace that file with your local
              project.
            </Text>
            <Stack gap={4}>
              {conflict?.localProjectId ? (
                <Text size="sm" c="dimmed">
                  Local project id: {conflict.localProjectId}
                </Text>
              ) : null}
              {conflict?.remoteProjectId ? (
                <Text size="sm" c="dimmed">
                  Remote project id: {conflict.remoteProjectId}
                </Text>
              ) : null}
            </Stack>
          </>
        ) : null}
        {conflict?.diffLines.length ? (
          <Stack gap={4}>
            {conflict.diffLines.map((line) => (
              <Text key={line} size="sm" c="dimmed">
                {line}
              </Text>
            ))}
          </Stack>
        ) : null}
        {error ? (
          <Alert color="red" title="Save failed">
            {error}
          </Alert>
        ) : null}
        <Stack gap="xs">
          {remoteNewer && onRefreshFromDrive ? (
            <Button variant="light" loading={loading} onClick={onRefreshFromDrive}>
              Refresh from Drive
            </Button>
          ) : null}
          <Button color="red" loading={loading} onClick={onSaveAnyway}>
            Save anyway
          </Button>
          <Button variant="light" loading={loading} onClick={onSaveAsNew}>
            Save as new file
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
