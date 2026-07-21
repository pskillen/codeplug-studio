import { NavLink, Stack } from '@mantine/core';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useFormatBuild } from '../../../state/useFormatBuilds.ts';
import { buildNavItems } from '../../../routes/builds/nav.ts';

export default function BuildNavLinks() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const buildId = paramId ?? location.pathname.match(/^\/builds\/([^/]+)/)?.[1];
  const { build } = useFormatBuild(buildId);

  if (!build) return null;

  return (
    <Stack gap={4}>
      {buildNavItems(build).map((entry) => {
        const Icon = entry.icon;
        return (
          <NavLink
            key={entry.path}
            component={Link}
            to={entry.path}
            label={entry.label}
            leftSection={<Icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            active={location.pathname === entry.path}
          />
        );
      })}
    </Stack>
  );
}
