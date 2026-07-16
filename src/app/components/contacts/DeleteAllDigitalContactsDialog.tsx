import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import type { DeleteAllDigitalContactsResult } from '../../state/libraryService.ts';

export interface DeleteAllDigitalContactsDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Approximate count shown in the modal (already in memory for the list). */
  contactCount: number;
  onConfirm: () => Promise<DeleteAllDigitalContactsResult>;
}

export default function DeleteAllDigitalContactsDialog({
  opened,
  onClose,
  contactCount,
  onConfirm,
}: DeleteAllDigitalContactsDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setConfirmed(false);
    setDeleting(false);
    setErrorMessage(null);
  }, [opened]);

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete digital contacts.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!deleting) onClose();
      }}
      title="Delete all digital contacts"
      centered
    >
      <Stack gap="md">
        <Text>
          Permanently delete {contactCount} digital contact{contactCount === 1 ? '' : 's'} from this
          project? This cannot be undone.
        </Text>
        <Text size="sm" c="dimmed">
          Channel DMR contact references and digital members of RX group lists will be cleared.
          Analog contacts are not affected.
        </Text>

        <Checkbox
          checked={confirmed}
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
          disabled={deleting}
          label="I understand this permanently deletes all digital contacts in this project"
        />

        {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => void handleDelete()}
            disabled={!confirmed}
            loading={deleting}
          >
            Delete all
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
