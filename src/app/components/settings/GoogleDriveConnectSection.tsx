import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import GoogleDriveButton from '../import-export/GoogleDriveButton.tsx';

export default function GoogleDriveConnectSection() {
  const { connected, accountLabel, loading, error, isConfigured, connect, disconnect } =
    useGoogleDrive();

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Connect Google Drive to open and save native YAML project files from the cloud. OAuth tokens
        stay in this browser only.
      </Text>
      {!isConfigured ? (
        <Alert color="yellow" title="Not configured">
          Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code> for local development.
          See the build docs for Google Cloud setup.
        </Alert>
      ) : null}
      {connected ? (
        <Text size="sm">
          Connected as <strong>{accountLabel ?? 'Google account'}</strong>
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Not connected
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      <Group>
        {connected ? (
          <Button variant="light" color="red" loading={loading} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : (
          <GoogleDriveButton
            loading={loading}
            disabled={!isConfigured}
            onClick={() => void connect()}
          >
            Connect Google Drive
          </GoogleDriveButton>
        )}
      </Group>
    </Stack>
  );
}
