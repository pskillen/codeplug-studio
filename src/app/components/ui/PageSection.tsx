import { Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import {
  PAGE_SECTION_GAP,
  PAGE_SECTION_HEADER_GAP,
  PAGE_SECTION_PADDING,
  PAGE_SECTION_RADIUS,
} from './tokens.ts';

export interface PageSectionProps {
  id?: string;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}

export default function PageSection({ id, title, description, children }: PageSectionProps) {
  return (
    <Paper id={id} withBorder p={PAGE_SECTION_PADDING} radius={PAGE_SECTION_RADIUS}>
      <Stack gap={PAGE_SECTION_GAP}>
        {title || description ? (
          <Stack gap={PAGE_SECTION_HEADER_GAP}>
            {title ? <Title order={2}>{title}</Title> : null}
            {description ? (
              typeof description === 'string' ? (
                <Text size="sm" c="dimmed">
                  {description}
                </Text>
              ) : (
                description
              )
            ) : null}
          </Stack>
        ) : null}
        {children}
      </Stack>
    </Paper>
  );
}
