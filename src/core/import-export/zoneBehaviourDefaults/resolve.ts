import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type {
  EffectiveIncludeInZoneDerivedScanList,
  IncludeInZoneDerivedScanListOverride,
  ZoneBehaviourDefaults,
  ZoneScanMemberProjection,
} from '@core/models/zoneBehaviourDefaults.ts';
import { DEFAULT_ZONE_BEHAVIOUR_DEFAULTS } from '@core/models/zoneBehaviourDefaults.ts';

export type ZoneBehaviourResolutionLayer = 'library' | 'member' | 'build' | 'projection';

export interface ResolvedZoneBehaviourField<T> {
  value: T;
  layer: ZoneBehaviourResolutionLayer;
}

export interface ZoneBehaviourContext {
  libraryDefaults?: ZoneBehaviourDefaults;
  buildOverrides?: Pick<BuildExportSettings, 'defaultIncludeInZoneDerivedScanList'>;
}

export function libraryZoneBehaviourDefaults(
  defaults?: ZoneBehaviourDefaults | null,
): ZoneBehaviourDefaults {
  return defaults ?? DEFAULT_ZONE_BEHAVIOUR_DEFAULTS;
}

/** Migrate legacy boolean `includeInScanList` on zone members. */
export function includeInScanListFromLegacyBoolean(
  value: boolean,
): IncludeInZoneDerivedScanListOverride {
  return value ? 'default' : 'skip';
}

export function normalizeIncludeInScanListOverride(
  value: unknown,
): IncludeInZoneDerivedScanListOverride {
  if (value === false) return 'skip';
  if (value === true) return 'default';
  if (value === 'include' || value === 'skip' || value === 'default') return value;
  return 'default';
}

export interface ResolveIncludeInZoneDerivedScanListArgs {
  /** Member override; omit / `default` defers to library + build. */
  memberOverride?: IncludeInZoneDerivedScanListOverride | null;
  channelId: string;
  context?: ZoneBehaviourContext;
  /** Per-exported-zone projection map from `ZoneGroupingZoneEntry.scanMemberInclusion`. */
  projection?: Record<string, ZoneScanMemberProjection> | null;
}

export function resolveEffectiveIncludeInZoneDerivedScanList(
  args: ResolveIncludeInZoneDerivedScanListArgs,
): EffectiveIncludeInZoneDerivedScanList {
  const library = libraryZoneBehaviourDefaults(args.context?.libraryDefaults);
  let value: EffectiveIncludeInZoneDerivedScanList = library.includeInZoneDerivedScanList
    ? 'include'
    : 'skip';

  const member = args.memberOverride ?? 'default';
  if (member === 'include' || member === 'skip') {
    value = member;
  }

  const build = args.context?.buildOverrides?.defaultIncludeInZoneDerivedScanList;
  if (build !== undefined) {
    value = build ? 'include' : 'skip';
  }

  const projected = args.projection?.[args.channelId];
  if (projected === 'include' || projected === 'skip') {
    value = projected;
  }

  return value;
}

export function resolveIncludeInZoneDerivedScanListWithLayer(
  args: ResolveIncludeInZoneDerivedScanListArgs,
): ResolvedZoneBehaviourField<EffectiveIncludeInZoneDerivedScanList> {
  const library = libraryZoneBehaviourDefaults(args.context?.libraryDefaults);
  const member = args.memberOverride ?? 'default';
  const build = args.context?.buildOverrides?.defaultIncludeInZoneDerivedScanList;
  const projected = args.projection?.[args.channelId];
  const value = resolveEffectiveIncludeInZoneDerivedScanList(args);

  if (projected !== undefined && value === projected) {
    return { value, layer: 'projection' };
  }
  if (build !== undefined && value === (build ? 'include' : 'skip')) {
    return { value, layer: 'build' };
  }
  if (member !== 'default' && value === member) {
    return { value, layer: 'member' };
  }
  if (value === (library.includeInZoneDerivedScanList ? 'include' : 'skip')) {
    return { value, layer: 'library' };
  }
  return { value, layer: 'projection' };
}

export function effectiveIncludeInZoneDerivedScanList(
  args: ResolveIncludeInZoneDerivedScanListArgs,
): boolean {
  return resolveEffectiveIncludeInZoneDerivedScanList(args) === 'include';
}

export function buildZoneBehaviourContext(
  libraryDefaults?: ZoneBehaviourDefaults | null,
  exportSettings?: BuildExportSettings,
): ZoneBehaviourContext {
  return {
    libraryDefaults: libraryDefaults ?? undefined,
    buildOverrides: exportSettings
      ? {
          defaultIncludeInZoneDerivedScanList: exportSettings.defaultIncludeInZoneDerivedScanList,
        }
      : undefined,
  };
}

/** Prefer merged export options; fall back to library defaults on the assembled slice. */
export function resolveZoneBehaviourContextForExport(
  assembled: { library?: { zoneDefaults?: ZoneBehaviourDefaults } },
  options?: Pick<CpsExportOptions, 'zoneBehaviourContext'>,
): ZoneBehaviourContext | undefined {
  if (options?.zoneBehaviourContext) return options.zoneBehaviourContext;
  if (assembled.library?.zoneDefaults !== undefined) {
    return buildZoneBehaviourContext(assembled.library.zoneDefaults);
  }
  return undefined;
}
