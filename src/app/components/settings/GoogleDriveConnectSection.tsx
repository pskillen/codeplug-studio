import { Alert, Button, Stack, Text } from '@mantine/core';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';

export default function GoogleDriveConnectSection() {
  const { connected, accountLabel, loading, error, isConfigured, disconnect } = useGoogleDrive();

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
          Not connected — use <strong>Open from Drive</strong> or <strong>Save to Drive</strong>{' '}
          anywhere in the app to connect.
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      {connected ? (
        <Button variant="light" color="red" loading={loading} onClick={() => void disconnect()}>
          Disconnect
        </Button>
      ) : null}
    </Stack>
  );
}
