import { Button } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function ZonesSectionNav(props: SectionNavProps) {
  const isSidebar = props.variant === 'sidebar';

  return (
    <EntityListSectionNav
      {...props}
      newPath="/library/zones/new"
      newLabel="New zone"
      extraActions={
        <Button
          component={Link}
          to="/library/zones/new-from-location"
          variant="light"
          leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New zone from location
        </Button>
      }
    />
  );
}
