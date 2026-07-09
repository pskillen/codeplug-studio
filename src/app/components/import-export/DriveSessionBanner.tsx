import { Alert, Button, Group } from '@mantine/core';
import { useDriveSession } from '../../hooks/useDriveSession.ts';

/**
 * Non-blocking banner when the Google Drive OAuth session has lapsed.
 */
export default function DriveSessionBanner() {
  const { connected, sessionExpired, loading, connect } = useDriveSession();

  if (connected || !sessionExpired) {
    return null;
  }

  return (
    <Alert color="yellow" title="Google Drive session expired" mb="sm">
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <span>Reconnect to open or save files on Google Drive.</span>
        <Button size="xs" variant="light" loading={loading} onClick={() => void connect()}>
          Reconnect
        </Button>
      </Group>
    </Alert>
  );
}
