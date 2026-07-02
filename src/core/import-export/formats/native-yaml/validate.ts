import type { FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  ChannelModeProfile,
  ChannelTone,
  DigitalContact,
  EntityRef,
  Library,
  RxGroupList,
  RxGroupListMember,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { STUDIO_SCHEMA_VERSION } from '@core/models/schemaVersion.ts';
import type {
  FlatMemoryLayout,
  TraitLayout,
  TraitLayoutSection,
  ZoneGroupingLayout,
} from '@core/models/traitLayout.ts';
import {
  libraryEntityIds,
  validateEntityRef,
  validateRxGroupListId,
  validateZoneMemberRefs,
} from '@core/domain/validation.ts';
import { NATIVE_YAML_SCHEMA_VERSION, type ProjectAggregate } from '../../projectDocument.ts';
import {
  NativeYamlImportError,
  expectArray,
  expectBoolean,
  expectNullableNumber,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
  isRecord,
} from './errors.ts';

function parsePersistableRow(raw: Record<string, unknown>, label: string) {
  return {
    id: expectString(raw.id, `${label}.id`),
    projectId: expectString(raw.projectId, `${label}.projectId`),
    revision: expectNumber(raw.revision, `${label}.revision`),
    updatedAt: expectString(raw.updatedAt, `${label}.updatedAt`),
  };
}

function assertUniqueIds(rows: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new NativeYamlImportError(`Duplicate ${label} id: ${row.id}`);
    }
    seen.add(row.id);
  }
}

function parseEntityRef(raw: unknown, label: string): EntityRef {
  const record = expectRecord(raw, label);
  const kind = expectString(record.kind, `${label}.kind`);
  if (
    kind !== 'channel' &&
    kind !== 'talkGroup' &&
    kind !== 'digitalContact' &&
    kind !== 'analogContact'
  ) {
    throw new NativeYamlImportError(`${label}.kind is invalid: ${kind}`);
  }
  return { kind, id: expectString(record.id, `${label}.id`) };
}

function parseModeProfile(raw: unknown, index: number): ChannelModeProfile {
  const record = expectRecord(raw, `modeProfiles[${index}]`);
  const mode = expectString(record.mode, `modeProfiles[${index}].mode`);

  switch (mode) {
    case 'fm':
    case 'am':
    case 'ssb-usb':
    case 'ssb-lsb':
      return {
        mode,
        squelch: expectNullableNumber(record.squelch, `modeProfiles[${index}].squelch`),
        rxTone: expectString(record.rxTone, `modeProfiles[${index}].rxTone`) as ChannelTone,
        txTone: expectString(record.txTone, `modeProfiles[${index}].txTone`) as ChannelTone,
        bandwidthKHz: expectNullableNumber(
          record.bandwidthKHz,
          `modeProfiles[${index}].bandwidthKHz`,
        ),
      };
    case 'dmr':
      return {
        mode: 'dmr',
        colourCode: expectNullableNumber(record.colourCode, `modeProfiles[${index}].colourCode`),
        timeslot:
          record.timeslot === null
            ? null
            : record.timeslot === 1 || record.timeslot === 2
              ? record.timeslot
              : (() => {
                  throw new NativeYamlImportError(
                    `modeProfiles[${index}].timeslot must be 1, 2, or null`,
                  );
                })(),
        dmrId: expectNullableNumber(record.dmrId, `modeProfiles[${index}].dmrId`),
        contactRef:
          record.contactRef === null
            ? null
            : parseEntityRef(record.contactRef, `modeProfiles[${index}].contactRef`),
        rxGroupListId:
          record.rxGroupListId === null
            ? null
            : expectString(record.rxGroupListId, `modeProfiles[${index}].rxGroupListId`),
      };
    case 'dstar':
      return {
        mode: 'dstar',
        urCall: expectString(record.urCall, `modeProfiles[${index}].urCall`),
        rpt1Call: expectString(record.rpt1Call, `modeProfiles[${index}].rpt1Call`),
        rpt2Call: expectString(record.rpt2Call, `modeProfiles[${index}].rpt2Call`),
      };
    case 'ysf':
      return {
        mode: 'ysf',
        dgId: expectNullableNumber(record.dgId, `modeProfiles[${index}].dgId`),
        wiresDtmfId: expectString(record.wiresDtmfId, `modeProfiles[${index}].wiresDtmfId`),
      };
    case 'nxdn':
      return {
        mode: 'nxdn',
        rxRan: expectNullableNumber(record.rxRan, `modeProfiles[${index}].rxRan`),
        txRan: expectNullableNumber(record.txRan, `modeProfiles[${index}].txRan`),
        unitId: expectNullableNumber(record.unitId, `modeProfiles[${index}].unitId`),
        talkGroupRef:
          record.talkGroupRef === null
            ? null
            : parseEntityRef(record.talkGroupRef, `modeProfiles[${index}].talkGroupRef`),
      };
    case 'tetra':
      return {
        mode: 'tetra',
        mcc: expectNullableNumber(record.mcc, `modeProfiles[${index}].mcc`),
        mnc: expectNullableNumber(record.mnc, `modeProfiles[${index}].mnc`),
        gssi: expectNullableNumber(record.gssi, `modeProfiles[${index}].gssi`),
        colorCode: expectNullableNumber(record.colorCode, `modeProfiles[${index}].colorCode`),
        talkGroupRef:
          record.talkGroupRef === null
            ? null
            : parseEntityRef(record.talkGroupRef, `modeProfiles[${index}].talkGroupRef`),
      };
    case 'p25':
    case 'm17':
      return { mode };
    default:
      throw new NativeYamlImportError(`modeProfiles[${index}].mode is invalid: ${mode}`);
  }
}

