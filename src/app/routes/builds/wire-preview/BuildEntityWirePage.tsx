import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';

export interface BuildEntityWirePageProps {
  title: string;
  entityKind: WirePreviewEntityKind;
  description?: string;
}

export default function BuildEntityWirePage({
  title,
  entityKind,
  description,
}: BuildEntityWirePageProps) {
  const { build } = useBuildLayout();
  const { rows, nameLimit, error, saving, setRowExcluded, setRowWireName } =
    useBuildWirePreview(entityKind);

  return (
    <FormPage
      title={title}
      description={
        <Link to={`/builds/${build.id}/overview`} style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
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
        <WirePreviewTable
          rows={rows}
          nameLimit={nameLimit}
          saving={saving}
          onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
          onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
        />
      </Stack>
    </FormPage>
  );
}
