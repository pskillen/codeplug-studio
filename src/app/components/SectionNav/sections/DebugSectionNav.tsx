import { NavLink, Stack } from '@mantine/core';
import { IconBug, IconDatabase, IconServer } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';

export default function DebugSectionNav({ variant }: SectionNavProps) {
  return (
    <Stack gap={4}>
      <NavLink
        component={Link}
        to="/debug"
        label="Overview"
        description={variant === 'sidebar' ? 'Debug tools' : undefined}
        leftSection={<IconBug size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      />
      <NavLink
        component={Link}
        to="/debug/indexed-db"
        label="IndexedDB"
        description={variant === 'sidebar' ? 'Project and library rows' : undefined}
        leftSection={<IconServer size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      />
      <NavLink
        component={Link}
        to="/debug/local-storage"
        label="LocalStorage"
        description={variant === 'sidebar' ? 'Browser persistence keys' : undefined}
        leftSection={<IconDatabase size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      />
    </Stack>
  );
}