function parseChannel(raw: unknown, index: number): Channel {
  const record = expectRecord(raw, `library.channels[${index}]`);
  const locationRaw = record.location;
  let location: Channel['location'] = null;
  if (locationRaw !== null) {
    const loc = expectRecord(locationRaw, `library.channels[${index}].location`);
    location = {
      lat: expectNumber(loc.lat, `library.channels[${index}].location.lat`),
      lon: expectNumber(loc.lon, `library.channels[${index}].location.lon`),
    };
  }

  return {
    ...parsePersistableRow(record, `library.channels[${index}]`),
    name: expectString(record.name, `library.channels[${index}].name`),
    callsign: expectString(record.callsign, `library.channels[${index}].callsign`),
    rxFrequency: expectNullableNumber(record.rxFrequency, `library.channels[${index}].rxFrequency`),
    txFrequency: expectNullableNumber(record.txFrequency, `library.channels[${index}].txFrequency`),
    location,
    useLocation: expectBoolean(record.useLocation, `library.channels[${index}].useLocation`),
    maidenheadLocator: expectNullableString(
      record.maidenheadLocator,
      `library.channels[${index}].maidenheadLocator`,
    ),
    power: expectNullableNumber(record.power, `library.channels[${index}].power`),
    scanSkip: expectBoolean(record.scanSkip, `library.channels[${index}].scanSkip`),
    comment: expectString(record.comment, `library.channels[${index}].comment`),
    modeProfiles: expectArray(record.modeProfiles, `library.channels[${index}].modeProfiles`).map(
      (profile, profileIndex) => parseModeProfile(profile, profileIndex),
    ),
  };
}

function parseZone(raw: unknown, index: number): Zone {
  const record = expectRecord(raw, `library.zones[${index}]`);
  return {
    ...parsePersistableRow(record, `library.zones[${index}]`),
    name: expectString(record.name, `library.zones[${index}].name`),
    members: expectArray(record.members, `library.zones[${index}].members`).map((member, i) =>
      parseEntityRef(member, `library.zones[${index}].members[${i}]`),
    ),
    exportScratchChannel: expectBoolean(
      record.exportScratchChannel,
      `library.zones[${index}].exportScratchChannel`,
    ),
    exportScanList: expectBoolean(record.exportScanList, `library.zones[${index}].exportScanList`),
    scanCarrierFrequencyHz: expectNullableNumber(
      record.scanCarrierFrequencyHz,
      `library.zones[${index}].scanCarrierFrequencyHz`,
    ),
    comment: expectString(record.comment, `library.zones[${index}].comment`),
  };
}

function parseTalkGroup(raw: unknown, index: number): TalkGroup {
  const record = expectRecord(raw, `library.talkGroups[${index}]`);
  return {
    ...parsePersistableRow(record, `library.talkGroups[${index}]`),
    mode: expectString(record.mode, `library.talkGroups[${index}].mode`) as TalkGroup['mode'],
    name: expectString(record.name, `library.talkGroups[${index}].name`),
    digitalId: expectNumber(record.digitalId, `library.talkGroups[${index}].digitalId`),
    comment: expectString(record.comment, `library.talkGroups[${index}].comment`),
  };
}

function parseDigitalContact(raw: unknown, index: number): DigitalContact {
  const record = expectRecord(raw, `library.digitalContacts[${index}]`);
  return {
    ...parsePersistableRow(record, `library.digitalContacts[${index}]`),
    mode: expectString(
      record.mode,
      `library.digitalContacts[${index}].mode`,
    ) as DigitalContact['mode'],
    name: expectString(record.name, `library.digitalContacts[${index}].name`),
    digitalId: expectNumber(record.digitalId, `library.digitalContacts[${index}].digitalId`),
    comment: expectString(record.comment, `library.digitalContacts[${index}].comment`),
  };
}

