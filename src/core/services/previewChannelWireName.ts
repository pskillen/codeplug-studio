import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { assembledChannelExportWireName } from '@core/import-export/channelExpansion/exportWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel } from '@core/models/library.ts';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { resolveBuildDefaultEgress } from '@core/radio-targets/index.ts';
import { mergeExportOptions } from './exportBuild.ts';

/**
 * Wire-preview export options — {@link CpsExportOptions} plus an optional egress `formatId`
 * override. When omitted, `formatId`/`profileId` default via the build's radio target
 * ({@link defaultCompatibleEgress}) since `RadioBuild` no longer carries these fields (#654).
 */
export interface WirePreviewChannelNameOptions extends CpsExportOptions {
  /** Egress format id override — defaults to the radio target's default compatible egress. */
  formatId?: string;
}

/** Generated CPS wire name for build wire-preview UI — mirrors export shortening and name mode. */
export function previewGeneratedChannelWireName(
  channel: Channel,
  build: RadioBuild,
  options?: WirePreviewChannelNameOptions,
): string {
  const defaultEgress = resolveBuildDefaultEgress(build);
  const formatId = options?.formatId ?? defaultEgress?.formatId ?? '';
  const merged = mergeExportOptions(build, formatId, {
    ...options,
    profileId: options?.profileId ?? defaultEgress?.profileId,
  });
  const profileId = merged.profileId ?? defaultEgress?.profileId;
  const reserved = new Set<string>();
  const warnings: ExportWarning[] = [];
  return assembledChannelExportWireName(
    { entity: channel, wireName: defaultChannelWireName(channel) },
    reserved,
    merged,
    profileId,
    warnings,
  );
}
