import { Group, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconPencil } from '@tabler/icons-react';
import type { SatelliteWritePreviewEntry } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { RowActionIcon } from '../../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { SatelliteWireNameOverrideInput } from './SatelliteWireNameOverrideInput.tsx';

export function SatelliteEncodedNameCell({
  entry,
  nameLimit,
  editing,
  committedWireName,
  onStartEdit,
  onCancelEdit,
  onWireNameChange,
}: {
  entry: SatelliteWritePreviewEntry;
  nameLimit: number;
  editing: boolean;
  committedWireName: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onWireNameChange: (wireName: string) => void;
}) {
  if (editing) {
    return (
      <SatelliteWireNameOverrideInput
        key={`${entry.transmitterId}-${committedWireName}`}
        committedWireName={committedWireName}
        suggestedFamiliar={entry.suggestedFamiliarEncoded}
        suggestedOscar={entry.suggestedOscarEncoded}
        nameLimit={nameLimit}
        onWireNameChange={onWireNameChange}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm">{entry.encodedName}</Text>
      {entry.nameTruncated ? (
        <Tooltip label="Shortened to fit the radio's 8-character name field">
          <IconAlertTriangle
            size={14}
            stroke={ICON_STROKE}
            color="var(--mantine-color-orange-6)"
            aria-label="Name truncated"
          />
        </Tooltip>
      ) : null}
      <RowActionIcon
        icon={<IconPencil size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        label="Edit encoded name"
        onClick={onStartEdit}
      />
    </Group>
  );
}
