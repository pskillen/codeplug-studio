import { SimpleGrid } from '@mantine/core';
import type { ReactNode } from 'react';
import { PAGE_SECTION_GRID_COLS, PAGE_SECTION_GRID_SPACING } from './tokens.ts';

export interface PageSectionGridProps {
  children: ReactNode;
}

export default function PageSectionGrid({ children }: PageSectionGridProps) {
  return (
    <SimpleGrid cols={PAGE_SECTION_GRID_COLS} spacing={PAGE_SECTION_GRID_SPACING}>
      {children}
    </SimpleGrid>
  );
}
