import { newId } from '../models/ids.ts';
import type { FormatBuild, Library, LibrarySelection } from '../models/index.ts';
import type { ProjectMeta } from '../models/project.ts';
import type { Channel, Contact, RxGroupList, TalkGroup } from '../models/library.ts';
import { emptyTraitLayout } from '../models/traitLayout.ts';
import { initialRevision, isoNow } from '../models/revision.ts';
import { traitProfileFor } from '../models/traits.ts';

export function emptyLibrary(): Library {
  return {
    channels: [],
    talkGroups: [],
    contacts: [],
    rxGroupLists: [],
  };
}

export function emptyLibrarySelection(): LibrarySelection {
  return {
    channelIds: [],
    talkGroupIds: [],
    contactIds: [],
    rxGroupListIds: [],
  };
}

export function newProjectMeta(name: string, projectId: string = newId()): ProjectMeta {
  const now = isoNow();
  return {
    id: projectId,
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    createdAt: now,
    name,
    description: '',
    notes: '',
    author: '',
  };
}

export function newFormatBuild(
  projectId: string,
  profileId: string,
  name?: string,
): FormatBuild {
  const profile = traitProfileFor(profileId);
  if (!profile) {
    throw new Error(`Unknown trait profile: ${profileId}`);
  }
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    formatId: profile.formatId,
    profileId: profile.profileId,
    name: name ?? profile.label,
    librarySelection: emptyLibrarySelection(),
    layout: emptyTraitLayout(),
  };
}

export function newChannel(projectId: string, name: string, callsign = ''): Channel {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    callsign,
    mode: 'fm',
    rxFrequency: null,
    txFrequency: null,
    contactRef: null,
    rxGroupListId: null,
    location: null,
    useLocation: false,
    rxTone: 'none',
    txTone: 'none',
    power: null,
    squelch: null,
    scanSkip: false,
    comment: '',
  };
}

export function newTalkGroup(projectId: string, name: string, dmrId: number): TalkGroup {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    dmrId,
    colorCode: null,
    comment: '',
  };
}

export function newContact(projectId: string, name: string, dmrId: number): Contact {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    dmrId,
    comment: '',
  };
}

export function newRxGroupList(projectId: string, name: string): RxGroupList {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    members: [],
  };
}
