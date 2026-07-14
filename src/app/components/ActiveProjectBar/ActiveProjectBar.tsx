import { Button, Group, Stack, Text } from '@mantine/core';
import { IconSwitchHorizontal } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useProjects } from '../../state/useProjects.ts';

export interface ActiveProjectBarProps {
  onNavClick?: () => void;
}

export default function ActiveProjectBar({ onNavClick }: ActiveProjectBarProps) {
  const navigate = useNavigate();
  const { activeProject } = useProjects();

  if (!activeProject) return null;

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Active project
          </Text>
          <Text fw={600} truncate>
            {activeProject.name}
          </Text>
        </Stack>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconSwitchHorizontal size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          onClick={() => {
            onNavClick?.();
            navigate('/');
          }}
        >
          Switch
        </Button>
      </Group>
    </Stack>
  );
}
