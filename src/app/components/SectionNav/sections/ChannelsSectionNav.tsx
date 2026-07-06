import { Button } from '@mantine/core';
import { IconPlaylistAdd, IconWorldSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function ChannelsSectionNav(props: SectionNavProps) {
  const isSidebar = props.variant === 'sidebar';

  return (
    <EntityListSectionNav
      {...props}
      newPath="/library/channels/new"
      newLabel="New channel"
      extraActions={
        <>
          <Button
            component={Link}
            to="/library/channels/add-channel-set"
            variant="light"
            leftSection={<IconPlaylistAdd size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            fullWidth={isSidebar}
          >
            Add channel set…
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
        </>
      }
    />
  );
}
