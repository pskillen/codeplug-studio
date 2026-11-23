import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  egressSummary,
  firmwareForTarget,
  manufacturerForRadioTarget,
  radioModelForTarget,
  radioTargetFor,
} from '@core/radio-targets/index.ts';

/** Lower-cased, whitespace-split search words; empty for a blank query. */
export function searchTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Transfer paths for a build ("Web Serial · NeonPlug · DM32 CSV"); empty when unknown. */
export function buildTransferPaths(build: Pick<RadioBuild, 'radioTargetId'>): string {
  const target = radioTargetFor(build.radioTargetId);
  return target ? egressSummary(target) : '';
}

function haystack(build: RadioBuild): string {
  const target = radioTargetFor(build.radioTargetId);
  const model = target ? radioModelForTarget(target) : undefined;
  const firmware = target ? firmwareForTarget(target) : undefined;
  return [
    build.name,
    manufacturerForRadioTarget(build.radioTargetId),
    model?.label ?? build.radioTargetId,
    firmware?.label ?? '',
    buildTransferPaths(build),
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Case-insensitive search: every word must appear somewhere in the build name,
 * manufacturer, model, firmware label or transfer paths.
 */
export function filterBuildsByQuery(builds: readonly RadioBuild[], query: string): RadioBuild[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [...builds];
  return builds.filter((b) => {
    const text = haystack(b);
    return tokens.every((t) => text.includes(t));
  });
}
