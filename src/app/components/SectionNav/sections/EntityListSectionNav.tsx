import { Button, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import LibrarySectionNavFrame from './LibrarySectionNavFrame.tsx';

export interface EntityListSectionNavProps extends SectionNavProps {
  newPath: string;
  newLabel: string;
  extraActions?: ReactNode;
}

export default function EntityListSectionNav({
  variant,
  newPath,
  newLabel,
  extraActions,
}: EntityListSectionNavProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <LibrarySectionNavFrame>
      <Stack gap="sm">
        <Button
          component={Link}
          to={newPath}
          leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          {newLabel}
        </Button>
        {extraActions}
      </Stack>
    </LibrarySectionNavFrame>
  );
}
