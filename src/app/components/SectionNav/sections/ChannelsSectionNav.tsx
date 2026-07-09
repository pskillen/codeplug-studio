import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconWorldSearch } from '@tabler/icons-react';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import AddFromDataSourceModal from '../../library/AddFromDataSourceModal.tsx';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function ChannelsSectionNav(props: SectionNavProps) {
  const isSidebar = props.variant === 'sidebar';
  const [addFromOpen, setAddFromOpen] = useState(false);

  return (
    <>
      <EntityListSectionNav
        {...props}
        newPath="/library/channels/new"
        newLabel="New channel"
        extraActions={
          <Button
            variant="light"
            leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            fullWidth={isSidebar}
            onClick={() => setAddFromOpen(true)}
          >
            Add from…
          </Button>
        }
      />

      <AddFromDataSourceModal opened={addFromOpen} onClose={() => setAddFromOpen(false)} />
    </>
  );
}
