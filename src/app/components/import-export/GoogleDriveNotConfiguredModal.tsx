import { Button, Modal, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { SETTINGS_DRIVE_SECTION_ID } from '../../lib/settingsSections.ts';

export interface GoogleDriveNotConfiguredModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function GoogleDriveNotConfiguredModal({
  opened,
  onClose,
}: GoogleDriveNotConfiguredModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Google Drive not configured"
      centered
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        <Text size="sm">
          Google Drive is not configured for this build. Set <code>VITE_GOOGLE_CLIENT_ID</code> for
          local development — see Settings for details.
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
