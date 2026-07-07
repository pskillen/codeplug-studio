import type { ReactNode } from 'react';
import { Button, Group, Modal, Stack, Switch, Text } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import ExportNameModeSelect from '../../../components/builds/ExportNameModeSelect.tsx';
import UseChannelAbbreviationSwitch from '../../../components/builds/UseChannelAbbreviationSwitch.tsx';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { resolvedBuildExportSettings } from '../../../lib/buildExportSettingsUi.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import { BuildService } from '../../../state/buildService.ts';
import { persistence } from '../../../state/persistence.ts';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';

const buildService = new BuildService(persistence);

export interface BuildEntityWirePageProps {
  title: string;
  entityKind: WirePreviewEntityKind;
  description?: string;
  showExportNameMode?: boolean;
  showChannelAbbreviation?: boolean;
  clickableDefaultWireName?: boolean;
  beforeTable?: ReactNode;
}

export default function BuildEntityWirePage({
  title,
  entityKind,
  description,
  showExportNameMode = false,
  showChannelAbbreviation = false,
  clickableDefaultWireName = true,
  beforeTable,
}: BuildEntityWirePageProps) {
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
    setRowWireName,
    persistBuild,
  } = useBuildWirePreview(entityKind);
  const [hasUnsavedWireNames, setHasUnsavedWireNames] = useState(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);
  const exportSettings = resolvedBuildExportSettings(build);

  function patchExportSettings(
    patch: Partial<{
      nameModeOverride: ChannelExportNameMode;
      useChannelAbbreviation: boolean;
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
        {showChannelAbbreviation ? (
          <UseChannelAbbreviationSwitch
            shortenNames={exportSettings.shortenNames}
            value={exportSettings.useChannelAbbreviation}
            onChange={(useChannelAbbreviation) => patchExportSettings({ useChannelAbbreviation })}
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
              Respects include toggles on this page and{' '}
              <Link to={`/builds/${build.id}/export`}>Export inclusion</Link> on the export page for
              orphan channels, talk groups, and RX group lists.
              {hideNotIncludedInExport && hiddenRowCount > 0 ? ` (${hiddenRowCount} hidden)` : null}
            </Text>
          </Stack>
        ) : null}
        <WirePreviewTable
          rows={rows}
          nameLimit={nameLimit}
          clickableDefaultWireName={clickableDefaultWireName}
          onExcludedChange={setRowExcluded}
          onWireNameChange={setRowWireName}
          onUnsavedChangesChange={setHasUnsavedWireNames}
        />
      </Stack>
      <Modal opened={modalOpen} onClose={stay} title="Unsaved wire name changes" centered>
        <Stack gap="sm">
          <Text size="sm">You have unsaved wire name edits. Leave without saving?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={stay}>
              Stay
            </Button>
            <Button color="red" onClick={leave}>
              Leave
            </Button>
          </Group>
        </Stack>
      </Modal>
    </FormPage>
  );
}
