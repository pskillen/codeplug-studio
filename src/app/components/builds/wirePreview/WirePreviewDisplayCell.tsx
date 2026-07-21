import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { libraryEditPathForWirePreviewRow } from '../../../lib/wirePreviewRowLinks.ts';
import ZoneMemberSummaryBadges from '../../library/ZoneMemberSummaryBadges.tsx';
import { BandPillsForFrequencies } from '../../pills/BandPill.tsx';
import { wirePreviewExportStatusLabel } from './wirePreviewRowUtils.ts';

export default function WirePreviewDisplayCell({ row }: { row: WirePreviewRow }) {
  const statusLabel = wirePreviewExportStatusLabel(row);

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm">{row.displayLabel}</Text>
        {row.entityKind === 'channel' ? (
          <BandPillsForFrequencies
            rxFrequency={row.rxFrequency ?? null}
            txFrequency={row.txFrequency ?? null}
            size="xs"
          />
        ) : null}
        {row.zoneDirectMembers ? (
          <Group gap={4} wrap="wrap">
            <ZoneMemberSummaryBadges
              channelCount={row.zoneDirectMembers.channelCount}
              zoneCount={row.zoneDirectMembers.zoneCount}
              channelNames={row.zoneDirectMembers.channelNames}
              zoneNames={row.zoneDirectMembers.zoneNames}
            />
          </Group>
        ) : null}
        {row.omitFromExport ? (
          <Badge size="xs" variant="light" color="gray">
            Not exported as zone
          </Badge>
        ) : null}
        {statusLabel === 'Skipped' ? (
          <Badge size="xs" variant="light" color="orange">
            Skipped
          </Badge>
        ) : null}
      </Group>
      {row.displayDetails?.map((line) => (
        <Text key={line.label} size="xs" c="dimmed">
          {line.label}: {line.value}
        </Text>
      ))}
      {row.expansionNote && !row.displayDetails?.length ? (
        <Text size="xs" c="dimmed">
          {row.expansionNote}
        </Text>
      ) : null}
      {(() => {
        const libraryPath = libraryEditPathForWirePreviewRow(row);
        return libraryPath ? (
          <Anchor component={Link} to={libraryPath} size="xs" onClick={(e) => e.stopPropagation()}>
            Edit in library
          </Anchor>
        ) : null;
      })()}
    </Stack>
  );
}
