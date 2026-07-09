import { Button, Modal, Stack, Text } from '@mantine/core';

export interface InterchangeOverwriteModalProps {
  opened: boolean;
  title: string;
  projectName: string;
  diffLines: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function InterchangeOverwriteModal({
  opened,
  title,
  projectName,
  diffLines,
  loading = false,
  onClose,
  onConfirm,
}: InterchangeOverwriteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Text size="sm">
          Overwrite local copy of <strong>{projectName}</strong> with the remote YAML file?
        </Text>
        <Stack gap={4}>
          {diffLines.map((line) => (
            <Text key={line} size="sm" c="dimmed">
              {line}
            </Text>
          ))}
        </Stack>
        <Button color="red" loading={loading} onClick={onConfirm}>
          Overwrite local copy
        </Button>
      </Stack>
    </Modal>
  );
}
