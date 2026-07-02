import { NavLink, Stack } from '@mantine/core';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useFormatBuild } from '../../../state/useFormatBuilds.ts';
import { buildNavItems } from '../../../routes/builds/nav.ts';

export default function BuildNavLinks() {
  const { id } = useParams();
  const location = useLocation();
  const { build } = useFormatBuild(id);

  if (!build) return null;

  return (
    <Stack gap={4}>
      {buildNavItems(build).map((entry) => (
        <NavLink
          key={entry.path}
          component={Link}
          to={entry.path}
          label={entry.label}
          active={location.pathname === entry.path}
        />
      ))}
    </Stack>
  );
}
