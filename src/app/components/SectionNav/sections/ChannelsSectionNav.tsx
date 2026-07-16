import { useState } from 'react';
import { Button, NavLink } from '@mantine/core';
import { IconWorldSearch } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import AddFromDataSourceModal from '../../library/AddFromDataSourceModal.tsx';
import EntityListSectionNav from './EntityListSectionNav.tsx';

const CHANNEL_DEFAULTS_PATH = '/library/channels/defaults';

export default function ChannelsSectionNav(props: SectionNavProps) {
  const isSidebar = props.variant === 'sidebar';
  const [addFromOpen, setAddFromOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <EntityListSectionNav
        {...props}
        newPath="/library/channels/new"
        newLabel="New channel"
        extraActions={
          <>
            <Button
              variant="light"
              leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              fullWidth={isSidebar}
              onClick={() => setAddFromOpen(true)}
            >
              Add from…
            </Button>
            <NavLink
              component={Link}
              to={CHANNEL_DEFAULTS_PATH}
              label="Channel defaults"
              active={location.pathname === CHANNEL_DEFAULTS_PATH}
              variant="light"
            />
          </>
        }
      />

      <AddFromDataSourceModal opened={addFromOpen} onClose={() => setAddFromOpen(false)} />
    </>
  );
}
