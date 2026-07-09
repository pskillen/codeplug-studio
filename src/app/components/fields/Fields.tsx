import type { ReactNode } from 'react';
import { Paper, Stack, Text, Title } from '@mantine/core';

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.6rem 0' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3e4c59' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '0.75rem', color: '#7b8794' }}>{hint}</span>}
    </label>
  );
}

export function FieldCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Paper component="section" withBorder p="md" radius="md">
      <Stack gap="sm">
        <Stack gap={4}>
          <Title order={4}>{title}</Title>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        <Stack gap="sm">{children}</Stack>
      </Stack>
    </Paper>
  );
}
