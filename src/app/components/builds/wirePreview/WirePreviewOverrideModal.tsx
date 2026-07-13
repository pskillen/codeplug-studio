import { Modal, Stack, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { WirePreviewEntityKind, WirePreviewRow } from '@core/services/previewWireRows.ts';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';
import { resolveOverrideModalSections } from './resolveOverrideModalSections.tsx';

export interface WirePreviewOverrideModalProps {
  opened: boolean;
  onClose: () => void;
  row: WirePreviewRow | null;
  build: FormatBuild;
  entityKind: WirePreviewEntityKind;
  nameLimit?: number;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  extraSections?: React.ReactNode;
}

export default function WirePreviewOverrideModal({
  opened,
  onClose,
  row,
  build,
  entityKind,
  nameLimit,
  onExcludedChange,
  onForceIncludeChange,
  onWireNameChange,
  extraSections,
}: WirePreviewOverrideModalProps) {
  if (!row) return null;

  const sections = resolveOverrideModalSections({
    row,
    build,
    entityKind,
    nameLimit,
    onExcludedChange,
    onForceIncludeChange,
    onWireNameChange,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Edit export overrides — ${row.displayLabel}`}
      size="lg"
    >
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Library entity
          </Text>
          <WirePreviewDisplayCell row={row} />
        </Stack>
        {sections}
        {extraSections}
      </Stack>
    </Modal>
  );
}
