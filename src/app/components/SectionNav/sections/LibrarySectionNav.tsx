import { Button, NavLink, Stack } from '@mantine/core';
import { IconPlus, IconWorldSearch } from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { scrollToPageSection } from '../../../lib/scrollToPageSection.ts';
import { LIBRARY_KINDS } from '../../../routes/library/registry.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';

function isChannelRoute(pathname: string): boolean {
  return pathname === '/library' || pathname.startsWith('/library/channels');
}

export default function LibrarySectionNav({ variant }: SectionNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSidebar = variant === 'sidebar';
  const onChannels = isChannelRoute(location.pathname);

  function scrollToKind(slug: string) {
    const scroll = () => scrollToPageSection(`library-${slug}`);
    if (location.pathname !== '/library') {
      navigate('/library');
      setTimeout(scroll, 50);
    } else {
      scroll();
    }
  }

  return (
    <Stack gap="sm">
      {onChannels ? (
        <>
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
        </>
      ) : null}

      <Stack gap={4}>
        {LIBRARY_KINDS.map((meta) => (
          <NavLink
            key={meta.kind}
            component="button"
            type="button"
            label={meta.plural}
            onClick={() => scrollToKind(meta.slug)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
