import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { PAGE_HEADER_GAP } from './tokens.ts';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  if (actions) {
    return (
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={PAGE_HEADER_GAP} style={{ flex: 1, minWidth: 0 }}>
          <Title order={1}>{title}</Title>
          {description ? (
            typeof description === 'string' ? (
              <Text c="dimmed">{description}</Text>
            ) : (
              description
            )
          ) : null}
        </Stack>
        {actions}
      </Group>
    );
  }

  return (
    <Stack gap={PAGE_HEADER_GAP}>
      <Title order={1}>{title}</Title>
      {description ? (
        typeof description === 'string' ? (
          <Text c="dimmed">{description}</Text>
        ) : (
          description
        )
      ) : null}
    </Stack>
  );
}
