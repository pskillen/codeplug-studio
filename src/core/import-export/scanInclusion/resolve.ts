import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import type { DefaultScanInclusion, FormatExportDefaults } from '@core/import-export/types.ts';

export interface ScanInclusionContext {
  buildDefault?: DefaultScanInclusion;
  formatDefault?: DefaultScanInclusion;
}

/** Effective scan participation after resolving `default` against build + format defaults. */
export type EffectiveScanInclusion = DefaultScanInclusion;

export function resolveDefaultScanInclusion(context?: ScanInclusionContext): DefaultScanInclusion {
  return context?.buildDefault ?? context?.formatDefault ?? 'scan';
}

export function resolveEffectiveScanInclusion(
  channel: Pick<Channel, 'scanInclusion'>,
  context?: ScanInclusionContext,
  channelOverride?: ScanInclusion,
): EffectiveScanInclusion {
  const inclusion = channelOverride ?? channel.scanInclusion ?? 'default';
  if (inclusion === 'skip') return 'skip';
  if (inclusion === 'alwaysScan') return 'scan';
  return resolveDefaultScanInclusion(context);
}

/**
 * Export resolve: build per-channel override (when set) → library → build/format default.
 */
export function resolveChannelScanInclusionForExport(
  channel: Pick<Channel, 'scanInclusion'>,
  channelOverride: ScanInclusion | undefined,
  context?: ScanInclusionContext,
): EffectiveScanInclusion {
  return resolveEffectiveScanInclusion(channel, context, channelOverride);
}

export function effectiveScanSkips(
  channel: Pick<Channel, 'scanInclusion'>,
  context?: ScanInclusionContext,
  channelOverride?: ScanInclusion,
): boolean {
  return resolveEffectiveScanInclusion(channel, context, channelOverride) === 'skip';
}

export function scanInclusionFromLegacyBoolean(scanSkip: boolean): ScanInclusion {
  return scanSkip ? 'skip' : 'default';
}

export function buildScanContext(
  exportSettings?: BuildExportSettings,
  formatDefaults?: FormatExportDefaults,
): ScanInclusionContext {
  return {
    buildDefault: exportSettings?.defaultScanInclusion,
    formatDefault: formatDefaults?.defaultScanInclusion,
  };
}
