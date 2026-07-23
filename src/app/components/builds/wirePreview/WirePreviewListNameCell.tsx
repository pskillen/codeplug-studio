import { ActionIcon, Badge, Group, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { BandPillsForFrequencies } from '../../pills/BandPill.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { WirePreviewTableRow } from './groupWirePreviewChannelRows.ts';

export interface WirePreviewListNameCellProps {
  row: WirePreviewTableRow;
  nestExpanded?: boolean;
  onToggleNest?: () => void;
}

/** Library label column for wire preview tables — includes expansion context (e.g. talk group). */
export default function WirePreviewListNameCell({
  row,
  nestExpanded = true,
  onToggleNest,
}: WirePreviewListNameCellProps) {
  const isParent = row.nestRole === 'parent';
  const isChild = row.nestRole === 'child';

  return (
    <Stack gap={2} pl={isChild ? 'md' : undefined}>
      <Group gap="xs" wrap="wrap" align="center">
        {isParent && onToggleNest ? (
          <ActionIcon
            variant="subtle"
            size="sm"
            aria-label={
              nestExpanded
                ? `Collapse projections for ${row.displayLabel}`
                : `Expand projections for ${row.displayLabel}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleNest();
            }}
          >
            {nestExpanded ? (
              <IconChevronDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            ) : (
              <IconChevronRight size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            )}
          </ActionIcon>
        ) : null}
        <Text size="sm" fw={isParent ? 600 : 500}>
          {row.displayLabel}
        </Text>
        {isParent && row.nestChildCount != null ? (
          <Badge size="sm" variant="light" color="gray">
            {row.nestChildCount} projections
          </Badge>
        ) : null}
        {row.entityKind === 'channel' ? (
          <BandPillsForFrequencies
            rxFrequency={row.rxFrequency ?? null}
            txFrequency={row.txFrequency ?? null}
            size="xs"
          />
        ) : null}
      </Group>
      {!isParent
        ? row.displayDetails
            ?.filter((line) => line.label !== 'Channel')
            .map((line) => (
              <Text key={line.label} size="xs" c="dimmed">
                {line.label}: {line.value}
              </Text>
            ))
        : null}
      {!isParent && row.expansionNote && !row.displayDetails?.length ? (
        <Text size="xs" c="dimmed">
          {row.expansionNote}
        </Text>
      ) : null}
    </Stack>
  );
}
