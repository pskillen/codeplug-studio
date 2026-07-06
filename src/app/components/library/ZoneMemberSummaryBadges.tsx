import { Badge, Stack, Text, Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';

const TOOLTIP_NAME_LIMIT = 6;

function memberTooltipContent(names: string[]): ReactNode {
  if (!names.length) return null;
  const head = names.slice(0, TOOLTIP_NAME_LIMIT);
  const more = names.length - head.length;
  return (
    <Stack gap={2}>
      {head.map((name) => (
        <Text key={name} size="xs">
          {name}
        </Text>
      ))}
      {more > 0 ? (
        <Text size="xs" c="dimmed">
          + {more} more
        </Text>
      ) : null}
    </Stack>
  );
}

function countBadge(count: number, singular: string, plural: string, names: string[]): ReactNode {
  if (count <= 0) return null;
  const label = `${count} ${count === 1 ? singular : plural}`;
  return (
    <Tooltip label={memberTooltipContent(names)} disabled={!names.length}>
      <Badge size="xs" variant="light">
        {label}
      </Badge>
    </Tooltip>
  );
}

export interface ZoneMemberSummaryBadgesProps {
  channelCount: number;
  zoneCount: number;
  channelNames?: string[];
  zoneNames?: string[];
}

export default function ZoneMemberSummaryBadges({
  channelCount,
  zoneCount,
  channelNames = [],
  zoneNames = [],
}: ZoneMemberSummaryBadgesProps) {
  if (channelCount <= 0 && zoneCount <= 0) return null;

  return (
    <>
      {countBadge(channelCount, 'channel', 'channels', channelNames)}
      {countBadge(zoneCount, 'zone', 'zones', zoneNames)}
    </>
  );
}
