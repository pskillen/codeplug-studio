import { Button, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import LibrarySectionNavFrame from './LibrarySectionNavFrame.tsx';

export default function ContactsSectionNav({ variant }: SectionNavProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <LibrarySectionNavFrame>
      <Stack gap="sm">
        <Button
          component={Link}
          to="/library/digital-contacts/new"
          leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New digital contact
        </Button>
        <Button
          component={Link}
          to="/library/analog-contacts/new"
          variant="light"
          leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New analog contact
        </Button>
      </Stack>
    </LibrarySectionNavFrame>
  );
}
