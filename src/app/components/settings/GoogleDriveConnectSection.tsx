import { Alert, Button, Stack, Text } from '@mantine/core';
import { useDriveSession } from '../../hooks/useDriveSession.ts';

export default function GoogleDriveConnectSection() {
  const { connected, accountLabel, loading, error, isConfigured, disconnect, connect, sessionExpired } =
    useDriveSession();

  const showReconnect = isConfigured && (!connected || sessionExpired);

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
      {connected && !sessionExpired ? (
        <Text size="sm">
          Connected as <strong>{accountLabel ?? 'Google account'}</strong>
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          {sessionExpired
            ? 'Session expired — reconnect to continue using Google Drive.'
            : 'Not connected — use Open from Drive or Save to Drive anywhere in the app to connect.'}
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      {showReconnect ? (
        <Button variant="light" loading={loading} onClick={() => void connect()}>
          Reconnect
        </Button>
      ) : null}
      {connected && !sessionExpired ? (
        <Button variant="light" color="red" loading={loading} onClick={() => void disconnect()}>
          Disconnect
        </Button>
      ) : null}
    </Stack>
  );
}
