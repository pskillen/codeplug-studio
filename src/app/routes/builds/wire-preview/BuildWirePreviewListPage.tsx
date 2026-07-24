import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Stack, Switch, Text, Group } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import {
  exportOrderResetConfirmMessage,
  hasAnyOrderOrSlotOverride,
} from '@core/domain/exportOrderOrSlot.ts';
import {
  buildExportSortConfirmMessage,
  type MembershipSortMode,
} from '@core/domain/membershipSort.ts';
import type { DigitalContactExportNameMode } from '@core/import-export/types.ts';
import type {
  AnytoneWirePreviewBank,
  WirePreviewEntityKind,
  WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import MembershipSortMenu from '../../../components/library/MembershipSortMenu.tsx';
import ExportOrderOverrideBanner from '../../../components/builds/wirePreview/ExportOrderOverrideBanner.tsx';
import WirePreviewDataTable from '../../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import type { WirePreviewZoneScanColumnConfig } from '../../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import WirePreviewOverrideModal from '../../../components/builds/wirePreview/WirePreviewOverrideModal.tsx';
import { useSyncedWirePreviewRow } from '../../../components/builds/wirePreview/useSyncedWirePreviewRow.ts';
import BuildEntityExportSettingsCard, {
  type BuildEntityInclusionField,
} from '../../../components/builds/BuildEntityExportSettingsCard.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { resolvedBuildExportSettings } from '../../../lib/buildExportSettingsUi.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { BuildService } from '../../../state/buildService.ts';
import { persistence } from '../../../state/persistence.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

const buildService = new BuildService(persistence);

export interface BuildWirePreviewListPageProps {
  title: string;
  entityKind: WirePreviewEntityKind;
  description?: string;
  showExportNameMode?: boolean;
  showDigitalContactExportNameMode?: boolean;
  showLibraryAbbreviations?: boolean;
  beforeTable?: ReactNode;
  headerActions?: ReactNode;
  anytoneBank?: AnytoneWirePreviewBank;
  modalExtraSections?: (row: WirePreviewRow) => ReactNode;
  /** Zone override modal Members tab content. */
  modalMembersSection?: (row: WirePreviewRow) => ReactNode;
  /** Zone override modal Scan tab content (trait-gated by caller). */
  modalScanSection?: (row: WirePreviewRow) => ReactNode;
  zoneScanColumn?: WirePreviewZoneScanColumnConfig;
  /** When true, render list content only (no FormPage shell). */
  embedded?: boolean;
}

function BuildWirePreviewListContent({
  title,
  entityKind,
  description,
  showExportNameMode = false,
  showDigitalContactExportNameMode = false,
  showLibraryAbbreviations = false,
  beforeTable,
  headerActions,
  anytoneBank = 'dmr',
  modalExtraSections,
  modalMembersSection,
  modalScanSection,
  zoneScanColumn,
}: BuildWirePreviewListPageProps) {
  const {
    build,
    rows,
    allRows,
    hiddenRowCount,
    hideNotIncludedInExport,
    setHideNotIncludedInExport,
    hasWirePreviewEntities,
    nameLimit,
    error,
    setRowExcluded,
    setRowForceIncluded,
    setRowWireName,
    persistBuild,
    moveEntity,
    clearEntityOrderOverrides,
    setEntityOrder,
    saving,
  } = useBuildWirePreview(entityKind, anytoneBank);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [reorderSelectedKeys, setReorderSelectedKeys] = useState<string[]>([]);
  const activeRow = useSyncedWirePreviewRow(selectedRowKey, allRows);
  const [search, setSearch] = useState('');
  const exportSettings = resolvedBuildExportSettings(build);
  const zoneReorderEnabled = entityKind === 'zone';
  const zoneOrderOverridden = useMemo(
    () => zoneReorderEnabled && hasAnyOrderOrSlotOverride(build.zoneOverrides),
    [zoneReorderEnabled, build.zoneOverrides],
  );

  function handleResetZoneOrder() {
    if (!window.confirm(exportOrderResetConfirmMessage())) return;
    clearEntityOrderOverrides();
  }

  function handleSortZonesForBuild(mode: MembershipSortMode) {
    if (mode !== 'name') return;
    const orderedIds = [...allRows]
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
      .map((row) => row.key);
    setEntityOrder(orderedIds);
  }

  const zoneReorderBlocked = saving || hideNotIncludedInExport || search.trim().length > 0;

  function patchExportSettings(
    patch: Partial<{
      nameModeOverride: ChannelExportNameMode;
      digitalContactExportNameMode: DigitalContactExportNameMode;
      useChannelAbbreviation: boolean;
      useTalkGroupAbbreviation: boolean;
    }>,
  ) {
    void persistBuild((current) => buildService.withExportSettings(current, patch));
  }

  function patchExportInclusion(field: BuildEntityInclusionField, checked: boolean) {
    void persistBuild((current) =>
      buildService.withExportInclusionFlags(current, { [field]: checked }),
    );
  }

  const showEntitySettingsCard =
    entityKind === 'channel' ||
    entityKind === 'talkGroup' ||
    entityKind === 'contact' ||
    entityKind === 'rxGroupList';

  return (
    <>
      <Stack gap="md">
        {title ? (
          <Text size="lg" fw={600}>
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        {showEntitySettingsCard ? (
          <BuildEntityExportSettingsCard
            build={build}
            entityKind={entityKind}
            saving={saving}
            exportSettings={exportSettings}
            showExportNameMode={showExportNameMode}
            showDigitalContactExportNameMode={showDigitalContactExportNameMode}
            showLibraryAbbreviations={showLibraryAbbreviations}
            onExportSettingsPatch={patchExportSettings}
            onExportInclusionChange={patchExportInclusion}
            actions={headerActions}
          />
        ) : (
          headerActions
        )}
        {beforeTable}
        {zoneReorderEnabled ? (
          <Group gap="sm" align="center">
            <MembershipSortMenu
              label="Sort zones…"
              modes={['name']}
              disabled={zoneReorderBlocked}
              confirmMessage={buildExportSortConfirmMessage}
              onSort={handleSortZonesForBuild}
            />
            {zoneReorderBlocked ? (
              <Text size="xs" c="dimmed">
                Clear search and show all zones to sort or reorder.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                Sorts this build’s zone export order only — not your library.
              </Text>
            )}
          </Group>
        ) : null}
        <ExportOrderOverrideBanner
          visible={zoneOrderOverridden}
          disabled={saving}
          onReset={handleResetZoneOrder}
        />
        {hasWirePreviewEntities ? (
          <Stack gap={4}>
            <Switch
              label="Hide items not to be included in export"
              checked={hideNotIncludedInExport}
              onChange={(event) => setHideNotIncludedInExport(event.currentTarget.checked)}
            />
            <Text size="xs" c="dimmed">
              Respects skip toggles on this page and{' '}
              <Link to={`/builds/${build.id}/export`}>Export inclusion</Link> on the export page for
              orphan channels, talk groups, and RX group lists.
              {hideNotIncludedInExport && hiddenRowCount > 0 ? ` (${hiddenRowCount} hidden)` : null}
            </Text>
          </Stack>
        ) : null}
        <WirePreviewDataTable
          rows={rows}
          entityKind={entityKind}
          search={search}
          onSearchChange={setSearch}
          onRowActivate={(row) => setSelectedRowKey(row.key)}
          channelOverrides={build.channelOverrides}
          zoneScanColumn={zoneScanColumn}
          inclusionColumn={{
            saving,
            onExcludedChange: setRowExcluded,
            onForceIncludeChange: entityKind === 'zone' ? setRowForceIncluded : undefined,
          }}
          reorder={
            zoneReorderEnabled
              ? {
                  orderedKeys: allRows.map((row) => row.key),
                  onMove: moveEntity,
                  onSetOrder: setEntityOrder,
                  disabled: zoneReorderBlocked,
                  bulkReorder: true,
                }
              : undefined
          }
          selectedKeys={zoneReorderEnabled ? reorderSelectedKeys : undefined}
          onSelectedKeysChange={zoneReorderEnabled ? setReorderSelectedKeys : undefined}
        />
      </Stack>
      <WirePreviewOverrideModal
        opened={selectedRowKey !== null}
        onClose={() => setSelectedRowKey(null)}
        row={activeRow}
        build={build}
        entityKind={entityKind}
        nameLimit={nameLimit}
        onExcludedChange={setRowExcluded}
        onForceIncludeChange={entityKind === 'zone' ? setRowForceIncluded : undefined}
        onWireNameChange={setRowWireName}
        extraSections={activeRow && modalExtraSections ? modalExtraSections(activeRow) : null}
        membersSection={activeRow && modalMembersSection ? modalMembersSection(activeRow) : null}
        scanSection={activeRow && modalScanSection ? modalScanSection(activeRow) : null}
      />
    </>
  );
}

export default function BuildWirePreviewListPage({
  embedded,
  title,
  ...props
}: BuildWirePreviewListPageProps) {
  const { build } = useBuildLayout();

  if (embedded) {
    return <BuildWirePreviewListContent title={title} {...props} />;
  }

  return (
    <FormPage
      title={title}
      description={
        <Link
          to={`/builds/${build.id}/overview`}
          style={{ fontSize: 'var(--mantine-font-size-sm)' }}
        >
          ← {build.name}
        </Link>
      }
    >
      <BuildWirePreviewListContent title="" {...props} />
    </FormPage>
  );
}
