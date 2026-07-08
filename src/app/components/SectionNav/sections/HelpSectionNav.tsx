import { NavLink, Stack } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

export default function HelpSectionNav() {
  const location = useLocation();

  return (
    <Stack gap="xs">
      <NavLink
        component={Link}
        to="/help"
        label="Overview"
        active={location.pathname === '/help'}
      />
      <NavLink
        component={Link}
        to="/attributions"
        label="Attributions"
        active={location.pathname === '/attributions'}
      />
    </Stack>
  );
}
