import { NavLink, Stack } from '@mantine/core';
import { IconDatabase, IconGridDots, IconMap } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { scrollToPageSection } from '../../../lib/scrollToPageSection.ts';

const SETTINGS_SECTIONS = [
  { id: 'settings-storage', label: 'Storage', icon: IconDatabase },
  { id: 'settings-map-geocode', label: 'Map geocode', icon: IconMap },
  { id: 'settings-maidenhead-grid', label: 'Maidenhead grid', icon: IconGridDots },
] as const;

export default function SettingsSectionNav() {
  return (
    <Stack gap={4}>
      {SETTINGS_SECTIONS.map((section) => (
        <NavLink
          key={section.id}
          component="button"
          type="button"
          label={section.label}
          leftSection={<section.icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          onClick={() => scrollToPageSection(section.id)}
        />
      ))}
    </Stack>
  );
}
