import { IconCloud } from '@tabler/icons-react';
import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { isNativeApp } from '@integrations/platform/isNativeApp.ts';
import { SETTINGS_DRIVE_SECTION_ID } from '../../lib/settingsSections.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { DesignSystemV2Provider, Button, ModalShell } from '../v2/index.ts';

export interface GoogleDriveNotConfiguredModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function GoogleDriveNotConfiguredModal({
  opened,
  onClose,
}: GoogleDriveNotConfiguredModalProps) {
  const clientIdEnv = isNativeApp() ? 'VITE_GOOGLE_ANDROID_CLIENT_ID' : 'VITE_GOOGLE_CLIENT_ID';

  return (
    <DesignSystemV2Provider>
      <ModalShell
        open={opened}
        onClose={onClose}
        title="Connect Google Drive"
        icon={<IconCloud size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Not now
            </Button>
            <Link
              to="/settings"
              state={{ scrollTo: SETTINGS_DRIVE_SECTION_ID }}
              onClick={onClose}
              style={{ textDecoration: 'none' }}
            >
              <Button size="sm">Connect Drive</Button>
            </Link>
          </>
        }
      >
        <Text size="sm">
          Connect Google Drive to back up this project and pick it up on another device. You can
          keep working locally without it — nothing here is required.
        </Text>
        <Text size="sm" mt="sm" c="dimmed">
          For local development, set <code>{clientIdEnv}</code> — see Settings for details.
        </Text>
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
