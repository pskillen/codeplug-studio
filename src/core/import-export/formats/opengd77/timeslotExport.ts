import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  buildTalkGroupTimeslotCloneIndex,
  profileHasTalkGroupTimeslotClones,
  type TalkGroupTimeslotCloneIndex,
} from '@core/import-export/channelExpansion/talkGroupTimeslotClones.ts';
import { buildTalkGroupWireNameMap } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import type { DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { DEFAULT_OPENGD77_PROFILE_ID, getOpenGd77Profile } from './profiles.ts';

export interface OpenGd77TimeslotExportContext {
  cloneIndex: TalkGroupTimeslotCloneIndex | null;
}

export function formatOpenGd77ContactTsOverride(slot: DMRTimeSlot): string {
  return slot === 2 ? '2' : '1';
}

/** Projected Contacts.csv row count (talk-group clones or rows + private contacts). */
export function countOpenGd77ProjectedContactRows(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: ExportWarning[],
): number {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  const profile = getOpenGd77Profile(profileId);
  const privateCount = assembled.digitalContacts.length + assembled.analogContacts.length;

  if (profileHasTalkGroupTimeslotClones(profileId)) {
    const sink = warnings ?? [];
    const baseNames = buildTalkGroupWireNameMap(assembled, { ...options, profileId }, sink);
    const reserved = new Set<string>(baseNames.values());
    const cloneIndex = buildTalkGroupTimeslotCloneIndex(assembled, baseNames, {
      maxNameLength: profile.nameLimit,
      reserved,
    });
    return cloneIndex.clones.length + privateCount;
  }

  return assembled.talkGroups.length + privateCount;
}

export function buildOpenGd77TimeslotExportContext(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: ExportWarning[],
): OpenGd77TimeslotExportContext {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  if (!profileHasTalkGroupTimeslotClones(profileId)) {
    return { cloneIndex: null };
  }

  const sink = warnings ?? [];
  const profile = getOpenGd77Profile(profileId);
  const baseNames = buildTalkGroupWireNameMap(assembled, { ...options, profileId }, sink);
  const reserved = new Set<string>(baseNames.values());
  const cloneIndex = buildTalkGroupTimeslotCloneIndex(assembled, baseNames, {
    maxNameLength: profile.nameLimit,
    reserved,
  });

  const totalContacts = countOpenGd77ProjectedContactRows(assembled, options, sink);
  if (totalContacts > profile.maxContacts) {
    pushGeneralWarning(
      sink,
      `Build projects ${totalContacts} contact row(s) (talk-group clones + private); only ${profile.maxContacts} fit OpenGD77 Contacts.csv`,
    );
  }

  return { cloneIndex };
}
