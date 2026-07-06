import { Badge, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Channel, Zone } from '@core/models/library.ts';
import {
  channelInAnyZoneMembership,
  zonesWithDirectChannelMember,
} from '@core/domain/zoneMembership.ts';

export default function ChannelZonesListCell({
  channel,
  zones,
}: {
  channel: Channel;
  zones: Zone[];
}) {
  const directZones = zonesWithDirectChannelMember(channel.id, zones);

  if (directZones.length === 0) {
    if (!channelInAnyZoneMembership(channel.id, { zones })) {
      return (
        <Badge size="xs" variant="light" color="gray">
          Not in a zone
        </Badge>
      );
    }
    return (
      <Text size="xs" c="dimmed">
        Nested only
      </Text>
    );
  }

  return (
    <Group gap={4} wrap="wrap">
      {directZones.map((zone) => (
        <Badge
          key={zone.id}
          component={Link}
          to={`/library/zones/${zone.id}`}
          size="xs"
          variant="light"
          style={{ cursor: 'pointer' }}
        >
          {zone.name}
        </Badge>
      ))}
    </Group>
  );
}
