import { Button, NavLink } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

const ZONE_DEFAULTS_PATH = '/library/zones/defaults';

export default function ZonesSectionNav(props: SectionNavProps) {
  const isSidebar = props.variant === 'sidebar';
  const location = useLocation();

  return (
    <EntityListSectionNav
      {...props}
      newPath="/library/zones/new"
      newLabel="New zone"
      extraActions={
        <>
          <Button
            component={Link}
            to="/library/zones/new-from-location"
            variant="light"
            leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            fullWidth={isSidebar}
          >
            New zone from location
          </Button>
          <NavLink
            component={Link}
            to={ZONE_DEFAULTS_PATH}
            label="Zone defaults"
            active={location.pathname === ZONE_DEFAULTS_PATH}
            variant="light"
          />
        </>
      }
    />
  );
}
