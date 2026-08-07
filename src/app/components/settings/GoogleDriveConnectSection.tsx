import { Alert, Stack, Text } from '@mantine/core';
import { isNativeApp } from '@integrations/platform/isNativeApp.ts';
import { useDriveSession } from '../../hooks/useDriveSession.ts';
import { Button, StatusDot } from '../v2/index.ts';

export default function GoogleDriveConnectSection() {
  const {
    connected,
    accountLabel,
    loading,
    error,
    isConfigured,
    disconnect,
    connect,
    sessionExpired,
  } = useDriveSession();

  const showReconnect = isConfigured && (!connected || sessionExpired);
  const clientIdEnv = isNativeApp() ? 'VITE_GOOGLE_ANDROID_CLIENT_ID' : 'VITE_GOOGLE_CLIENT_ID';

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Connect Google Drive to open and save native YAML project files from the cloud. Studio only
        asks for access to its own &quot;Codeplug Studio&quot; folder — created automatically on
        first connect — not the rest of your Drive. OAuth tokens stay on this device only.
      </Text>
      {!isConfigured ? (
        <Alert color="yellow" title="Not configured">
          Set <code>{clientIdEnv}</code> in <code>.env.local</code> for local development. See the
          build docs for Google Cloud setup.
        </Alert>
      ) : null}
      {connected && !sessionExpired ? (
        <StatusDot
          tone="success"
          label={
            <>
              Connected as <strong>{accountLabel ?? 'Google account'}</strong>
            </>
          }
        />
      ) : (
        <StatusDot
          tone={sessionExpired ? 'warning' : 'neutral'}
          label={
            sessionExpired
              ? 'Session expired — reconnect to continue using Google Drive.'
              : 'Not connected — use Open from Drive or Save to Drive in the app to connect.'
          }
        />
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      {showReconnect ? (
        <Button variant="secondary" size="sm" loading={loading} onClick={() => void connect()}>
          Reconnect
        </Button>
      ) : null}
      {connected && !sessionExpired ? (
        <Button variant="outline" size="sm" loading={loading} onClick={() => void disconnect()}>
          Disconnect
        </Button>
      ) : null}
    </Stack>
  );
}
