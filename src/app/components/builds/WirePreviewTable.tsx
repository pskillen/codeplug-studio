import { Fragment, useEffect, useState } from 'react';
import { Stack, Switch, Table, Text, Tooltip } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { ZoneScanExpandPanelProps } from './ZoneScanExportControls.tsx';
import { ZoneScanExpandPanel, ZoneScanRowHeader } from './ZoneScanExportControls.tsx';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';
import WirePreviewDisplayCell from './wirePreview/WirePreviewDisplayCell.tsx';
import { WireNameOverrideInput } from './wirePreview/WireNameOverrideInput.tsx';
import {
  rowEffectivelyIncluded,
  wireNameCommittedValue,
} from './wirePreview/wirePreviewRowUtils.ts';

export { WireNameOverrideInput } from './wirePreview/WireNameOverrideInput.tsx';

/** @deprecated Legacy inline table — retained for unit tests; production uses WirePreviewDataTable. */
export interface ZoneScanWirePreviewContext {
  layout: ZoneGroupingLayout;
  zones: Zone[];
  zoneById: Map<string, Zone>;
  channelById: ZoneScanExpandPanelProps['channelById'];
  zoneBehaviourContext?: ZoneScanExpandPanelProps['zoneBehaviourContext'];
  showScanCarrierControls: boolean;
  scanListMemberCap: number;
  saving: boolean;
  onUpdateZoneEntry: (zoneId: string, patch: Partial<ZoneGroupingZoneEntry>) => void;
  onUpdateMemberScanInclusion: (
    exportedZoneId: string,
    channelId: string,
    includeInScanList: boolean,
  ) => void;
}

export interface WirePreviewTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  clickableDefaultWireName?: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  zoneScanContext?: ZoneScanWirePreviewContext;
}

function WirePreviewExportControls({
  row,
  onExcludedChange,
  onForceIncludeChange,
}: {
  row: WirePreviewRow;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
}) {
  const skippedByLibrary = row.omitFromExport === true;

  if (skippedByLibrary && onForceIncludeChange) {
    return (
      <Stack gap={6}>
        <Tooltip label="Export this zone as its own row in this build, despite the library setting">
          <Switch
            size="xs"
            label="Force export"
            checked={row.forceInclude === true}
            onChange={(event) => onForceIncludeChange(row, event.currentTarget.checked)}
            aria-label={`Force export ${row.displayLabel} as its own zone`}
          />
        </Tooltip>
        {row.forceInclude ? (
          <Switch
            size="xs"
            label="Skip from export"
            checked={row.excluded}
            onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
            aria-label={`Skip ${row.displayLabel} from export`}
          />
        ) : null}
      </Stack>
    );
  }

  return (
    <Switch
      size="xs"
      label="Skip from export"
      checked={row.excluded}
      onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
      aria-label={`Skip ${row.displayLabel} from export`}
    />
  );
}

/** @deprecated Use WirePreviewDataTable + WirePreviewOverrideModal in production routes. */
export default function WirePreviewTable({
  rows,
  nameLimit,
  clickableDefaultWireName = false,
  onExcludedChange,
  onForceIncludeChange,
  onWireNameChange,
  onUnsavedChangesChange,
  zoneScanContext,
}: WirePreviewTableProps) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    onUnsavedChangesChange?.(dirtyKeys.size > 0);
  }, [dirtyKeys, onUnsavedChangesChange]);

  const setRowDirty = (key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      const has = prev.has(key);
      if (dirty === has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleZoneExpanded = (zoneId: string) => {
    setExpandedZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No library entities of this type yet.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Skip from export</Table.Th>
          <Table.Th>Library name</Table.Th>
          <Table.Th>Export name</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => {
          const effectivelyIncluded = rowEffectivelyIncluded(row);
          const zone =
            zoneScanContext && row.entityKind === 'zone'
              ? zoneScanContext.zoneById.get(row.libraryEntityId)
              : undefined;
          const zoneLayoutEntry =
            zoneScanContext && row.entityKind === 'zone'
              ? layoutEntry(zoneScanContext.layout, row.libraryEntityId)
              : undefined;
          const zoneExpanded = expandedZoneIds.has(row.libraryEntityId);

          return (
            <Fragment key={row.key}>
              <Table.Tr opacity={effectivelyIncluded ? 1 : 0.55}>
                <Table.Td>
                  <WirePreviewExportControls
                    row={row}
                    onExcludedChange={onExcludedChange}
                    onForceIncludeChange={onForceIncludeChange}
                  />
                </Table.Td>
                <Table.Td>
                  <WirePreviewDisplayCell row={row} />
                  {zone && zoneScanContext ? (
                    <ZoneScanRowHeader
                      zone={zone}
                      zones={zoneScanContext.zones}
                      entry={zoneLayoutEntry}
                      zoneBehaviourContext={zoneScanContext.zoneBehaviourContext}
                      scanListMemberCap={zoneScanContext.scanListMemberCap}
                      showScanCarrierControls={zoneScanContext.showScanCarrierControls}
                      expanded={zoneExpanded}
                      saving={zoneScanContext.saving}
                      onToggleExpand={() => toggleZoneExpanded(row.libraryEntityId)}
                      onExportScanListChange={(enabled) =>
                        zoneScanContext.onUpdateZoneEntry(row.libraryEntityId, {
                          exportScanList: enabled,
                        })
                      }
                    />
                  ) : null}
                </Table.Td>
                <Table.Td>
                  <WireNameOverrideInput
                    key={`${row.key}:${wireNameCommittedValue(row)}`}
                    row={row}
                    nameLimit={nameLimit}
                    excluded={!effectivelyIncluded}
                    clickableDefaultWireName={clickableDefaultWireName}
                    onWireNameChange={onWireNameChange}
                    onDirtyChange={(dirty) => setRowDirty(row.key, dirty)}
                  />
                </Table.Td>
              </Table.Tr>
              {zone && zoneScanContext && zoneExpanded ? (
                <Table.Tr>
                  <Table.Td colSpan={3} p={0}>
                    <ZoneScanExpandPanel
                      zone={zone}
                      zones={zoneScanContext.zones}
                      entry={zoneLayoutEntry}
                      zoneBehaviourContext={zoneScanContext.zoneBehaviourContext}
                      channelById={zoneScanContext.channelById}
                      showScanCarrierControls={zoneScanContext.showScanCarrierControls}
                      saving={zoneScanContext.saving}
                      onUpdateZoneEntry={(patch) =>
                        zoneScanContext.onUpdateZoneEntry(row.libraryEntityId, patch)
                      }
                      onUpdateMemberScanInclusion={(exportedZoneId, channelId, includeInScanList) =>
                        zoneScanContext.onUpdateMemberScanInclusion(
                          exportedZoneId,
                          channelId,
                          includeInScanList,
                        )
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Fragment>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
