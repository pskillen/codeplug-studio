import { Button, Modal, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { SETTINGS_DRIVE_SECTION_ID } from '../../lib/settingsSections.ts';

export interface GoogleDriveConnectPromptModalProps {
  opened: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export default function GoogleDriveConnectPromptModal({
  opened,
  onClose,
  isConfigured,
}: GoogleDriveConnectPromptModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Google Drive not connected"
      centered
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        <Text size="sm">
          {isConfigured
            ? 'Connect Google Drive in Settings to open and save files from the cloud.'
            : 'Google Drive is not configured for this build. Set VITE_GOOGLE_CLIENT_ID for local development — see Settings for details.'}
        </Text>
        <Button
          component={Link}
          to="/settings"
          state={{ scrollTo: SETTINGS_DRIVE_SECTION_ID }}
          onClick={onClose}
        >
          Go to Settings
        </Button>
      </Stack>
    </Modal>
  );
}
