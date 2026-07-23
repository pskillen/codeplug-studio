import type { RadioBuild } from '@core/models/radioBuild.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { defaultCompatibleEgress, radioTargetFor } from '@core/radio-targets/index.ts';

export type BuildsListGroupMode = 'list' | 'radio' | 'format';

export interface FormatBuildGroup {
  key: string;
  label: string;
  builds: RadioBuild[];
}

function groupKey(build: RadioBuild, mode: 'radio' | 'format'): string {
  if (mode === 'radio') {
    return `radio:${build.radioTargetId}`;
  }
  const egress = defaultCompatibleEgress(build.radioTargetId);
  return `format:${egress?.formatId ?? 'unknown'}`;
}

function groupLabel(build: RadioBuild, mode: 'radio' | 'format'): string {
  if (mode === 'radio') {
    return radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId;
  }
  const formatId = defaultCompatibleEgress(build.radioTargetId)?.formatId ?? 'unknown';
  return formatCatalogEntry(formatId as FormatId)?.label ?? formatId;
}

/** Bucket filtered builds for the builds list group control. Empty groups are omitted. */
export function groupFormatBuilds(
  builds: RadioBuild[],
  mode: 'radio' | 'format',
): FormatBuildGroup[] {
  const map = new Map<string, FormatBuildGroup>();
  for (const build of builds) {
    const key = groupKey(build, mode);
    const existing = map.get(key);
    if (existing) {
      existing.builds.push(build);
      continue;
    }
    map.set(key, { key, label: groupLabel(build, mode), builds: [build] });
  }
  return [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}
