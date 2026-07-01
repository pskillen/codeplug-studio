import { NavLink, Stack } from '@mantine/core';
import { IconChartBar, IconGridDots } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';

export default function ReferenceSectionNav() {
  const location = useLocation();

  return (
    <Stack gap={4}>
      <NavLink
        component={Link}
        to="/reference/maidenhead"
        label="Maidenhead locator"
        leftSection={<IconGridDots size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        active={location.pathname.startsWith('/reference/maidenhead')}
      />
      <NavLink
        component={Link}
        to="/reference/bands"
        label="Band plan"
        leftSection={<IconChartBar size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        active={location.pathname.startsWith('/reference/bands')}
      />
    </Stack>
  );
}
