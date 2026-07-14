import type { ReactNode } from 'react';
import { useState } from 'react';
import { Stack, Switch, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import type {
  AnytoneWirePreviewBank,
  WirePreviewEntityKind,
  WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import ExportNameModeSelect from '../../../components/builds/ExportNameModeSelect.tsx';
import DigitalContactExportNameModeSelect from '../../../components/builds/DigitalContactExportNameModeSelect.tsx';
import type { DigitalContactExportNameMode } from '@core/import-export/types.ts';
import UseLibraryAbbreviationsSwitch from '../../../components/builds/UseLibraryAbbreviationsSwitch.tsx';
import WirePreviewDataTable from '../../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import type { WirePreviewZoneScanColumnConfig } from '../../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import WirePreviewOverrideModal from '../../../components/builds/wirePreview/WirePreviewOverrideModal.tsx';
import { useSyncedWirePreviewRow } from '../../../components/builds/wirePreview/useSyncedWirePreviewRow.ts';
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
  } = useBuildWirePreview(entityKind, anytoneBank);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const activeRow = useSyncedWirePreviewRow(selectedRowKey, allRows);
  const [search, setSearch] = useState('');
  const exportSettings = resolvedBuildExportSettings(build);

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
        {headerActions}
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        {showExportNameMode ? (
          <ExportNameModeSelect
            value={exportSettings.nameModeOverride}
            onChange={(nameModeOverride) => patchExportSettings({ nameModeOverride })}
            description="Fallback style for channels without an explicit wire name override on this build."
          />
        ) : null}
        {showDigitalContactExportNameMode ? (
          <DigitalContactExportNameModeSelect
            value={exportSettings.digitalContactExportNameMode}
            onChange={(digitalContactExportNameMode) =>
              patchExportSettings({ digitalContactExportNameMode })
            }
          />
        ) : null}
        {showLibraryAbbreviations ? (
          <UseLibraryAbbreviationsSwitch
            shortenNames={exportSettings.shortenNames}
            value={exportSettings.useChannelAbbreviation && exportSettings.useTalkGroupAbbreviation}
            onChange={(useLibraryAbbreviations) =>
              patchExportSettings({
                useChannelAbbreviation: useLibraryAbbreviations,
                useTalkGroupAbbreviation: useLibraryAbbreviations,
              })
            }
          />
        ) : null}
        {beforeTable}
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
          search={search}
          onSearchChange={setSearch}
          onRowActivate={(row) => setSelectedRowKey(row.key)}
          zoneScanColumn={zoneScanColumn}
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
