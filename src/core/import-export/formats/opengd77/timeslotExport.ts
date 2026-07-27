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

export function buildOpenGd77TimeslotExportContext(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: string[],
): OpenGd77TimeslotExportContext {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  if (!profileHasTalkGroupTimeslotClones(profileId)) {
    return { cloneIndex: null };
  }

  const sink = warnings ?? [];
  const profile = getOpenGd77Profile(profileId);
  const baseNames = buildTalkGroupWireNameMap(
    assembled,
    { ...options, profileId },
    sink,
  );
  const reserved = new Set<string>(baseNames.values());
  const cloneIndex = buildTalkGroupTimeslotCloneIndex(assembled, baseNames, {
    maxNameLength: profile.nameLimit,
    reserved,
  });

  const privateCount = assembled.digitalContacts.length + assembled.analogContacts.length;
  const totalContacts = cloneIndex.clones.length + privateCount;
  const maxContacts = 1024;
  if (totalContacts > maxContacts) {
    sink.push(
      `Build projects ${totalContacts} contact row(s) (talk-group clones + private); only ${maxContacts} fit OpenGD77 Contacts.csv`,
    );
  }

  return { cloneIndex };
}
