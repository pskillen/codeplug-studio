import { Container, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { PAGE_CONTAINER_SIZE, PAGE_STACK_GAP, type PageWidth } from './tokens.ts';

export interface PageProps {
  children: ReactNode;
  width?: PageWidth;
}

export default function Page({ children, width = 'default' }: PageProps) {
  return (
    <Container size={PAGE_CONTAINER_SIZE[width]} py="md">
      <Stack gap={PAGE_STACK_GAP}>{children}</Stack>
    </Container>
  );
}
