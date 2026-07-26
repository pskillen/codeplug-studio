import { Anchor, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useZoneEdit } from './ZoneEditContext.tsx';

export default function ZoneEditHeader({
  subtitle,
  backTo,
  backLabel,
}: {
  subtitle: string;
  backTo?: string;
  backLabel?: string;
}) {
  const { previewZone } = useZoneEdit();
  const mainPath = `/library/zones/${previewZone.id}`;

  return (
    <Stack gap={4}>
      <Group gap="xs">
        <Anchor component={Link} to="/library/zones" size="sm">
          ← Back to zones
        </Anchor>
        {backTo && backTo !== mainPath ? (
          <>
            <Text size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={backTo} size="sm">
              {backLabel ?? '← Back to zone'}
            </Anchor>
          </>
        ) : null}
      </Group>
      <Text fw={600}>{previewZone.name || 'Untitled zone'}</Text>
      <Text size="sm" c="dimmed">
        {subtitle}
      </Text>
    </Stack>
  );
}
