import { newId } from '../models/ids.ts';
import type { BuildEntityOverride, EgressPath, RadioBuild } from '../models/index.ts';
import type { ProjectMeta } from '../models/project.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '../models/channelBehaviourDefaults.ts';
import { DEFAULT_ZONE_BEHAVIOUR_DEFAULTS } from '../models/zoneBehaviourDefaults.ts';
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
import { egressKindForFormatId } from '../models/egressPath.ts';
import {
  radioTargetFor,
  radioTargetIdForProfile,
  type CompatibleEgress,
} from '../radio-targets/index.ts';

export function emptyLibrary(): Library {
  return {
    channels: [],
    analogContacts: [],
    talkGroups: [],
    digitalContacts: [],
    rxGroupLists: [],
    scanLists: [],
    zones: [],
    aprsConfiguration: null,
    channelDefaults: { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS },
    zoneDefaults: { ...DEFAULT_ZONE_BEHAVIOUR_DEFAULTS },
  };
}

function emptyRadioBuildOverrides(): {
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

export function newRadioBuild(projectId: string, radioTargetId: string, name?: string): RadioBuild {
  const target = radioTargetFor(radioTargetId);
  if (!target) {
    throw new Error(`Unknown radio target: ${radioTargetId}`);
  }
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    radioTargetId: target.id,
    name: name ?? target.label,
    layout: emptyTraitLayout(),
    ...emptyRadioBuildOverrides(),
    exportUnlinkedChannels: true,
    exportUnlinkedTalkGroups: true,
    exportUnlinkedRxGroupLists: true,
    exportUnlinkedDigitalContacts: true,
    exportUnlinkedAnalogContacts: true,
  };
}

export function newEgressPath(
  projectId: string,
  radioBuildId: string,
  compatible: CompatibleEgress,
): EgressPath {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    radioBuildId,
    formatId: compatible.formatId,
    profileId: compatible.profileId,
    kind: compatible.kind,
    label: compatible.label,
  };
}

export function newEgressPathFromIds(
  projectId: string,
  radioBuildId: string,
  formatId: string,
  profileId: string,
  label?: string,
): EgressPath {
  const now = isoNow();
  return {
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    radioBuildId,
    formatId,
    profileId,
    kind: egressKindForFormatId(formatId),
    label,
  };
}

/** Seed every compatible egress for a radio build (create-time). */
export function seedEgressPathsForBuild(build: RadioBuild): EgressPath[] {
  const target = radioTargetFor(build.radioTargetId);
  if (!target) {
    throw new Error(`Unknown radio target: ${build.radioTargetId}`);
  }
  return target.compatibleEgress.map((compatible) =>
    newEgressPath(build.projectId, build.id, compatible),
  );
}

/**
 * Create a radio build + all seeded egress paths for a catalog target.
 * Sets `defaultEgressPathId` to the first (preferred) egress.
 */
export function newRadioBuildWithEgresses(
  projectId: string,
  radioTargetId: string,
  name?: string,
): { build: RadioBuild; egressPaths: EgressPath[] } {
  const build = newRadioBuild(projectId, radioTargetId, name);
  const egressPaths = seedEgressPathsForBuild(build);
  const defaultEgressPathId = egressPaths[0]?.id;
  return {
    build: defaultEgressPathId ? { ...build, defaultEgressPathId } : build,
    egressPaths,
  };
}

/**
 * Test / migration helper: create RadioBuild (+ egresses) from a legacy profile id.
 * Prefer {@link newRadioBuildWithEgresses} with an explicit `radioTargetId` in new code.
 */
export function newRadioBuildForProfile(
  projectId: string,
  profileId: string,
  name?: string,
): { build: RadioBuild; egress: EgressPath; egressPaths: EgressPath[] } {
  const radioTargetId = radioTargetIdForProfile(profileId);
  if (!radioTargetId) {
    throw new Error(`Unknown trait profile / no radio target: ${profileId}`);
  }
  const { build, egressPaths } = newRadioBuildWithEgresses(projectId, radioTargetId, name);
  const egress = egressPaths.find((path) => path.profileId === profileId) ?? egressPaths[0];
  if (!egress) {
    throw new Error(`No egress seeded for profile ${profileId}`);
  }
  return {
    build: { ...build, defaultEgressPathId: egress.id },
    egress,
    egressPaths,
  };
}

/**
 * @deprecated Use {@link newRadioBuildForProfile} or {@link newRadioBuildWithEgresses}.
 * Returns only the RadioBuild (drops formatId/profileId); callers that need egress
 * must use the new helpers.
 */
export function newFormatBuild(projectId: string, profileId: string, name?: string): RadioBuild {
  return newRadioBuildForProfile(projectId, profileId, name).build;
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
    forbidTransmit: 'default',
    txPermit: 'default',
    comment: '',
    primaryMode: null,
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
    callsign: '',
    city: '',
    state: '',
    country: '',
    remarks: '',
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

export { newAprsConfiguration } from './aprs/index.ts';

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
