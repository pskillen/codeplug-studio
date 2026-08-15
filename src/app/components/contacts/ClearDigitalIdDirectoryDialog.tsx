import { useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';

export type ClearDigitalIdDirectoryMode = 'all' | 'filtered';

export interface ClearDigitalIdDirectoryDialogProps {
  opened: boolean;
  onClose: () => void;
  mode: ClearDigitalIdDirectoryMode;
  entryCount: number;
  onConfirm: () => Promise<{ deletedCount: number }>;
}

function ClearDigitalIdDirectoryDialogBody({
  mode,
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

  const isFiltered = mode === 'filtered';

  return (
    <Stack gap="md">
      <Text>
        {isFiltered ? (
          <>
            Permanently delete <strong>{entryCount.toLocaleString()}</strong> directory row
            {entryCount === 1 ? '' : 's'} matching your current filters? This cannot be undone.
          </>
        ) : (
          <>
            Permanently delete all {entryCount.toLocaleString()} downloaded ID
            {entryCount === 1 ? '' : 's'} from your local digital ID directory? This cannot be
            undone.
          </>
        )}
      </Text>
      <Text size="sm" c="dimmed">
        Library contacts are not affected. Channel and RX group list references stay intact — only
        the shadow directory partition{isFiltered ? ' rows that match' : ''} is removed.
      </Text>

      <Checkbox
        checked={confirmed}
        onChange={(event) => setConfirmed(event.currentTarget.checked)}
        disabled={clearing}
        label={
          isFiltered
            ? 'I understand this permanently deletes the matching directory rows for this project'
            : 'I understand this permanently clears the directory shadow store for this project'
        }
      />

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={clearing}>
          Cancel
        </Button>
        <Button
          color="red"
          onClick={() => void handleClear()}
          disabled={!confirmed || entryCount === 0}
          loading={clearing}
        >
          {isFiltered ? 'Delete matching rows' : 'Clear directory'}
        </Button>
      </Group>
    </Stack>
  );
}

export default function ClearDigitalIdDirectoryDialog({
  opened,
  onClose,
  mode,
  entryCount,
  onConfirm,
}: ClearDigitalIdDirectoryDialogProps) {
  const title =
    mode === 'filtered' ? 'Delete matching directory rows' : 'Clear digital ID directory';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      closeOnClickOutside={false}
      closeOnEscape={true}
    >
      {opened ? (
        <ClearDigitalIdDirectoryDialogBody
          mode={mode}
          entryCount={entryCount}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Modal>
  );
}
