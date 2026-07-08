import type { BuildEntityOverride, FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel } from '@core/models/library.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';

function stripOverrideScanListId(override: BuildEntityOverride): BuildEntityOverride | null {
  if (override.scanListId === undefined) return override;
  const { scanListId: _scanListId, ...rest } = override as BuildEntityOverride & {
    scanListId?: string;
  };
  void _scanListId;
  const trimmed = rest as BuildEntityOverride;
  if (
    !trimmed.wireName?.trim() &&
    trimmed.excluded !== true &&
    trimmed.forceInclude !== true &&
    (trimmed.orderOrSlot == null || trimmed.orderOrSlot < 1)
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Hoist legacy `channelOverrides.scanListId` onto library `Channel.scanListId`.
 * Strips the override field so scan list FK is library-owned (schema v11).
 */
export function migrateChannelScanListFromBuildOverrides(
  aggregate: ProjectAggregate,
): ProjectAggregate {
  const overrideByChannel = new Map<string, string>();
  for (const build of aggregate.formatBuilds) {
    for (const override of build.channelOverrides) {
      const legacyId = (override as BuildEntityOverride & { scanListId?: string }).scanListId;
      if (!legacyId?.trim()) continue;
      if (!overrideByChannel.has(override.libraryEntityId)) {
        overrideByChannel.set(override.libraryEntityId, legacyId.trim());
      }
    }
  }

  if (overrideByChannel.size === 0) {
    return aggregate;
  }

  let channelsChanged = false;
  const channels: Channel[] = aggregate.channels.map((channel) => {
    if (channel.scanListId) return channel;
    const fromBuild = overrideByChannel.get(channel.id);
    if (!fromBuild) return channel;
    channelsChanged = true;
    return { ...channel, scanListId: fromBuild };
  });

  let buildsChanged = false;
  const formatBuilds: FormatBuild[] = aggregate.formatBuilds.map((build) => {
    let buildDirty = false;
    const channelOverrides = build.channelOverrides
      .map((override) => {
        if (!(override as BuildEntityOverride & { scanListId?: string }).scanListId) {
          return override;
        }
        buildDirty = true;
        return stripOverrideScanListId(override);
      })
      .filter((override): override is BuildEntityOverride => override != null);
    if (!buildDirty) return build;
    buildsChanged = true;
    return { ...build, channelOverrides };
  });

  if (!channelsChanged && !buildsChanged) {
    return aggregate;
  }

  return {
    ...aggregate,
    channels,
    formatBuilds,
  };
}
