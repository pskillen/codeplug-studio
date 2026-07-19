import { Modal, Stack, Tabs, Text } from '@mantine/core';
import type { ReactNode } from 'react';
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
  /** Non-tabbed append (e.g. channel expansion context, CHIRP scan). */
  extraSections?: ReactNode;
  /** Zone modal Members tab — member export order. */
  membersSection?: ReactNode;
  /** Zone modal Scan tab — zone-derived scan export (trait-gated by caller). */
  scanSection?: ReactNode;
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
  membersSection,
  scanSection,
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

  const useZoneTabs =
    entityKind === 'zone' && (membersSection != null || scanSection != null);

  const libraryHeader = (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        Library entity
      </Text>
      <WirePreviewDisplayCell row={row} />
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Edit export overrides — ${row.displayLabel}`}
      size="lg"
    >
      {useZoneTabs ? (
        <Tabs defaultValue="export">
          <Tabs.List>
            <Tabs.Tab value="export">Export</Tabs.Tab>
            {membersSection != null ? <Tabs.Tab value="members">Members</Tabs.Tab> : null}
            {scanSection != null ? <Tabs.Tab value="scan">Scan</Tabs.Tab> : null}
          </Tabs.List>

          <Tabs.Panel value="export" pt="md">
            <Stack gap="lg">
              {libraryHeader}
              {sections}
            </Stack>
          </Tabs.Panel>

          {membersSection != null ? (
            <Tabs.Panel value="members" pt="md">
              {membersSection}
            </Tabs.Panel>
          ) : null}

          {scanSection != null ? (
            <Tabs.Panel value="scan" pt="md">
              {scanSection}
            </Tabs.Panel>
          ) : null}
        </Tabs>
      ) : (
        <Stack gap="lg">
          {libraryHeader}
          {sections}
          {extraSections}
        </Stack>
      )}
    </Modal>
  );
}
