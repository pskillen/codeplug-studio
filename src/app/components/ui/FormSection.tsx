import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export interface FormSectionProps {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}

export default function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <Stack gap="sm">
      {title ? <Title order={3}>{title}</Title> : null}
      {description ? (
        typeof description === 'string' ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : (
          description
        )
      ) : null}
      <Stack gap="sm">{children}</Stack>
    </Stack>
  );
}
