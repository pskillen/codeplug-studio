import { newId } from '../models/ids.ts';
import type { BuildEntityOverride, FormatBuild } from '../models/index.ts';
import type { ProjectMeta } from '../models/project.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  Library,
  RxGroupList,
  ScanList,
  TalkGroup,
  Zone,
} from '../models/library.ts';
import { emptyTraitLayout } from '../models/traitLayout.ts';
import { initialRevision, isoNow } from '../models/revision.ts';
import { traitProfileFor } from '../models/traits.ts';

export function emptyLibrary(): Library {
  return {
    channels: [],
    analogContacts: [],
    talkGroups: [],
    digitalContacts: [],
    rxGroupLists: [],
    scanLists: [],
    zones: [],
  };
}

function emptyFormatBuildOverrides(): {
  channelOverrides: BuildEntityOverride[];
  zoneOverrides: BuildEntityOverride[];
  scanListOverrides: BuildEntityOverride[];
  talkGroupOverrides: BuildEntityOverride[];
  rxGroupListOverrides: BuildEntityOverride[];
  contactOverrides: BuildEntityOverride[];
} {
  return {
    channelOverrides: [],
    zoneOverrides: [],
    scanListOverrides: [],
    talkGroupOverrides: [],
    rxGroupListOverrides: [],
    contactOverrides: [],
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

export function newFormatBuild(projectId: string, profileId: string, name?: string): FormatBuild {
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
    layout: emptyTraitLayout(),
    ...emptyFormatBuildOverrides(),
    exportUnlinkedChannels: true,
    exportUnlinkedTalkGroups: true,
    exportUnlinkedRxGroupLists: true,
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
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanInclusion: 'default',
    forbidTransmit: false,
    comment: '',
    modeProfiles: [],
  };
}

export function newTalkGroup(
  projectId: string,
  name: string,
  digitalId: number,
  mode: TalkGroup['mode'] = 'dmr',
): TalkGroup {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    mode,
    name,
    digitalId,
    comment: '',
  };
}

export function newDigitalContact(
  projectId: string,
  name: string,
  digitalId: number,
  mode: DigitalContact['mode'] = 'dmr',
): DigitalContact {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    mode,
    name,
    digitalId,
    comment: '',
  };
}

export function newAnalogContact(projectId: string, name: string, code = ''): AnalogContact {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    code,
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

export function newScanList(projectId: string, name: string): ScanList {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    memberChannelIds: [],
  };
}

export function newZone(projectId: string, name: string): Zone {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    members: [],
    comment: '',
  };
}
