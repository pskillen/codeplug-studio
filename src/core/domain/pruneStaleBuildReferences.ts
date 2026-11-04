import { parseChannelOverrideKey } from '../import-export/channelExpansion/channelOverrideKey.ts';
import { libraryEntityIds, validateEntityRef } from './validation.ts';
import type { BuildEntityOverride, RadioBuild } from '../models/radioBuild.ts';
import type { Library } from '../models/library.ts';
import type { TraitLayoutSection } from '../models/traitLayout.ts';

export interface PruneStaleBuildReferencesResult {
  build: RadioBuild;
  /** Human-readable notes, one per pruned reference group. Empty when nothing changed. */
  removed: string[];
}

/**
 * Drop build-scoped references to library entities that no longer exist:
 * trait layout zones and channel ids, `scanFlags` keys, and override rows.
 *
 * Build layouts and overrides are derived from the library, so a dangling id
 * there is stale state (e.g. a zone deleted after the build was arranged), not
 * library corruption. Malformed channel override keys are left in place for
 * the caller's validation to report.
 */
export function pruneStaleBuildReferences(
  build: RadioBuild,
  library: Library,
): PruneStaleBuildReferencesResult {
  const ids = libraryEntityIds(library);
  const removed: string[] = [];
  const hasChannel = (id: string) => ids.channelIds.has(id);
  const keepChannels = (channelIds: string[], where: string) => {
    const kept = channelIds.filter(hasChannel);
    if (kept.length < channelIds.length) {
      removed.push(`${channelIds.length - kept.length} missing channel(s) from ${where}`);
    }
    return kept;
  };

  let layoutChanged = false;
  const sections = build.layout.sections.map((section): TraitLayoutSection => {
    if (section.kind === 'zoneGrouping') {
      const zones = section.zones
        .filter((zone) => {
          if (ids.zoneIds.has(zone.id)) return true;
          removed.push(`zone "${zone.name}" (${zone.id}) from the zone layout`);
          return false;
        })
        .map((zone) => {
          const channelIds = keepChannels(zone.channelIds, `zone "${zone.name}"`);
          return channelIds.length === zone.channelIds.length ? zone : { ...zone, channelIds };
        });
      if (
        zones.length === section.zones.length &&
        zones.every((zone, index) => zone === section.zones[index])
      ) {
        return section;
      }
      layoutChanged = true;
      return { ...section, zones };
    }
    if (section.kind === 'flatMemory') {
      const channelIds = keepChannels(section.channelIds, 'the memory layout');
      const flagKeys = Object.keys(section.scanFlags);
      const scanFlags = Object.fromEntries(
        Object.entries(section.scanFlags).filter(([channelId]) => hasChannel(channelId)),
      );
      const keptFlags = Object.keys(scanFlags).length;
      if (keptFlags < flagKeys.length) {
        removed.push(`${flagKeys.length - keptFlags} missing channel(s) from memory scan flags`);
      }
      if (channelIds.length === section.channelIds.length && keptFlags === flagKeys.length) {
        return section;
      }
      layoutChanged = true;
      return { ...section, channelIds, scanFlags };
    }
    const scanLists = section.scanLists.map((scanList) => {
      const channelIds = keepChannels(scanList.channelIds, `scan list "${scanList.name}"`);
      return channelIds.length === scanList.channelIds.length
        ? scanList
        : { ...scanList, channelIds };
    });
    if (scanLists.every((scanList, index) => scanList === section.scanLists[index])) {
      return section;
    }
    layoutChanged = true;
    return { ...section, scanLists };
  });

  const keepOverrides = (
    overrides: BuildEntityOverride[],
    label: string,
    exists: (id: string) => boolean,
  ) => {
    const kept = overrides.filter((override) => exists(override.libraryEntityId));
    if (kept.length < overrides.length) {
      removed.push(`${overrides.length - kept.length} ${label} override(s)`);
    }
    return kept;
  };

  const channelOverrideExists = (key: string) => {
    let parsed;
    try {
      parsed = parseChannelOverrideKey(key);
    } catch {
      return true;
    }
    if (!hasChannel(parsed.channelId)) return false;
    if (parsed.kind !== 'multiMember') return true;
    try {
      validateEntityRef(parsed.memberRef, library);
      return true;
    } catch {
      return false;
    }
  };

  const channelOverrides = keepOverrides(build.channelOverrides, 'channel', channelOverrideExists);
  const zoneOverrides = keepOverrides(build.zoneOverrides, 'zone', (id) => ids.zoneIds.has(id));
  const talkGroupOverrides = keepOverrides(build.talkGroupOverrides, 'talk group', (id) =>
    ids.talkGroupIds.has(id),
  );
  const rxGroupListOverrides = keepOverrides(build.rxGroupListOverrides, 'RX group list', (id) =>
    ids.rxGroupListIds.has(id),
  );
  const contactOverrides = keepOverrides(
    build.contactOverrides,
    'contact',
    (id) => ids.digitalContactIds.has(id) || ids.analogContactIds.has(id),
  );

  if (removed.length === 0) return { build, removed };

  return {
    build: {
      ...build,
      layout: layoutChanged ? { ...build.layout, sections } : build.layout,
      channelOverrides,
      zoneOverrides,
      talkGroupOverrides,
      rxGroupListOverrides,
      contactOverrides,
    },
    removed,
  };
}