function parseAnalogContact(raw: unknown, index: number): AnalogContact {
  const record = expectRecord(raw, `library.analogContacts[${index}]`);
  return {
    ...parsePersistableRow(record, `library.analogContacts[${index}]`),
    name: expectString(record.name, `library.analogContacts[${index}].name`),
    code: expectString(record.code, `library.analogContacts[${index}].code`),
    comment: expectString(record.comment, `library.analogContacts[${index}].comment`),
  };
}

function parseRxGroupListMember(raw: unknown, index: number, listIndex: number): RxGroupListMember {
  const record = expectRecord(raw, `library.rxGroupLists[${listIndex}].members[${index}]`);
  const slot = record.timeSlotOverride;
  let timeSlotOverride: RxGroupListMember['timeSlotOverride'];
  if (slot === undefined) {
    timeSlotOverride = undefined;
  } else if (slot === null) {
    timeSlotOverride = null;
  } else if (slot === 1 || slot === 2) {
    timeSlotOverride = slot;
  } else {
    throw new NativeYamlImportError(
      `library.rxGroupLists[${listIndex}].members[${index}].timeSlotOverride must be 1, 2, or null`,
    );
  }

  return {
    ref: parseEntityRef(record.ref, `library.rxGroupLists[${listIndex}].members[${index}].ref`),
    ...(timeSlotOverride !== undefined ? { timeSlotOverride } : {}),
  };
}

function parseRxGroupList(raw: unknown, index: number): RxGroupList {
  const record = expectRecord(raw, `library.rxGroupLists[${index}]`);
  return {
    ...parsePersistableRow(record, `library.rxGroupLists[${index}]`),
    name: expectString(record.name, `library.rxGroupLists[${index}].name`),
    members: expectArray(record.members, `library.rxGroupLists[${index}].members`).map(
      (member, memberIndex) => parseRxGroupListMember(member, memberIndex, index),
    ),
  };
}

function parseLibrary(raw: unknown): Library {
  const record = expectRecord(raw, 'library');
  const channels = expectArray(record.channels, 'library.channels').map((row, index) =>
    parseChannel(row, index),
  );
  const zones = expectArray(record.zones, 'library.zones').map((row, index) =>
    parseZone(row, index),
  );
  const talkGroups = expectArray(record.talkGroups, 'library.talkGroups').map((row, index) =>
    parseTalkGroup(row, index),
  );
  const digitalContacts = expectArray(record.digitalContacts, 'library.digitalContacts').map(
    (row, index) => parseDigitalContact(row, index),
  );
  const analogContacts = expectArray(record.analogContacts, 'library.analogContacts').map(
    (row, index) => parseAnalogContact(row, index),
  );
  const rxGroupLists = expectArray(record.rxGroupLists, 'library.rxGroupLists').map((row, index) =>
    parseRxGroupList(row, index),
  );

  return { channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists };
}

function parseSelection<T extends { libraryEntityId: string; overrides: { name: string } }>(
  raw: unknown,
  index: number,
  label: string,
): T {
  const record = expectRecord(raw, `${label}[${index}]`);
  const overrides = expectRecord(record.overrides, `${label}[${index}].overrides`);
  return {
    libraryEntityId: expectString(record.libraryEntityId, `${label}[${index}].libraryEntityId`),
    overrides: {
      name: expectString(overrides.name, `${label}[${index}].overrides.name`),
    },
  } as T;
}

function parseTraitSection(raw: unknown, index: number): TraitLayoutSection {
  const record = expectRecord(raw, `layout.sections[${index}]`);
  const kind = expectString(record.kind, `layout.sections[${index}].kind`);
  if (kind === 'zoneGrouping') {
    const zones = expectArray(record.zones, `layout.sections[${index}].zones`).map(
      (zoneRaw, zoneIndex) => {
        const zone = expectRecord(zoneRaw, `layout.sections[${index}].zones[${zoneIndex}]`);
        return {
          id: expectString(zone.id, `layout.sections[${index}].zones[${zoneIndex}].id`),
          name: expectString(zone.name, `layout.sections[${index}].zones[${zoneIndex}].name`),
          channelIds: expectArray(
            zone.channelIds,
            `layout.sections[${index}].zones[${zoneIndex}].channelIds`,
          ).map((id, idIndex) =>
            expectString(
              id,
              `layout.sections[${index}].zones[${zoneIndex}].channelIds[${idIndex}]`,
            ),
          ),
        };
      },
    );
    return { kind: 'zoneGrouping', zones } satisfies ZoneGroupingLayout;
  }
  if (kind === 'flatMemory') {
    const channelIds = expectArray(record.channelIds, `layout.sections[${index}].channelIds`).map(
      (id, idIndex) => expectString(id, `layout.sections[${index}].channelIds[${idIndex}]`),
    );
    const scanFlagsRaw = expectRecord(record.scanFlags, `layout.sections[${index}].scanFlags`);
    const scanFlags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(scanFlagsRaw)) {
      scanFlags[key] = expectBoolean(value, `layout.sections[${index}].scanFlags.${key}`);
    }
    return { kind: 'flatMemory', channelIds, scanFlags } satisfies FlatMemoryLayout;
  }
  throw new NativeYamlImportError(`layout.sections[${index}].kind is invalid: ${kind}`);
}

