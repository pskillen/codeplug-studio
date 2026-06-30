import { NavLink, Stack } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { scrollToPageSection } from '../../../lib/scrollToPageSection.ts';

export default function SettingsSectionNav() {
  return (
    <Stack gap={4}>
      <NavLink
        component="button"
        type="button"
        label="Storage"
        leftSection={<IconDatabase size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => scrollToPageSection('settings-storage')}
      />
    </Stack>
  );
}
