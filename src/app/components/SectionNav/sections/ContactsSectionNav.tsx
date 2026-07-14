import { useState } from 'react';
import { Button, Stack } from '@mantine/core';
import { IconPlus, IconWorldSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import AddFromDataSourceModal from '../../library/AddFromDataSourceModal.tsx';
import { CONTACT_ADD_SOURCES } from '../../../lib/contactDataSources.ts';
import LibrarySectionNavFrame from './LibrarySectionNavFrame.tsx';

export default function ContactsSectionNav({ variant }: SectionNavProps) {
  const isSidebar = variant === 'sidebar';
  const [addFromOpen, setAddFromOpen] = useState(false);

  return (
    <>
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
          <Button
            variant="light"
            leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            fullWidth={isSidebar}
            onClick={() => setAddFromOpen(true)}
          >
            Add from…
          </Button>
        </Stack>
      </LibrarySectionNavFrame>

      <AddFromDataSourceModal
        opened={addFromOpen}
        onClose={() => setAddFromOpen(false)}
        sources={CONTACT_ADD_SOURCES}
      />
    </>
  );
}
