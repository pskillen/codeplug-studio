import { Divider, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import BuildNavLinks from './BuildNavLinks.tsx';

export default function BuildSectionNavFrame({ children }: { children?: ReactNode }) {
  return (
    <Stack gap="sm">
      <BuildNavLinks />
      {children ? (
        <>
          <Divider />
          {children}
        </>
      ) : null}
    </Stack>
  );
}
