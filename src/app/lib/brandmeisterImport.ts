import type { Channel, Library } from '@core/models/library.ts';
import {
  buildBrandmeisterImportBundle,
  fetchResolvedDeviceTalkGroups,
  RepeaterDirectoryError,
  type BrandMeisterImportBundle,
  type MapListingOptions,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';

export interface BrandMeisterImportResult {
  ok: true;
  channel: Channel;
  talkGroupsCreated: number;
  rxGroupListCreated: boolean;
  warning?: string;
  library: Library;
}

export interface BrandMeisterImportFailure {
  ok: false;
  reason: 'revision_conflict' | 'not_found' | 'persist_failed';
  message: string;
}

export type PersistBrandMeisterImportOutcome = BrandMeisterImportResult | BrandMeisterImportFailure;

export interface PersistBrandMeisterImportOptions {
  listing: RepeaterListing;
  projectId: string;
  library: Library;
  mapOptions: MapListingOptions;
  importTalkGroups: boolean;
  persistence: ProjectPersistence;
}

/**
 * Import a BrandMeister listing into the library — optionally with talk groups
 * and a repeater-scoped RX group list. Degrades to channel-only when TG fetch fails.
 */
export async function persistBrandMeisterImport(
  options: PersistBrandMeisterImportOptions,
): Promise<PersistBrandMeisterImportOutcome> {
  const { listing, projectId, library, mapOptions, importTalkGroups, persistence } = options;

  let resolvedTalkGroups: Awaited<ReturnType<typeof fetchResolvedDeviceTalkGroups>> = [];
  let warning: string | undefined;

  if (importTalkGroups) {
    try {
      resolvedTalkGroups = await fetchResolvedDeviceTalkGroups(listing.remoteId);
    } catch (err) {
      warning =
        err instanceof RepeaterDirectoryError
          ? `${err.message} Added channel only.`
          : 'Talk groups unavailable. Added channel only.';
    }
  }

  const bundle = buildBrandmeisterImportBundle(
    listing,
    projectId,
    library,
    resolvedTalkGroups,
    mapOptions,
  );

  for (const talkGroup of bundle.talkGroupsToCreate) {
    const result = await persistence.putTalkGroup(talkGroup, null);
    if (!result.ok) {
      return persistFailure(result);
    }
  }

  if (bundle.rxGroupList) {
    const result = await persistence.putRxGroupList(bundle.rxGroupList, null);
    if (!result.ok) {
      return persistFailure(result);
    }
  }

  const channelResult = await persistence.putChannel(bundle.channel, null);
  if (!channelResult.ok) {
    return persistFailure(channelResult);
  }

  return {
    ok: true,
    channel: bundle.channel,
    talkGroupsCreated: bundle.talkGroupsToCreate.length,
    rxGroupListCreated: bundle.rxGroupList !== null,
    warning,
    library: mergeImportIntoLibrary(library, bundle),
  };
}

function mergeImportIntoLibrary(library: Library, bundle: BrandMeisterImportBundle): Library {
  return {
    ...library,
    talkGroups: [...library.talkGroups, ...bundle.talkGroupsToCreate],
    rxGroupLists: bundle.rxGroupList
      ? [...library.rxGroupLists, bundle.rxGroupList]
      : library.rxGroupLists,
    channels: [...library.channels, bundle.channel],
  };
}

function persistFailure(result: PutResult): BrandMeisterImportFailure {
  if (result.reason === 'revision_conflict') {
    return {
      ok: false,
      reason: 'revision_conflict',
      message: 'A library entity was updated elsewhere. Reload and try again.',
    };
  }
  return {
    ok: false,
    reason: result.reason,
    message: 'Could not save imported entities.',
  };
}

export function formatBrandMeisterImportMessage(result: BrandMeisterImportResult): string {
  const parts = ['Added channel'];
  if (result.talkGroupsCreated > 0) {
    parts.push(
      `${result.talkGroupsCreated} talk group${result.talkGroupsCreated === 1 ? '' : 's'}`,
    );
  }
  if (result.rxGroupListCreated) {
    parts.push('RX group list');
  }
  const summary = parts.join(' + ');
  return result.warning ? `${summary}. ${result.warning}` : summary;
}
