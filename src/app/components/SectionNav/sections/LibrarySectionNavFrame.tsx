import { Divider, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import LibraryNavLinks from './LibraryNavLinks.tsx';

export default function LibrarySectionNavFrame({ children }: { children: ReactNode }) {
  return (
    <Stack gap="sm">
      <LibraryNavLinks />
      <Divider />
      {children}
    </Stack>
  );
}
