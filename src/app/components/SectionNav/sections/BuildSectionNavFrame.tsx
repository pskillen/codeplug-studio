import { Divider, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import BuildSwitcher from '../../builds/BuildSwitcher/BuildSwitcher.tsx';
import BuildNavLinks from './BuildNavLinks.tsx';

export default function BuildSectionNavFrame({ children }: { children?: ReactNode }) {
  return (
    <Stack gap="sm">
      <BuildSwitcher />
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
