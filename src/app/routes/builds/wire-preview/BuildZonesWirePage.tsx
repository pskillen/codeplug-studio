import { Divider, Stack, Text } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import {
  findZoneGroupingSection,
  seedZoneGroupingFromLibrary,
} from '@core/domain/zoneGroupingLayout.ts';
import BuildZoneLayoutEditor from '../../../components/builds/BuildZoneLayoutEditor.tsx';
import WirePreviewTable from '../../../components/builds/WirePreviewTable.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import { persistence } from '../../../state/persistence.ts';
import { BuildService } from '../../../state/buildService.ts';

const buildService = new BuildService(persistence);

export default function BuildZonesWirePage() {
  const { build } = useBuildLayout();
  const {
    rows,
    nameLimit,
    error,
    saving,
    library,
    setRowExcluded,
    setRowWireName,
    persistBuild,
  } = useBuildWirePreview('zone');

  const includedChannels = useMemo(() => {
    if (!library) return [];
    return library.channels.filter(
      (channel) => !isEntityExcluded(build.channelOverrides, channel.id),
    );
  }, [library, build.channelOverrides]);

  const zoneSection = findZoneGroupingSection(build);

  useEffect(() => {
    if (!library || zoneSection) return;
    const seeded = seedZoneGroupingFromLibrary(library);
    if (!seeded.zones.length) return;
    const next = buildService.withZoneGroupingSection(build, seeded);
    void persistBuild(next);
  }, [library, zoneSection, build, persistBuild]);

  return (
    <FormPage
      title="Zones"
      description={
        <Link to={`/builds/${build.id}/overview`} style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
          ← {build.name}
        </Link>
      }
    >
      <Stack gap="lg">
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        {zoneSection ? (
          <BuildZoneLayoutEditor
            section={zoneSection}
            channels={includedChannels}
            saving={saving}
            onSectionChange={(section) => {
              const next = buildService.withZoneGroupingSection(build, section);
              void persistBuild(next);
            }}
          />
        ) : null}
        <Divider />
        <Stack gap="sm">
          <Text fw={500}>Wire names</Text>
          <WirePreviewTable
            rows={rows}
            nameLimit={nameLimit}
            saving={saving}
            onExcludedChange={(row, excluded) => void setRowExcluded(row, excluded)}
            onWireNameChange={(row, wireName) => void setRowWireName(row, wireName)}
          />
        </Stack>
      </Stack>
    </FormPage>
  );
}
