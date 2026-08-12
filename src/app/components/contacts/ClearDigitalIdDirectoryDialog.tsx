import { useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';

export interface ClearDigitalIdDirectoryDialogProps {
  opened: boolean;
  onClose: () => void;
  entryCount: number;
  onConfirm: () => Promise<{ deletedCount: number }>;
}

function ClearDigitalIdDirectoryDialogBody({
  entryCount,
  onClose,
  onConfirm,
}: Omit<ClearDigitalIdDirectoryDialogProps, 'opened'>) {
  const [confirmed, setConfirmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClear = async () => {
    setClearing(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to clear the directory shadow store.',
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <Stack gap="md">
      <Text>
        Permanently delete {entryCount.toLocaleString()} downloaded ID
        {entryCount === 1 ? '' : 's'} from your local digital ID directory? This cannot be undone.
      </Text>
      <Text size="sm" c="dimmed">
        Library contacts are not affected. Channel and RX group list references stay intact — only
        the shadow directory partition is wiped.
      </Text>

      <Checkbox
        checked={confirmed}
        onChange={(event) => setConfirmed(event.currentTarget.checked)}
        disabled={clearing}
        label="I understand this permanently clears the directory shadow store for this project"
      />

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={clearing}>
          Cancel
        </Button>
        <Button
          color="red"
          onClick={() => void handleClear()}
          disabled={!confirmed}
          loading={clearing}
        >
          Clear directory
        </Button>
      </Group>
    </Stack>
  );
}

export default function ClearDigitalIdDirectoryDialog({
  opened,
  onClose,
  entryCount,
  onConfirm,
}: ClearDigitalIdDirectoryDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Clear digital ID directory"
      centered
      closeOnClickOutside={false}
      closeOnEscape={true}
    >
      {opened ? (
        <ClearDigitalIdDirectoryDialogBody
          entryCount={entryCount}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Modal>
  );
}
