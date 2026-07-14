import { useState } from 'react';
import { Alert, Stack } from '@mantine/core';
import { runDriveActionWhenReady } from '../../hooks/useDriveActionClick.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import GoogleDriveButton, { type GoogleDriveButtonProps } from './GoogleDriveButton.tsx';
import GoogleDriveNotConfiguredModal from './GoogleDriveNotConfiguredModal.tsx';

const disconnectedRootStyle = {
  opacity: 0.55,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#fff',
    borderColor: '#dadce0',
  },
} as const;

export type GoogleDriveActionButtonProps = Omit<GoogleDriveButtonProps, 'onClick'> & {
  onClick: () => void;
};

/**
 * Drive file action CTA — greyed when OAuth is not ready; click runs GIS connect then the action.
 * When OAuth is not configured, click opens a Settings prompt. Settings Disconnect stays separate.
 */
export default function GoogleDriveActionButton({
  onClick,
  disabled = false,
  loading,
  styles,
  ...props
}: GoogleDriveActionButtonProps) {
  const {
    connected,
    isConfigured,
    connect,
    loading: driveLoading,
    sessionExpired,
  } = useGoogleDrive();
  const [notConfiguredOpen, setNotConfiguredOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const driveReady = connected && isConfigured && !sessionExpired;
  const operationBlocked = Boolean(disabled || loading || driveLoading);

  async function handleClick() {
    if (operationBlocked) return;
    setConnectError(null);

    const result = await runDriveActionWhenReady({
      isConfigured,
      connected,
      sessionExpired,
      connect,
      onNotConfigured: () => setNotConfiguredOpen(true),
      action: onClick,
    });

    if (!result.ok && result.connectError) {
      setConnectError(result.connectError);
    }
  }

  return (
    <Stack gap="xs">
      <GoogleDriveButton
        {...props}
        loading={loading || driveLoading}
        disabled={operationBlocked}
        styles={
          !driveReady && !operationBlocked ? { root: disconnectedRootStyle, ...styles } : styles
        }
        onClick={() => void handleClick()}
      />
      {connectError ? (
        <Alert color="red" onClose={() => setConnectError(null)} withCloseButton>
          {connectError}
        </Alert>
      ) : null}
      <GoogleDriveNotConfiguredModal
        opened={notConfiguredOpen}
        onClose={() => setNotConfiguredOpen(false)}
      />
    </Stack>
  );
}
