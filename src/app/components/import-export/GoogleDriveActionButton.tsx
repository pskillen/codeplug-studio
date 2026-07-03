import { useState } from 'react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import GoogleDriveButton, { type GoogleDriveButtonProps } from './GoogleDriveButton.tsx';
import GoogleDriveConnectPromptModal from './GoogleDriveConnectPromptModal.tsx';

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
 * Drive file action CTA — greyed when OAuth is not ready; click opens a Settings prompt instead
 * of the Drive browser. Use raw {@link GoogleDriveButton} on Settings for Connect itself.
 */
export default function GoogleDriveActionButton({
  onClick,
  disabled = false,
  loading,
  styles,
  ...props
}: GoogleDriveActionButtonProps) {
  const { connected, isConfigured } = useGoogleDrive();
  const [promptOpen, setPromptOpen] = useState(false);
  const driveReady = connected && isConfigured;
  const operationBlocked = Boolean(disabled || loading);

  return (
    <>
      <GoogleDriveButton
        {...props}
        loading={loading}
        disabled={operationBlocked}
        styles={
          !driveReady && !operationBlocked ? { root: disconnectedRootStyle, ...styles } : styles
        }
        onClick={() => {
          if (operationBlocked) return;
          if (!driveReady) {
            setPromptOpen(true);
            return;
          }
          onClick();
        }}
      />
      <GoogleDriveConnectPromptModal
        opened={promptOpen}
        onClose={() => setPromptOpen(false)}
        isConfigured={isConfigured}
      />
    </>
  );
}
