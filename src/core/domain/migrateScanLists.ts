import { normalizeChannelBehaviourDefaults } from './normalizeChannelBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from './normalizeZoneBehaviourDefaults.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import type { Library, ScanList } from '@core/models/library.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ScanListEntry, ScanListsLayout } from '@core/models/traitLayout.ts';

function scanListsSections(build: FormatBuild): ScanListsLayout[] {
  return build.layout.sections.filter((s): s is ScanListsLayout => s.kind === 'scanLists');
}

function entryToScanList(entry: ScanListEntry, projectId: string): ScanList {
  return {
    id: entry.id,
    projectId,
    revision: 1,
    updatedAt: new Date(0).toISOString(),
    name: entry.name,
    memberChannelIds: [...entry.channelIds],
  };
}

function stripScanListsSections(build: FormatBuild): FormatBuild {
  const sections = build.layout.sections.filter((section) => section.kind !== 'scanLists');
  if (sections.length === build.layout.sections.length) return build;
  return { ...build, layout: { ...build.layout, sections } };
}

/**
 * Hoist build-scoped `ScanListsLayout` entries into `library.scanLists`, preserving
 * entry ids so `scanListOverrides` and `channelOverrides.scanListId` stay valid.
 */
export function migrateBuildScanListsToLibrary(aggregate: ProjectAggregate): ProjectAggregate {
  const projectId = aggregate.meta.projectId;
  const scanListsById = new Map<string, ScanList>(
    aggregate.scanLists.map((list) => [list.id, list]),
  );
  let libraryChanged = false;
  let buildsChanged = false;

  const formatBuilds = aggregate.formatBuilds.map((build) => {
    const sections = scanListsSections(build);
    if (sections.length === 0) return build;

    for (const section of sections) {
      for (const entry of section.scanLists) {
        const existing = scanListsById.get(entry.id);
        if (!existing) {
          scanListsById.set(entry.id, entryToScanList(entry, projectId));
          libraryChanged = true;
          continue;
        }
        const mergedMembers = [...new Set([...existing.memberChannelIds, ...entry.channelIds])];
        if (
          mergedMembers.length !== existing.memberChannelIds.length ||
          existing.name !== entry.name
        ) {
          scanListsById.set(entry.id, {
            ...existing,
            name: existing.name || entry.name,
            memberChannelIds: mergedMembers,
          });
          libraryChanged = true;
        }
      }
    }

    buildsChanged = true;
    return stripScanListsSections(build);
  });

  if (!libraryChanged && !buildsChanged) {
    return aggregate;
  }

  const library: Library = {
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: [...scanListsById.values()],
    aprsConfiguration: aggregate.aprsConfiguration ?? null,
    channelDefaults: normalizeChannelBehaviourDefaults(
      aggregate.channelDefaults ?? aggregate.meta.channelDefaults,
    ),
    zoneDefaults: normalizeZoneBehaviourDefaults(
      aggregate.zoneDefaults ?? aggregate.meta.zoneDefaults,
    ),
  };

  return {
    ...aggregate,
    ...library,
    formatBuilds,
  };
}
