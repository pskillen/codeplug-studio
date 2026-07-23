import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';

export type BuildsListGroupMode = 'list' | 'radio';

export interface FormatBuildGroup {
  key: string;
  label: string;
  builds: RadioBuild[];
}

/** Bucket filtered builds by radio target for the builds list group control. */
export function groupFormatBuilds(builds: RadioBuild[], mode: 'radio'): FormatBuildGroup[] {
  if (mode !== 'radio') return [];
  const map = new Map<string, FormatBuildGroup>();
  for (const build of builds) {
    const key = `radio:${build.radioTargetId}`;
    const existing = map.get(key);
    if (existing) {
      existing.builds.push(build);
      continue;
    }
    map.set(key, {
      key,
      label: radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId,
      builds: [build],
    });
  }
  return [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}
