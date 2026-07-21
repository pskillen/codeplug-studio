import { Select, Stack, Text } from '@mantine/core';
import { formatCatalog, formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { pathForSwitchedBuild } from '../../../routes/builds/nav.ts';
import { useFormatBuild, useFormatBuilds } from '../../../state/useFormatBuilds.ts';

/** Mantine Select groups — catalog order, builds sorted by name within each format. */
function buildSelectGroups(builds: FormatBuild[]) {
  const byFormat = new Map<string, { value: string; label: string }[]>();

  for (const b of builds) {
    const key = b.formatId;
    const items = byFormat.get(key) ?? [];
    items.push({ value: b.id, label: b.name });
    byFormat.set(key, items);
  }

  for (const items of byFormat.values()) {
    items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }

  const groups: { group: string; items: { value: string; label: string }[] }[] = [];

  for (const entry of formatCatalog) {
    const items = byFormat.get(entry.id);
    if (!items?.length) continue;
    groups.push({ group: entry.label, items });
    byFormat.delete(entry.id);
  }

  // Any unknown format ids (should not happen) — append last
  for (const [formatId, items] of byFormat) {
    const label = formatCatalogEntry(formatId as FormatId)?.label ?? formatId;
    groups.push({ group: label, items });
  }

  return groups;
}

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
        {formatLabel} · {profileLabel}
      </Text>
    </Stack>
  );
}
