import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import ExportNameModeSelect from '../../../components/builds/ExportNameModeSelect.tsx';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';

export interface BuildEntityWirePageProps {
  title: string;
  entityKind: WirePreviewEntityKind;
  description?: string;
  showExportNameMode?: boolean;
  clickableDefaultWireName?: boolean;
}

export default function BuildEntityWirePage({
  title,
  entityKind,
  description,
  showExportNameMode = false,
  clickableDefaultWireName = false,
}: BuildEntityWirePageProps) {
  const { build } = useBuildLayout();
  const { rows, nameLimit, error, setRowExcluded, setRowWireName } =
    useBuildWirePreview(entityKind);

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
        <WirePreviewTable
          rows={rows}
          nameLimit={nameLimit}
          clickableDefaultWireName={clickableDefaultWireName}
          onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
          onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
        />
      </Stack>
    </FormPage>
  );
}
