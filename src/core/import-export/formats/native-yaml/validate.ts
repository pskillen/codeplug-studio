import { scanInclusionFromLegacyBoolean } from '@core/import-export/scanInclusion/index.ts';
import type {
  BuildEntityOverride,
  BuildExportSettings,
  FormatBuild,
} from '@core/models/formatBuild.ts';
import type { ScanInclusion } from '@core/models/library.ts';
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
  ScanList,
  SsbSideband,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import type {
  GoogleDriveInterchange,
  LocalFileInterchange,
  ProjectInterchange,
} from '@core/models/interchange.ts';
import { STUDIO_SCHEMA_VERSION } from '@core/models/schemaVersion.ts';
import type {
  FlatMemoryLayout,
  TraitLayout,
  TraitLayoutSection,
  ZoneGroupingLayout,
  ScanListsLayout,
} from '@core/models/traitLayout.ts';
import {
  libraryEntityIds,
  validateEntityRef,
  validateRxGroupListId,
  validateScanListId,
  validateScanListMembers,
  validateZoneMembers,
} from '@core/domain/validation.ts';
import { normalizeModeProfile } from '@core/domain/modeProfiles.ts';
import { normalizeChannel } from '@core/domain/normalizeChannel.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import { migrateFormatBuild } from '@core/domain/migrateFormatBuild.ts';
import { migrateProjectAggregate } from '@core/domain/migrateZoneExportFields.ts';
import {
  parseOverrideArray,
  type LegacyEntitySelection,
} from '@core/domain/formatBuildOverrides.ts';
import { NATIVE_YAML_SCHEMA_VERSION, type ProjectAggregate } from '../../projectDocument.ts';
import {
  NativeYamlImportError,
  expectArray,
  expectBoolean,
  expectNullableNumber,
  expectNullableString,
  expectNumber,
  expectOptionalString,
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

function parseNullableEntityRef(raw: unknown, label: string): EntityRef | null {
  if (raw === undefined || raw === null) return null;
  return parseEntityRef(raw, label);
}

function parseNullableDmrTimeslot(value: unknown, label: string): 1 | 2 | null {
  if (value === undefined || value === null) return null;
  if (value === 1 || value === 2) return value;
  throw new NativeYamlImportError(`${label} must be 1, 2, or null`);
}

function parseSsbSideband(raw: unknown, index: number): SsbSideband {
  const value = expectString(raw, `modeProfiles[${index}].ssbSideband`);
  if (value !== 'usb' && value !== 'lsb') {
    throw new NativeYamlImportError(`modeProfiles[${index}].ssbSideband is invalid: ${value}`);
  }
  return value;
}

function parseAnalogModeProfile(
  record: Record<string, unknown>,
  index: number,
  mode: string,
): ChannelModeProfile {
  const profile = {
    mode,
    squelch: expectNullableNumber(record.squelch, `modeProfiles[${index}].squelch`),
    rxTone: expectOptionalString(
      record.rxTone,
      `modeProfiles[${index}].rxTone`,
      'none',
    ) as ChannelTone,
    txTone: expectOptionalString(
      record.txTone,
      `modeProfiles[${index}].txTone`,
      'none',
    ) as ChannelTone,
    bandwidthKHz: expectNullableNumber(record.bandwidthKHz, `modeProfiles[${index}].bandwidthKHz`),
    ...(record.ssbSideband !== undefined && record.ssbSideband !== null
      ? { ssbSideband: parseSsbSideband(record.ssbSideband, index) }
      : {}),
  };
  return normalizeModeProfile(profile as ChannelModeProfile);
}

function parseModeProfile(raw: unknown, index: number): ChannelModeProfile {
  const record = expectRecord(raw, `modeProfiles[${index}]`);
  const mode = expectString(record.mode, `modeProfiles[${index}].mode`);

  switch (mode) {
    case 'fm':
    case 'am':
    case 'ssb':
    case 'ssb-usb':
    case 'ssb-lsb':
      return parseAnalogModeProfile(record, index, mode);
    case 'dmr':
      return {
        mode: 'dmr',
        colourCode: expectNullableNumber(record.colourCode, `modeProfiles[${index}].colourCode`),
        timeslot: parseNullableDmrTimeslot(record.timeslot, `modeProfiles[${index}].timeslot`),
        dmrId: expectNullableNumber(record.dmrId, `modeProfiles[${index}].dmrId`),
        contactRef: parseNullableEntityRef(record.contactRef, `modeProfiles[${index}].contactRef`),
        rxGroupListId: expectNullableString(
          record.rxGroupListId,
          `modeProfiles[${index}].rxGroupListId`,
        ),
      };
    case 'dstar':
      return {
        mode: 'dstar',
        urCall: expectOptionalString(record.urCall, `modeProfiles[${index}].urCall`, 'CQCQCQ'),
        rpt1Call: expectOptionalString(record.rpt1Call, `modeProfiles[${index}].rpt1Call`),
        rpt2Call: expectOptionalString(record.rpt2Call, `modeProfiles[${index}].rpt2Call`),
      };
    case 'ysf':
      return {
        mode: 'ysf',
        dgId: expectNullableNumber(record.dgId, `modeProfiles[${index}].dgId`),
        wiresDtmfId: expectOptionalString(record.wiresDtmfId, `modeProfiles[${index}].wiresDtmfId`),
      };
    case 'nxdn':
      return {
        mode: 'nxdn',
        rxRan: expectNullableNumber(record.rxRan, `modeProfiles[${index}].rxRan`),
        txRan: expectNullableNumber(record.txRan, `modeProfiles[${index}].txRan`),
        unitId: expectNullableNumber(record.unitId, `modeProfiles[${index}].unitId`),
        talkGroupRef: parseNullableEntityRef(
          record.talkGroupRef,
          `modeProfiles[${index}].talkGroupRef`,
        ),
      };
    case 'tetra':
      return {
        mode: 'tetra',
        mcc: expectNullableNumber(record.mcc, `modeProfiles[${index}].mcc`),
        mnc: expectNullableNumber(record.mnc, `modeProfiles[${index}].mnc`),
        gssi: expectNullableNumber(record.gssi, `modeProfiles[${index}].gssi`),
        colorCode: expectNullableNumber(record.colorCode, `modeProfiles[${index}].colorCode`),
        talkGroupRef: parseNullableEntityRef(
          record.talkGroupRef,
          `modeProfiles[${index}].talkGroupRef`,
        ),
      };
    case 'p25':
    case 'm17':
      return { mode };
    default:
      throw new NativeYamlImportError(`modeProfiles[${index}].mode is invalid: ${mode}`);
  }
}

const SCAN_INCLUSION_VALUES = ['default', 'skip', 'alwaysScan'] as const;

function parseScanInclusion(record: Record<string, unknown>, label: string): ScanInclusion {
  if (record.scanInclusion !== undefined && record.scanInclusion !== null) {
    const value = expectString(record.scanInclusion, `${label}.scanInclusion`);
    if (!(SCAN_INCLUSION_VALUES as readonly string[]).includes(value)) {
      throw new NativeYamlImportError(`${label}.scanInclusion is invalid: ${value}`);
    }
    return value as ScanInclusion;
  }
  if (record.scanSkip !== undefined && record.scanSkip !== null) {
    return scanInclusionFromLegacyBoolean(expectBoolean(record.scanSkip, `${label}.scanSkip`));
  }
  return 'default';
}

function parseChannel(raw: unknown, index: number): Channel {
  const record = expectRecord(raw, `library.channels[${index}]`);
  const locationRaw = record.location;
  let location: Channel['location'] = null;
  if (locationRaw !== undefined && locationRaw !== null) {
    const loc = expectRecord(locationRaw, `library.channels[${index}].location`);
    location = {
      lat: expectNumber(loc.lat, `library.channels[${index}].location.lat`),
      lon: expectNumber(loc.lon, `library.channels[${index}].location.lon`),
    };
  }

  return normalizeChannel({
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
    scanInclusion: parseScanInclusion(record, `library.channels[${index}]`),
    forbidTransmit:
      record.forbidTransmit === undefined || record.forbidTransmit === null
        ? false
        : expectBoolean(record.forbidTransmit, `library.channels[${index}].forbidTransmit`),
    comment: expectString(record.comment, `library.channels[${index}].comment`),
    ...(record.scanListId !== undefined && record.scanListId !== null
      ? {
          scanListId: expectNullableString(
            record.scanListId,
            `library.channels[${index}].scanListId`,
          ),
        }
      : {}),
    ...(record.abbreviation !== undefined && record.abbreviation !== null
      ? {
          abbreviation: expectString(
            record.abbreviation,
            `library.channels[${index}].abbreviation`,
          ),
        }
      : {}),
    ...(record.hideFromInternalMap !== undefined && record.hideFromInternalMap !== null
      ? {
          hideFromInternalMap: expectBoolean(
            record.hideFromInternalMap,
            `library.channels[${index}].hideFromInternalMap`,
          ),
        }
      : {}),
    ...(record.primaryMode !== undefined && record.primaryMode !== null
      ? {
          primaryMode: expectString(
            record.primaryMode,
            `library.channels[${index}].primaryMode`,
          ) as Channel['primaryMode'],
        }
      : { primaryMode: null }),
    modeProfiles: expectArray(record.modeProfiles, `library.channels[${index}].modeProfiles`).map(
      (profile, profileIndex) => parseModeProfile(profile, profileIndex),
    ),
  });
}

function parseZone(raw: unknown, index: number, studioSchemaVersion: number): Zone {
  const record = expectRecord(raw, `library.zones[${index}]`);
  const zone: Zone = {
    ...parsePersistableRow(record, `library.zones[${index}]`),
    name: expectString(record.name, `library.zones[${index}].name`),
    members: expectArray(record.members, `library.zones[${index}].members`).map((member) =>
      normalizeZoneMemberEntry(member),
    ),
    comment: expectString(record.comment, `library.zones[${index}].comment`),
    ...(record.omitFromExport !== undefined && record.omitFromExport !== null
      ? {
          omitFromExport: expectBoolean(
            record.omitFromExport,
            `library.zones[${index}].omitFromExport`,
          ),
        }
      : {}),
  };

  if (studioSchemaVersion >= STUDIO_SCHEMA_VERSION) {
    return zone;
  }

  return {
    ...zone,
    ...(record.exportScratchChannel !== undefined && record.exportScratchChannel !== null
      ? {
          exportScratchChannel: expectBoolean(
            record.exportScratchChannel,
            `library.zones[${index}].exportScratchChannel`,
          ),
        }
      : {}),
    ...(record.exportScanList !== undefined && record.exportScanList !== null
      ? {
          exportScanList: expectBoolean(
            record.exportScanList,
            `library.zones[${index}].exportScanList`,
          ),
        }
      : {}),
    ...(record.scanCarrierFrequencyHz !== undefined
      ? {
          scanCarrierFrequencyHz: expectNullableNumber(
            record.scanCarrierFrequencyHz,
            `library.zones[${index}].scanCarrierFrequencyHz`,
          ),
        }
      : {}),
  } as Zone;
}

function parseTalkGroup(raw: unknown, index: number): TalkGroup {
  const record = expectRecord(raw, `library.talkGroups[${index}]`);
  return {
    ...parsePersistableRow(record, `library.talkGroups[${index}]`),
    mode: expectString(record.mode, `library.talkGroups[${index}].mode`) as TalkGroup['mode'],
    name: expectString(record.name, `library.talkGroups[${index}].name`),
    digitalId: expectNumber(record.digitalId, `library.talkGroups[${index}].digitalId`),
    comment: expectString(record.comment, `library.talkGroups[${index}].comment`),
    ...(record.abbreviation !== undefined && record.abbreviation !== null
      ? {
          abbreviation: expectString(
            record.abbreviation,
            `library.talkGroups[${index}].abbreviation`,
          ),
        }
      : {}),
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

function parseScanList(raw: unknown, index: number): ScanList {
  const record = expectRecord(raw, `library.scanLists[${index}]`);
  return {
    ...parsePersistableRow(record, `library.scanLists[${index}]`),
    name: expectString(record.name, `library.scanLists[${index}].name`),
    memberChannelIds: expectArray(
      record.memberChannelIds,
      `library.scanLists[${index}].memberChannelIds`,
    ).map((channelId, channelIndex) =>
      expectString(channelId, `library.scanLists[${index}].memberChannelIds[${channelIndex}]`),
    ),
  };
}

function parseLibrary(raw: unknown, studioSchemaVersion: number): Library {
  const record = expectRecord(raw, 'library');
  const channels = expectArray(record.channels, 'library.channels').map((row, index) =>
    parseChannel(row, index),
  );
  const zones = expectArray(record.zones, 'library.zones').map((row, index) =>
    parseZone(row, index, studioSchemaVersion),
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
  const scanLists =
    record.scanLists === undefined || record.scanLists === null
      ? []
      : expectArray(record.scanLists, 'library.scanLists').map((row, index) =>
          parseScanList(row, index),
        );

  return { channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists, scanLists };
}

function parseLegacySelectionArray(raw: unknown, label: string): LegacyEntitySelection[] {
  return expectArray(raw, label).map((row, index) => {
    const record = expectRecord(row, `${label}[${index}]`);
    const overrides = expectRecord(record.overrides, `${label}[${index}].overrides`);
    return {
      libraryEntityId: expectString(record.libraryEntityId, `${label}[${index}].libraryEntityId`),
      overrides: {
        name: expectString(overrides.name, `${label}[${index}].overrides.name`),
      },
    };
  });
}

function parseOverrideField(
  record: Record<string, unknown>,
  newKey: string,
  _legacyKey: string,
  label: string,
): BuildEntityOverride[] {
  if (record[newKey] !== undefined && record[newKey] !== null) {
    return parseOverrideArray(record[newKey], `${label}.${newKey}`);
  }
  return [];
}

function parseExportSettings(raw: unknown, label: string): BuildExportSettings | undefined {
  if (raw === undefined || raw === null) return undefined;
  const record = expectRecord(raw, label);
  const settings: BuildExportSettings = {};
  if (record.defaultScanInclusion !== undefined && record.defaultScanInclusion !== null) {
    const value = expectString(record.defaultScanInclusion, `${label}.defaultScanInclusion`);
    if (value !== 'skip' && value !== 'scan') {
      throw new NativeYamlImportError(`${label}.defaultScanInclusion is invalid: ${value}`);
    }
    settings.defaultScanInclusion = value;
  }
  if (record.shortenNames !== undefined && record.shortenNames !== null) {
    settings.shortenNames = expectBoolean(record.shortenNames, `${label}.shortenNames`);
  }
  if (record.maxNameLength !== undefined) {
    settings.maxNameLength = expectNullableNumber(record.maxNameLength, `${label}.maxNameLength`);
  }
  if (record.nameModeOverride !== undefined && record.nameModeOverride !== null) {
    settings.nameModeOverride = expectString(
      record.nameModeOverride,
      `${label}.nameModeOverride`,
    ) as BuildExportSettings['nameModeOverride'];
  }
  if (record.useChannelAbbreviation !== undefined && record.useChannelAbbreviation !== null) {
    settings.useChannelAbbreviation = expectBoolean(
      record.useChannelAbbreviation,
      `${label}.useChannelAbbreviation`,
    );
  }
  if (record.useTalkGroupAbbreviation !== undefined && record.useTalkGroupAbbreviation !== null) {
    settings.useTalkGroupAbbreviation = expectBoolean(
      record.useTalkGroupAbbreviation,
      `${label}.useTalkGroupAbbreviation`,
    );
  }
  if (
    record.exportZoneDerivedScanLists !== undefined &&
    record.exportZoneDerivedScanLists !== null
  ) {
    settings.exportZoneDerivedScanLists = expectBoolean(
      record.exportZoneDerivedScanLists,
      `${label}.exportZoneDerivedScanLists`,
    );
  }
  if (
    record.multiTalkGroupExportNameMode !== undefined &&
    record.multiTalkGroupExportNameMode !== null
  ) {
    settings.multiTalkGroupExportNameMode = expectString(
      record.multiTalkGroupExportNameMode,
      `${label}.multiTalkGroupExportNameMode`,
    ) as BuildExportSettings['multiTalkGroupExportNameMode'];
  }
  if (record.expandModes !== undefined && record.expandModes !== null) {
    settings.expandModes = expectBoolean(record.expandModes, `${label}.expandModes`);
  }
  if (record.expandRxGroupLists !== undefined && record.expandRxGroupLists !== null) {
    settings.expandRxGroupLists = expectBoolean(
      record.expandRxGroupLists,
      `${label}.expandRxGroupLists`,
    );
  }
  if (record.expandRxGroupListMembers !== undefined && record.expandRxGroupListMembers !== null) {
    const value = expectString(
      record.expandRxGroupListMembers,
      `${label}.expandRxGroupListMembers`,
    );
    if (value !== 'all' && value !== 'talkGroupsOnly') {
      throw new NativeYamlImportError(`${label}.expandRxGroupListMembers is invalid: ${value}`);
    }
    settings.expandRxGroupListMembers = value;
  }
  return Object.keys(settings).length > 0 ? settings : undefined;
}

interface ParsedFormatBuild {
  build: FormatBuild;
  legacy: {
    channelSelections?: LegacyEntitySelection[];
    zoneSelections?: LegacyEntitySelection[];
    talkGroupSelections?: LegacyEntitySelection[];
    rxGroupListSelections?: LegacyEntitySelection[];
    contactSelections?: LegacyEntitySelection[];
  };
}

function parseFormatBuild(raw: unknown, index: number): ParsedFormatBuild {
  const record = expectRecord(raw, `formatBuilds[${index}]`);
  const label = `formatBuilds[${index}]`;
  const legacy = {
    channelSelections:
      record.channelSelections !== undefined && record.channelSelections !== null
        ? parseLegacySelectionArray(record.channelSelections, `${label}.channelSelections`)
        : undefined,
    zoneSelections:
      record.zoneSelections !== undefined && record.zoneSelections !== null
        ? parseLegacySelectionArray(record.zoneSelections, `${label}.zoneSelections`)
        : undefined,
    talkGroupSelections:
      record.talkGroupSelections !== undefined && record.talkGroupSelections !== null
        ? parseLegacySelectionArray(record.talkGroupSelections, `${label}.talkGroupSelections`)
        : undefined,
    rxGroupListSelections:
      record.rxGroupListSelections !== undefined && record.rxGroupListSelections !== null
        ? parseLegacySelectionArray(record.rxGroupListSelections, `${label}.rxGroupListSelections`)
        : undefined,
    contactSelections:
      record.contactSelections !== undefined && record.contactSelections !== null
        ? parseLegacySelectionArray(record.contactSelections, `${label}.contactSelections`)
        : undefined,
  };

  const build: FormatBuild = {
    ...parsePersistableRow(record, label),
    formatId: expectString(record.formatId, `${label}.formatId`),
    profileId: expectString(record.profileId, `${label}.profileId`),
    name: expectString(record.name, `${label}.name`),
    layout: parseTraitLayout(record.layout),
    channelOverrides: parseOverrideField(record, 'channelOverrides', 'channelSelections', label),
    zoneOverrides: parseOverrideField(record, 'zoneOverrides', 'zoneSelections', label),
    scanListOverrides: parseOverrideField(record, 'scanListOverrides', '', label),
    talkGroupOverrides: parseOverrideField(
      record,
      'talkGroupOverrides',
      'talkGroupSelections',
      label,
    ),
    rxGroupListOverrides: parseOverrideField(
      record,
      'rxGroupListOverrides',
      'rxGroupListSelections',
      label,
    ),
    contactOverrides: parseOverrideField(record, 'contactOverrides', 'contactSelections', label),
    ...(record.exportUnlinkedChannels !== undefined && record.exportUnlinkedChannels !== null
      ? {
          exportUnlinkedChannels: expectBoolean(
            record.exportUnlinkedChannels,
            `${label}.exportUnlinkedChannels`,
          ),
        }
      : {}),
    ...(record.exportUnlinkedTalkGroups !== undefined && record.exportUnlinkedTalkGroups !== null
      ? {
          exportUnlinkedTalkGroups: expectBoolean(
            record.exportUnlinkedTalkGroups,
            `${label}.exportUnlinkedTalkGroups`,
          ),
        }
      : {}),
    ...(record.exportUnlinkedRxGroupLists !== undefined &&
    record.exportUnlinkedRxGroupLists !== null
      ? {
          exportUnlinkedRxGroupLists: expectBoolean(
            record.exportUnlinkedRxGroupLists,
            `${label}.exportUnlinkedRxGroupLists`,
          ),
        }
      : {}),
    ...(record.exportSettings !== undefined && record.exportSettings !== null
      ? { exportSettings: parseExportSettings(record.exportSettings, `${label}.exportSettings`) }
      : {}),
  };

  return { build, legacy };
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
          ...(zone.exportScratchChannel !== undefined && zone.exportScratchChannel !== null
            ? {
                exportScratchChannel: expectBoolean(
                  zone.exportScratchChannel,
                  `layout.sections[${index}].zones[${zoneIndex}].exportScratchChannel`,
                ),
              }
            : {}),
          ...(zone.exportScanList !== undefined && zone.exportScanList !== null
            ? {
                exportScanList: expectBoolean(
                  zone.exportScanList,
                  `layout.sections[${index}].zones[${zoneIndex}].exportScanList`,
                ),
              }
            : {}),
          ...(zone.scanCarrierFrequencyHz !== undefined
            ? {
                scanCarrierFrequencyHz: expectNullableNumber(
                  zone.scanCarrierFrequencyHz,
                  `layout.sections[${index}].zones[${zoneIndex}].scanCarrierFrequencyHz`,
                ),
              }
            : {}),
        };
      },
    );
    return { kind: 'zoneGrouping', zones } satisfies ZoneGroupingLayout;
  }
  if (kind === 'scanLists') {
    const scanLists = expectArray(record.scanLists, `layout.sections[${index}].scanLists`).map(
      (listRaw, listIndex) => {
        const list = expectRecord(listRaw, `layout.sections[${index}].scanLists[${listIndex}]`);
        return {
          id: expectString(list.id, `layout.sections[${index}].scanLists[${listIndex}].id`),
          name: expectString(list.name, `layout.sections[${index}].scanLists[${listIndex}].name`),
          channelIds: expectArray(
            list.channelIds,
            `layout.sections[${index}].scanLists[${listIndex}].channelIds`,
          ).map((id, idIndex) =>
            expectString(
              id,
              `layout.sections[${index}].scanLists[${listIndex}].channelIds[${idIndex}]`,
            ),
          ),
        };
      },
    );
    return { kind: 'scanLists', scanLists } satisfies ScanListsLayout;
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

function parseProjectInterchange(raw: unknown): ProjectInterchange | undefined {
  if (raw === undefined || raw === null) return undefined;
  const record = expectRecord(raw, 'project.interchange');
  const interchange: ProjectInterchange = {};

  if (record.localFile !== undefined && record.localFile !== null) {
    const local = expectRecord(record.localFile, 'project.interchange.localFile');
    interchange.localFile = {
      fileName: expectString(local.fileName, 'project.interchange.localFile.fileName'),
      exportedAt: expectString(local.exportedAt, 'project.interchange.localFile.exportedAt'),
    } satisfies LocalFileInterchange;
  }

  if (record.googleDrive !== undefined && record.googleDrive !== null) {
    const drive = expectRecord(record.googleDrive, 'project.interchange.googleDrive');
    interchange.googleDrive = {
      folderId: expectString(drive.folderId, 'project.interchange.googleDrive.folderId'),
      folderName:
        drive.folderName === undefined || drive.folderName === null
          ? undefined
          : expectString(drive.folderName, 'project.interchange.googleDrive.folderName'),
      fileId: expectString(drive.fileId, 'project.interchange.googleDrive.fileId'),
      fileName: expectString(drive.fileName, 'project.interchange.googleDrive.fileName'),
      exportedAt: expectString(drive.exportedAt, 'project.interchange.googleDrive.exportedAt'),
    } satisfies GoogleDriveInterchange;
  }

  return Object.keys(interchange).length > 0 ? interchange : {};
}

function parseProjectMeta(raw: unknown): ProjectMeta {
  const record = expectRecord(raw, 'project');
  const interchange =
    record.interchange === undefined ? undefined : parseProjectInterchange(record.interchange);
  return {
    ...parsePersistableRow(record, 'project'),
    name: expectString(record.name, 'project.name'),
    description: expectString(record.description, 'project.description'),
    notes: expectString(record.notes, 'project.notes'),
    author: expectString(record.author, 'project.author'),
    createdAt: expectString(record.createdAt, 'project.createdAt'),
    ...(interchange !== undefined ? { interchange } : {}),
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
      validateZoneMembers(zone.id, zone.members, library);
    } catch (error) {
      throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
    }
  }

  for (const channel of library.channels) {
    if (channel.scanListId) {
      try {
        validateScanListId(channel.scanListId, library);
      } catch (error) {
        throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
      }
    }
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

  for (const list of library.scanLists) {
    try {
      validateScanListMembers(list.memberChannelIds, library);
    } catch (error) {
      throw new NativeYamlImportError(error instanceof Error ? error.message : String(error));
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
      if (section.kind === 'scanLists') {
        for (const scanList of section.scanLists) {
          for (const channelId of scanList.channelIds) {
            if (!ids.channelIds.has(channelId)) {
              throw new NativeYamlImportError(
                `Trait layout channel ${channelId} not found in library`,
              );
            }
          }
        }
      }
    }

    const scanListIds = new Set(library.scanLists.map((list) => list.id));
    for (const section of build.layout.sections) {
      if (section.kind === 'scanLists') {
        for (const scanList of section.scanLists) {
          scanListIds.add(scanList.id);
        }
      }
    }

    for (const override of build.channelOverrides) {
      if (!ids.channelIds.has(override.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build channel override ${override.libraryEntityId} not found in library`,
        );
      }
      if (override.scanListId && !scanListIds.has(override.scanListId)) {
        throw new NativeYamlImportError(
          `Build channel override scanListId ${override.scanListId} not found in library scan lists`,
        );
      }
    }
    for (const override of build.zoneOverrides) {
      if (!ids.zoneIds.has(override.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build zone override ${override.libraryEntityId} not found in library`,
        );
      }
    }
    for (const override of build.talkGroupOverrides) {
      if (!ids.talkGroupIds.has(override.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build talk group override ${override.libraryEntityId} not found in library`,
        );
      }
    }
    for (const override of build.rxGroupListOverrides) {
      if (!ids.rxGroupListIds.has(override.libraryEntityId)) {
        throw new NativeYamlImportError(
          `Build RX group list override ${override.libraryEntityId} not found in library`,
        );
      }
    }
    for (const override of build.contactOverrides) {
      const contactId = override.libraryEntityId;
      if (!ids.digitalContactIds.has(contactId) && !ids.analogContactIds.has(contactId)) {
        throw new NativeYamlImportError(`Build contact override ${contactId} not found in library`);
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

  const studioSchemaVersion = document.studioSchemaVersion;
  if (
    studioSchemaVersion !== STUDIO_SCHEMA_VERSION &&
    studioSchemaVersion !== 12 &&
    studioSchemaVersion !== 10 &&
    studioSchemaVersion !== 9 &&
    studioSchemaVersion !== 8 &&
    studioSchemaVersion !== 7 &&
    studioSchemaVersion !== 6 &&
    studioSchemaVersion !== 5 &&
    studioSchemaVersion !== 4 &&
    studioSchemaVersion !== 3 &&
    studioSchemaVersion !== 2
  ) {
    throw new NativeYamlImportError(
      `Unsupported studioSchemaVersion: ${String(studioSchemaVersion)} (expected ${STUDIO_SCHEMA_VERSION}, 12, 10, 9, 8, 7, 6, 5, 4, 3, or 2)`,
    );
  }

  const project = parseProjectMeta(document.project);
  const library = parseLibrary(document.library, studioSchemaVersion);
  const formatBuilds = expectArray(document.formatBuilds, 'formatBuilds')
    .map((row, index) => parseFormatBuild(row, index))
    .map(({ build, legacy }) => migrateFormatBuild(build, library, legacy));

  const allRows = [
    project,
    ...library.channels,
    ...library.zones,
    ...library.talkGroups,
    ...library.digitalContacts,
    ...library.analogContacts,
    ...library.rxGroupLists,
    ...library.scanLists,
    ...formatBuilds,
  ];

  assertProjectId(allRows, project.id, 'row');
  assertUniqueIds(library.channels, 'library.channels');
  assertUniqueIds(library.zones, 'library.zones');
  assertUniqueIds(library.talkGroups, 'library.talkGroups');
  assertUniqueIds(library.digitalContacts, 'library.digitalContacts');
  assertUniqueIds(library.analogContacts, 'library.analogContacts');
  assertUniqueIds(library.rxGroupLists, 'library.rxGroupLists');
  assertUniqueIds(library.scanLists, 'library.scanLists');
  assertUniqueIds(formatBuilds, 'formatBuilds');

  validateForeignKeys(library, formatBuilds);

  return migrateProjectAggregate({
    meta: project,
    channels: library.channels,
    zones: library.zones,
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    analogContacts: library.analogContacts,
    rxGroupLists: library.rxGroupLists,
    scanLists: library.scanLists,
    formatBuilds,
  });
}

export function isNativeYamlDocument(raw: unknown): boolean {
  return isRecord(raw) && 'schemaVersion' in raw && 'project' in raw;
}