function parseTraitLayout(raw: unknown): TraitLayout {
  const record = expectRecord(raw, 'layout');
  return {
    sections: expectArray(record.sections, 'layout.sections').map((section, index) =>
      parseTraitSection(section, index),
    ),
  };
}

function parseFormatBuild(raw: unknown, index: number): FormatBuild {
  const record = expectRecord(raw, `formatBuilds[${index}]`);
  return {
    ...parsePersistableRow(record, `formatBuilds[${index}]`),
    formatId: expectString(record.formatId, `formatBuilds[${index}].formatId`),
    profileId: expectString(record.profileId, `formatBuilds[${index}].profileId`),
    name: expectString(record.name, `formatBuilds[${index}].name`),
    layout: parseTraitLayout(record.layout),
    channelSelections: expectArray(
      record.channelSelections,
      `formatBuilds[${index}].channelSelections`,
    ).map((row, selectionIndex) =>
      parseSelection(row, selectionIndex, `formatBuilds[${index}].channelSelections`),
    ),
    zoneSelections: expectArray(record.zoneSelections, `formatBuilds[${index}].zoneSelections`).map(
      (row, selectionIndex) =>
        parseSelection(row, selectionIndex, `formatBuilds[${index}].zoneSelections`),
    ),
    talkGroupSelections: expectArray(
      record.talkGroupSelections,
      `formatBuilds[${index}].talkGroupSelections`,
    ).map((row, selectionIndex) =>
      parseSelection(row, selectionIndex, `formatBuilds[${index}].talkGroupSelections`),
    ),
    rxGroupListSelections: expectArray(
      record.rxGroupListSelections,
      `formatBuilds[${index}].rxGroupListSelections`,
    ).map((row, selectionIndex) =>
      parseSelection(row, selectionIndex, `formatBuilds[${index}].rxGroupListSelections`),
    ),
    contactSelections: expectArray(
      record.contactSelections,
      `formatBuilds[${index}].contactSelections`,
    ).map((row, selectionIndex) =>
      parseSelection(row, selectionIndex, `formatBuilds[${index}].contactSelections`),
    ),
  };
}

function parseProjectMeta(raw: unknown): ProjectMeta {
  const record = expectRecord(raw, 'project');
  return {
    ...parsePersistableRow(record, 'project'),
    name: expectString(record.name, 'project.name'),
    description: expectString(record.description, 'project.description'),
    notes: expectString(record.notes, 'project.notes'),
    author: expectString(record.author, 'project.author'),
    createdAt: expectString(record.createdAt, 'project.createdAt'),
  };
}

function assertProjectId(rows: { projectId: string }[], projectId: string, label: string): void {
  for (const row of rows) {
    if (row.projectId !== projectId) {
      throw new NativeYamlImportError(
        `${label} projectId ${row.projectId} does not match project.id ${projectId}`,
      );
    }
  }
}

