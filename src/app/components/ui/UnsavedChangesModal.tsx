import { Button, Group, Modal, Stack, Text } from '@mantine/core';

export interface UnsavedChangesModalProps {
  opened: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  message?: string;
}

export default function UnsavedChangesModal({
  opened,
  onStay,
  onLeave,
  title = 'Unsaved changes',
  message = 'You have unsaved edits. Leave without saving?',
}: UnsavedChangesModalProps) {
  return (
    <Modal opened={opened} onClose={onStay} title={title} centered>
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onStay}>
            Stay
          </Button>
          <Button color="red" onClick={onLeave}>
            Leave
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
