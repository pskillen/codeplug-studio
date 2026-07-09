import {
  ActionIcon,
  Anchor,
  Badge,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { libraryEditPathForWirePreviewRow } from '../../lib/wirePreviewRowLinks.ts';
import ZoneMemberSummaryBadges from '../library/ZoneMemberSummaryBadges.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import type { ZoneScanExpandPanelProps } from './ZoneScanExportControls.tsx';
import { ZoneScanExpandPanel, ZoneScanRowHeader } from './ZoneScanExportControls.tsx';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';

export interface ZoneScanWirePreviewContext {
  layout: ZoneGroupingLayout;
  zones: Zone[];
  zoneById: Map<string, Zone>;
  channelById: ZoneScanExpandPanelProps['channelById'];
  isDm32: boolean;
  showScanCarrierControls: boolean;
  scanListMemberCap: number;
  saving: boolean;
  onUpdateZoneEntry: (zoneId: string, patch: Partial<ZoneGroupingZoneEntry>) => void;
  onUpdateMemberScanInclusion: (
    ownerZoneId: string,
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

function wireNameCommittedValue(row: WirePreviewRow): string {
  return row.hasWireNameOverride ? row.effectiveWireName : '';
}

export function WireNameOverrideInput({
  row,
  nameLimit,
  excluded,
  clickableDefaultWireName,
  onWireNameChange,
  onDirtyChange,
}: {
  row: WirePreviewRow;
  nameLimit?: number;
  excluded: boolean;
  clickableDefaultWireName?: boolean;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const committed = wireNameCommittedValue(row);
  const [draft, setDraft] = useState(committed);
  const dirty = draft !== committed;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const tooLong = nameLimit != null && draft.length > nameLimit;

  const apply = () => {
    onWireNameChange(row, draft);
  };

  const revert = () => {
    setDraft(committed);
  };

  const applyDefault = () => {
    setDraft(row.generatedWireName);
    onWireNameChange(row, row.generatedWireName);
  };

  return (
    <>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          flex={1}
          size="xs"
          placeholder={row.generatedWireName}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty && !tooLong && !excluded) {
              event.preventDefault();
              apply();
            }
            if (event.key === 'Escape' && dirty) {
              event.preventDefault();
              revert();
            }
          }}
          disabled={excluded}
          error={tooLong ? `Exceeds ${nameLimit} characters` : undefined}
        />
        {dirty ? (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Apply wire name">
              <ActionIcon
                variant="light"
                color="green"
                size="sm"
                aria-label="Apply wire name"
                disabled={tooLong || excluded}
                onClick={apply}
              >
                <IconCheck size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Revert wire name">
              <ActionIcon
                variant="light"
                color="gray"
                size="sm"
                aria-label="Revert wire name"
                onClick={revert}
              >
                <IconX size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed">
        Default:{' '}
        {clickableDefaultWireName ? (
          <Tooltip label="Store this name as an explicit override">
            <UnstyledButton
              component="button"
              type="button"
              disabled={excluded}
              onClick={applyDefault}
              style={{
                color: 'var(--mantine-color-dimmed)',
                textDecoration: 'underline',
                cursor: excluded ? 'not-allowed' : 'pointer',
              }}
            >
              {row.generatedWireName}
            </UnstyledButton>
          </Tooltip>
        ) : (
          row.generatedWireName
        )}
      </Text>
    </>
  );
}

function rowEffectivelyIncluded(row: WirePreviewRow): boolean {
  return !row.excluded && (row.forceInclude === true || row.omitFromExport !== true);
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

function WirePreviewDisplayCell({ row }: { row: WirePreviewRow }) {
  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm">{row.displayLabel}</Text>
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
          <Anchor component={Link} to={libraryPath} size="xs">
            Edit in library
          </Anchor>
        ) : null;
      })()}
    </Stack>
  );
}

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
                      channelById={zoneScanContext.channelById}
                      isDm32={zoneScanContext.isDm32}
                      showScanCarrierControls={zoneScanContext.showScanCarrierControls}
                      saving={zoneScanContext.saving}
                      onUpdateZoneEntry={(patch) =>
                        zoneScanContext.onUpdateZoneEntry(row.libraryEntityId, patch)
                      }
                      onUpdateMemberScanInclusion={(ownerZoneId, channelId, includeInScanList) =>
                        zoneScanContext.onUpdateMemberScanInclusion(
                          ownerZoneId,
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
