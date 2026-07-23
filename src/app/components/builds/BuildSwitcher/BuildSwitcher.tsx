import { Select, Stack, Text } from '@mantine/core';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { pathForSwitchedBuild } from '../../../routes/builds/nav.ts';
import { useFormatBuild, useFormatBuilds } from '../../../state/useFormatBuilds.ts';

/** Mantine Select groups — catalog radio family, builds sorted by name within each group. */
function buildSelectGroups(builds: RadioBuild[]) {
  const byGroup = new Map<string, { value: string; label: string }[]>();

  for (const build of builds) {
    const group = radioTargetFor(build.radioTargetId)?.group ?? 'Other';
    const items = byGroup.get(group) ?? [];
    items.push({ value: build.id, label: build.name });
    byGroup.set(group, items);
  }

  for (const items of byGroup.values()) {
    items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([group, items]) => ({ group, items }));
}

export default function BuildSwitcher() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const buildId = paramId ?? location.pathname.match(/^\/builds\/([^/]+)/)?.[1];
  const { build } = useFormatBuild(buildId);
  const { builds } = useFormatBuilds();

  if (!build || !buildId) return null;

  const radioLabel = radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId;
  const selectData = buildSelectGroups(builds);

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
        {radioLabel}
      </Text>
    </Stack>
  );
}
