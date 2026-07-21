import { Select, Stack, Text } from '@mantine/core';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { pathForSwitchedBuild } from '../../../routes/builds/nav.ts';
import { useFormatBuild, useFormatBuilds } from '../../../state/useFormatBuilds.ts';

export default function BuildSwitcher() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const buildId = paramId ?? location.pathname.match(/^\/builds\/([^/]+)/)?.[1];
  const { build } = useFormatBuild(buildId);
  const { builds } = useFormatBuilds();

  if (!build || !buildId) return null;

  const formatLabel = formatCatalogEntry(build.formatId as FormatId)?.label ?? build.formatId;
  const profileLabel = traitProfileFor(build.profileId)?.label ?? build.profileId;
  const selectData = builds.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  return (
    <Stack gap="xs">
      <Select
        label="Build"
        data={selectData}
        value={build.id}
        onChange={(nextId) => {
          if (!nextId || nextId === build.id) return;
          const target = builds.find((b) => b.id === nextId);
          if (!target) return;
          navigate(pathForSwitchedBuild(location.pathname, build.id, target));
        }}
        allowDeselect={false}
        searchable={builds.length > 5}
      />
      <Text size="xs" c="dimmed">
        {formatLabel} · {profileLabel}
      </Text>
    </Stack>
  );
}
