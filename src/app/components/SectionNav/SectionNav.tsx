import { Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { resolveSectionNav } from '../../nav/sectionNavRegistry.ts';
import type { SectionNavProps } from '../../nav/sectionNavTypes.ts';

export default function SectionNav({ variant }: SectionNavProps) {
  const location = useLocation();
  const entry = resolveSectionNav(location.pathname);
  if (!entry) return null;

  const { title, Component } = entry;

  if (variant === 'toolbar') {
    return (
      <Paper withBorder p="sm" radius="md">
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            {title}
          </Text>
          <Component variant="toolbar" />
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {title}
      </Text>
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        <Component variant="sidebar" />
      </ScrollArea>
    </Stack>
  );
}
