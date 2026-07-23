import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';

export type BuildsListGroupMode = 'list' | 'radio' | 'format';

export interface FormatBuildGroup {
  key: string;
  label: string;
  builds: FormatBuild[];
}

/**
 * Sibling export pathways for the same physical radio — By radio groups these together.
 * Keys are stable radio-family ids; labels omit pathway suffixes like "(NeonPlug)".
 */
const RADIO_FAMILY_BY_PROFILE: Readonly<Record<string, { key: string; label: string }>> = {
  'dm32-baofeng-dm32uv': { key: 'radio:baofeng-dm32uv', label: 'Baofeng DM-32UV' },
  'neonplug-dm32uv': { key: 'radio:baofeng-dm32uv', label: 'Baofeng DM-32UV' },
  'chirp-uv5r': { key: 'radio:baofeng-uv5r-mini', label: 'Baofeng UV-5R Mini' },
  'neonplug-uv5rmini': { key: 'radio:baofeng-uv5r-mini', label: 'Baofeng UV-5R Mini' },
  'radio-io-uv5r-mini': { key: 'radio:baofeng-uv5r-mini', label: 'Baofeng UV-5R Mini' },
};

function radioFamilyFor(profileId: string): { key: string; label: string } {
  const family = RADIO_FAMILY_BY_PROFILE[profileId];
  if (family) return family;
  return {
    key: `profile:${profileId}`,
    label: traitProfileFor(profileId)?.label ?? profileId,
  };
}

function groupKey(build: FormatBuild, mode: 'radio' | 'format'): string {
  return mode === 'format' ? build.formatId : radioFamilyFor(build.profileId).key;
}

function groupLabel(build: FormatBuild, mode: 'radio' | 'format'): string {
  if (mode === 'format') {
    return formatCatalogEntry(build.formatId as FormatId)?.label ?? build.formatId;
  }
  return radioFamilyFor(build.profileId).label;
}

/** Bucket filtered builds for the builds list group control. Empty groups are omitted. */
export function groupFormatBuilds(
  builds: FormatBuild[],
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
