import { Stack, Text } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';

export interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap="sm" py="lg">
      {icon ?? <IconInbox size={ICON_SIZE_NAV * 2} stroke={ICON_STROKE} opacity={0.5} />}
      <Text c="dimmed" ta="center">
        {message}
      </Text>
      {action}
    </Stack>
  );
}