function validateForeignKeys(library: Library, formatBuilds: FormatBuild[]): void {
  const ids = libraryEntityIds(library);

  for (const zone of library.zones) {
    try {
      validateZoneMemberRefs(zone.id, zone.members, library);
    } catch (error) {
      throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
    }
  }

  for (const channel of library.channels) {
    for (const profile of channel.modeProfiles) {
      if (profile.mode === 'dmr') {
        if (profile.contactRef) {
          try {
            validateEntityRef(profile.contactRef, library);
          } catch (error) {
            throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
          }
        }
        if (profile.rxGroupListId) {
          try {
            validateRxGroupListId(profile.rxGroupListId, library);
          } catch (error) {
            throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
          }
        }
      }
      if (profile.mode === 'nxdn' || profile.mode === 'tetra') {
        if (profile.talkGroupRef) {
          try {
            validateEntityRef(profile.talkGroupRef, library);
          } catch (error) {
            throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
          }
        }
      }
    }
  }

  for (const list of library.rxGroupLists) {
    for (const member of list.members) {
      try {
        validateEntityRef(member.ref, library);
      } catch (error) {
        throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  for (const build of formatBuilds) {
    for (const section of build.layout.sections) {
      if (section.kind === 'zoneGrouping') {
        for (const zone of section.zones) {
          if (!ids.zoneIds.has(zone.id)) {
            throw new NativeYamlImportError(`Trait layout zone ${zone.id} not found in library`);
          }
          for (const channelId of zone.channelIds) {
            if (!ids.channelIds.has(channelId)) {
              throw new NativeYamlImportError(
                `Trait layout channel ${channelId} not found in library`,
              );
            }
          }
        }
      }
      if (section.kind === 'flatMemory') {
        for (const channelId of section.channelIds) {
          if (!ids.channelIds.has(channelId)) {
            throw new NativeYamlImportError(
              `Trait layout channel ${channelId} not found in library`,
            );
          }
        }
        for (const channelId of Object.keys(section.scanFlags)) {
          if (!ids.channelIds.has(channelId)) {
            throw new NativeYamlImportError(
              `Trait layout scanFlags key ${channelId} not found in library`,
            );
          }
        }
      }
    }

    for (const selection of build.channelSelections) {
      if (!ids.channelIds.has(selection.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build channel selection ${selection.libraryEntityId} not found in library`,
        );
      }
    }
    for (const selection of build.zoneSelections) {
      if (!ids.zoneIds.has(selection.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build zone selection ${selection.libraryEntityId} not found in library`,
        );
      }
    }
    for (const selection of build.talkGroupSelections) {
      if (!ids.talkGroupIds.has(selection.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build talk group selection ${selection.libraryEntityId} not found in library`,
        );
      }
    }
    for (const selection of build.rxGroupListSelections) {
      if (!ids.rxGroupListIds.has(selection.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build RX group list selection ${selection.libraryEntityId} not found in library`,
        );
      }
    }
    for (const selection of build.contactSelections) {
      const contactId = selection.libraryEntityId;
      if (!ids.digitalContactIds.has(contactId) && !ids.analogContactIds.has(contactId)) {
        throw new NativeYamlImportError(
          `Build contact selection ${contactId} not found in library`,
        );
      }
    }
  }
}

/** Validate a parsed YAML tree and return a project aggregate. */
export function validateDocument(raw: unknown): ProjectAggregate {
  const document = expectRecord(raw, 'document');

  if (document.schemaVersion !== NATIVE_YAML_SCHEMA_VERSION) {
    throw new NativeYamlImportError(
      `Unsupported schemaVersion: ${String(document.schemaVersion)} (expected ${NATIVE_YAML_SCHEMA_VERSION})`,
    );
  }

  if (document.studioSchemaVersion !== STUDIO_SCHEMA_VERSION) {
    throw new NativeYamlImportError(
      `Unsupported studioSchemaVersion: ${String(document.studioSchemaVersion)} (expected ${STUDIO_SCHEMA_VERSION}; migration not implemented)`,
    );
  }

  const project = parseProjectMeta(document.project);
  const library = parseLibrary(document.library);
  const formatBuilds = expectArray(document.formatBuilds, 'formatBuilds').map((row, index) =>
    parseFormatBuild(row, index),
  );

  const allRows = [
    project,
    ...library.channels,
    ...library.zones,
    ...library.talkGroups,
    ...library.digitalContacts,
    ...library.analogContacts,
    ...library.rxGroupLists,
    ...formatBuilds,
  ];

  assertProjectId(allRows, project.id, 'row');
  assertUniqueIds(library.channels, 'library.channels');
  assertUniqueIds(library.zones, 'library.zones');
  assertUniqueIds(library.talkGroups, 'library.talkGroups');
  assertUniqueIds(library.digitalContacts, 'library.digitalContacts');
  assertUniqueIds(library.analogContacts, 'library.analogContacts');
  assertUniqueIds(library.rxGroupLists, 'library.rxGroupLists');
  assertUniqueIds(formatBuilds, 'formatBuilds');

  validateForeignKeys(library, formatBuilds);

  return {
    meta: project,
    channels: library.channels,
    zones: library.zones,
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    analogContacts: library.analogContacts,
    rxGroupLists: library.rxGroupLists,
    formatBuilds,
  };
}

export function isNativeYamlDocument(raw: unknown): boolean {
  return isRecord(raw) && 'schemaVersion' in raw && 'project' in raw;
}
