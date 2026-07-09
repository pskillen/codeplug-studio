import { Stack, Switch, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import UnsavedChangesModal from '../../../components/ui/UnsavedChangesModal.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';

function AirbandWireSection({
  title,
  entityKind,
  description,
}: {
  title: string;
  entityKind: Extract<WirePreviewEntityKind, 'channel' | 'zone'>;
  description: string;
}) {
  const { build } = useBuildLayout();
  const {
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
  } = useBuildWirePreview(entityKind, 'airband');
  const [hasUnsavedWireNames, setHasUnsavedWireNames] = useState(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

  return (
    <Stack gap="sm">
      <Title order={3}>{title}</Title>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      {hasWirePreviewEntities ? (
        <Stack gap={4}>
          <Switch
            label="Hide items not to be included in export"
            checked={hideNotIncludedInExport}
            onChange={(event) => setHideNotIncludedInExport(event.currentTarget.checked)}
          />
          <Text size="xs" c="dimmed">
            Respects skip toggles on this page and{' '}
            <Link to={`/builds/${build.id}/export`}>Export inclusion</Link> on the export page.
            {hideNotIncludedInExport && hiddenRowCount > 0 ? ` (${hiddenRowCount} hidden)` : null}
          </Text>
        </Stack>
      ) : null}
      <WirePreviewTable
        rows={rows}
        nameLimit={nameLimit}
        clickableDefaultWireName
        onExcludedChange={setRowExcluded}
        onForceIncludeChange={entityKind === 'zone' ? setRowForceIncluded : undefined}
        onWireNameChange={setRowWireName}
        onUnsavedChangesChange={setHasUnsavedWireNames}
      />
      <UnsavedChangesModal
        opened={modalOpen}
        onStay={stay}
        onLeave={leave}
        title="Unsaved wire name changes"
        message="You have unsaved wire name edits. Leave without saving?"
      />
    </Stack>
  );
}

export default function BuildAirbandWirePage() {
  const { build } = useBuildLayout();

  return (
    <FormPage
      title="Airband"
      description={
        <Link to={`/builds/${build.id}/overview`} style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
          ← {build.name}
        </Link>
      }
    >
      <Stack gap="xl">
        <Text size="sm" c="dimmed">
          AM airband receive channels and zones export to <code>AMAir.CSV</code> and{' '}
          <code>AMZone.CSV</code> — separate from the DMR channel bank and <code>DMRZone.CSV</code>.
          Zones with both airband and DMR members also appear on the Zones page for the DMR
          projection.
        </Text>
        <AirbandWireSection
          title="Channels"
          entityKind="channel"
          description="Receive-only AM channels in the civil airband (118–137 MHz). Wire names must match AMAir.CSV and AM zone member columns."
        />
        <AirbandWireSection
          title="Zones"
          entityKind="zone"
          description="Zones with at least one airband member. Airband-only zones appear here only; mixed zones also appear on Zones for DMR members."
        />
      </Stack>
    </FormPage>
  );
}
