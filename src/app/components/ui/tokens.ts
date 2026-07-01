import type { MantineSize } from '@mantine/core';

/** Page width variants mapped to Mantine Container sizes. */
export type PageWidth = 'narrow' | 'default' | 'wide';

export const PAGE_CONTAINER_SIZE: Record<PageWidth, MantineSize> = {
  narrow: 'sm',
  default: 'lg',
  wide: 'xl',
};

export const PAGE_STACK_GAP = 'lg' as const;
export const PAGE_HEADER_GAP = 'xs' as const;
export const PAGE_SECTION_GAP = 'md' as const;
export const PAGE_SECTION_HEADER_GAP = 4 as const;
export const PAGE_SECTION_PADDING = 'md' as const;
export const PAGE_SECTION_RADIUS = 'md' as const;
export const PAGE_SECTION_GRID_COLS = { base: 1, md: 2 } as const;
export const PAGE_SECTION_GRID_SPACING = 'lg' as const;
