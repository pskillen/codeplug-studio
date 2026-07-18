import { Button, Modal, Stack, Text, Alert } from '@mantine/core';
import type { ProjectSyncDiff } from '@core/services/projectSyncSummary.ts';
import ProjectSyncDiffTable from './ProjectSyncDiffTable.tsx';

export interface InterchangeOverwriteModalProps {
  opened: boolean;
  title: string;
  projectName: string;
  diff: ProjectSyncDiff | null;
  loading?: boolean;
  error?: string | null;
  idMismatch?: boolean;
  localProjectId?: string;
  remoteProjectId?: string;
  onClose: () => void;
  onConfirm: () => void;
  onImportAsNew?: () => void;
}

export default function InterchangeOverwriteModal({
  opened,
  title,
  projectName,
  diff,
  loading = false,
  error = null,
  idMismatch = false,
  localProjectId,
  remoteProjectId,
  onClose,
  onConfirm,
  onImportAsNew,
}: InterchangeOverwriteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="lg">
      <Stack gap="md">
        {idMismatch ? (
          <>
            <Text size="sm">
              The linked Drive file belongs to a different project than{' '}
              <strong>{projectName}</strong>.
            </Text>
            <Stack gap={4}>
              {localProjectId ? (
                <Text size="sm" c="dimmed">
                  Local project id: {localProjectId}
                </Text>
              ) : null}
              {remoteProjectId ? (
                <Text size="sm" c="dimmed">
                  Remote project id: {remoteProjectId}
                </Text>
              ) : null}
            </Stack>
          </>
        ) : (
          <Text size="sm">
            Overwrite local copy of <strong>{projectName}</strong> with the remote YAML file?
          </Text>
        )}
        {diff ? <ProjectSyncDiffTable diff={diff} /> : null}
        {error ? (
          <Alert color="red" title="Import failed">
            {error}
          </Alert>
        ) : null}
        {idMismatch ? (
          <Stack gap="xs">
            <Button color="red" loading={loading} onClick={onConfirm}>
              Replace local content
            </Button>
            {onImportAsNew ? (
              <Button variant="light" loading={loading} onClick={onImportAsNew}>
                Import as new project
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Button color="red" loading={loading} onClick={onConfirm}>
            Overwrite local copy
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
