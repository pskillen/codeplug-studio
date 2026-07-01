import type { ComponentType } from 'react';

export type SectionNavVariant = 'sidebar' | 'toolbar';

export interface SectionNavProps {
  variant: SectionNavVariant;
}

export interface SectionNavEntry {
  title: string;
  prefix: string;
  Component: ComponentType<SectionNavProps>;
}
