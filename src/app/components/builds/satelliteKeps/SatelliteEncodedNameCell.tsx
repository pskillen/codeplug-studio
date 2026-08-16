import { Group, Text } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import type { SatelliteWritePreviewEntry } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { RowActionIcon } from '../../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { satelliteNameRemediation } from '../../../lib/satelliteWireNameRemediation.ts';
import WireNameInlineEditor from '../wirePreview/WireNameInlineEditor.tsx';
import WireNameRemediationMarker from '../wirePreview/WireNameRemediationMarker.tsx';

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
      <WireNameInlineEditor
        key={`${entry.transmitterId}-${committedWireName}`}
        committedValue={committedWireName}
        suggestions={[
          { label: 'Familiar', value: entry.suggestedFamiliarEncoded },
          ...(entry.suggestedOscarEncoded
            ? [{ label: 'OSCAR', value: entry.suggestedOscarEncoded }]
            : []),
        ]}
        limit={nameLimit}
        autoFocus
        onCommit={onWireNameChange}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm">{entry.encodedName}</Text>
      <WireNameRemediationMarker
        remediation={satelliteNameRemediation(entry.nameTruncated, entry.encodedName, nameLimit)}
        originalName={entry.satelliteName}
        limit={nameLimit}
      />
      <RowActionIcon
        icon={<IconPencil size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        label="Edit encoded name"
        onClick={onStartEdit}
      />
    </Group>
  );
}
