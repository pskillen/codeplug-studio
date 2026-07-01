import { Burger, Group, Text } from '@mantine/core';

export interface AppHeaderProps {
  opened: boolean;
  onToggle: () => void;
  title?: string;
}

export default function AppHeader({
  opened,
  onToggle,
  title = 'MM9PDY Codeplug Studio',
}: AppHeaderProps) {
  return (
    <Group h="100%" px="md">
      <Burger opened={opened} onClick={onToggle} hiddenFrom="sm" size="sm" />
      <Text fw={600}>{title}</Text>
    </Group>
  );
}
