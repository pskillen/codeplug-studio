import type { ReactNode } from 'react';
import { useState } from 'react';
import { Stack, Switch, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import type { WirePreviewEntityKind, WirePreviewRow } from '@core/services/previewWireRows.ts';
import ExportNameModeSelect from '../../components/builds/ExportNameModeSelect.tsx';
import UseLibraryAbbreviationsSwitch from '../../components/builds/UseLibraryAbbreviationsSwitch.tsx';
import WirePreviewDataTable from '../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import WirePreviewOverrideModal from '../../components/builds/wirePreview/WirePreviewOverrideModal.tsx';
import { FormPage } from '../../components/ui/index.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { useBuildWirePreview } from '../../hooks/useBuildWirePreview.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import type { AnytoneWirePreviewBank } from '@core/services/previewWireRows.ts';

const buildService = new BuildService(persistence);

export interface BuildWirePreviewListPageProps {
  title: string;
  entityKind: WirePreviewEntityKind;
  description?: string;
  showExportNameMode?: boolean;
  showLibraryAbbreviations?: boolean;
  beforeTable?: ReactNode;
  headerActions?: ReactNode;
  anytoneBank?: AnytoneWirePreviewBank;
  modalExtraSections?: (row: WirePreviewRow) => ReactNode;
}

export default function BuildWirePreviewListPage({
  title,
  entityKind,
  description,
  showExportNameMode = false,
  showLibraryAbbreviations = false,
  beforeTable,
  headerActions,
  anytoneBank = 'dmr',
  modalExtraSections,
}: BuildWirePreviewListPageProps) {
  const {
    build,
    rows,
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
  const [selectedRow, setSelectedRow] = useState<WirePreviewRow | null>(null);
  const [search, setSearch] = useState('');
  const exportSettings = resolvedBuildExportSettings(build);

  function patchExportSettings(
    patch: Partial<{
      nameModeOverride: ChannelExportNameMode;
      useChannelAbbreviation: boolean;
      useTalkGroupAbbreviation: boolean;
    }>,
  ) {
    void persistBuild((current) => buildService.withExportSettings(current, patch));
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
      <Stack gap="md">
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
          onRowActivate={setSelectedRow}
        />
      </Stack>
      <WirePreviewOverrideModal
        opened={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
        row={selectedRow}
        build={build}
        entityKind={entityKind}
        nameLimit={nameLimit}
        onExcludedChange={setRowExcluded}
        onForceIncludeChange={entityKind === 'zone' ? setRowForceIncluded : undefined}
        onWireNameChange={setRowWireName}
        extraSections={selectedRow && modalExtraSections ? modalExtraSections(selectedRow) : null}
      />
    </FormPage>
  );
}
