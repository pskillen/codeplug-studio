import { Button, Stack } from '@mantine/core';
import { IconPlus, IconWorldSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import LibraryNavLinks from './LibraryNavLinks.tsx';

/** Channel list actions — filter controls wired in slice 5. */
export default function ChannelsSectionNav({ variant }: SectionNavProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <Stack gap="sm">
      <Button
        component={Link}
        to="/library/channels/new"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        fullWidth={isSidebar}
      >
        New channel
      </Button>
      <Button
        component={Link}
        to="/library/channels/add-from-ukrepeater"
        variant="light"
        leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        fullWidth={isSidebar}
      >
        Add from ukrepeater.net
      </Button>
      <Button
        component={Link}
        to="/library/channels/add-from-brandmeister"
        variant="light"
        leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        fullWidth={isSidebar}
      >
        Add from BrandMeister
      </Button>
      <LibraryNavLinks />
    </Stack>
  );
}
