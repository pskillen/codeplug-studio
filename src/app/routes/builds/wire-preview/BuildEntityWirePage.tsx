import type { ReactNode } from 'react';
import { Button, Group, Modal, Stack, Switch, Text } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ExportNameModeSelect from '../../../components/builds/ExportNameModeSelect.tsx';
import UseChannelAbbreviationSwitch from '../../../components/builds/UseChannelAbbreviationSwitch.tsx';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';

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
  } = useBuildWirePreview(entityKind);
  const [hasUnsavedWireNames, setHasUnsavedWireNames] = useState(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

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
          <ExportNameModeSelect description="Fallback style for channels without an explicit wire name override on this build." />
        ) : null}
        {showChannelAbbreviation ? <UseChannelAbbreviationSwitch /> : null}
        {beforeTable}
        {hasWirePreviewEntities ? (
          <Stack gap={4}>
            <Switch
              label="Hide items not to be included in export"
              checked={hideNotIncludedInExport}
              onChange={(event) =>
                setHideNotIncludedInExport(event.currentTarget.checked)
              }
            />
            <Text size="xs" c="dimmed">
              Respects include toggles on this page and{' '}
              <Link to={`/builds/${build.id}/export`}>Export inclusion</Link> on the export page
              for orphan channels, talk groups, and RX group lists.
              {hideNotIncludedInExport && hiddenRowCount > 0
                ? ` (${hiddenRowCount} hidden)`
                : null}
            </Text>
          </Stack>
        ) : null}
        <WirePreviewTable
          rows={rows}
          nameLimit={nameLimit}
          clickableDefaultWireName={clickableDefaultWireName}
          onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
          onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
          onUnsavedChangesChange={setHasUnsavedWireNames}
        />
      </Stack>

      <Modal opened={modalOpen} onClose={stay} title="Unapplied wire name changes" centered>
        <Stack gap="md">
          <Text size="sm">
            Some wire names have edits that were not applied. Leave this page and discard those
            changes, or stay to apply them.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={stay}>
              Stay on page
            </Button>
            <Button color="red" variant="light" onClick={leave}>
              Leave and discard
            </Button>
          </Group>
        </Stack>
      </Modal>
    </FormPage>
  );
}
