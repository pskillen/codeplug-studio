import { NavLink, Stack } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { LIBRARY_NAV } from '../../../routes/library/nav.ts';

export default function LibraryNavLinks() {
  const location = useLocation();

  return (
    <Stack gap={4}>
      {LIBRARY_NAV.map((entry) => (
        <NavLink
          key={entry.listPath}
          component={Link}
          to={entry.listPath}
          label={entry.plural}
          active={location.pathname.startsWith(entry.listPath)}
        />
      ))}
    </Stack>
  );
}
