import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  Library,
  RxGroupList,
  ScanList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import type { ChannelBehaviourDefaults } from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import type { ZoneBehaviourDefaults } from '@core/models/zoneBehaviourDefaults.ts';
import { DEFAULT_ZONE_BEHAVIOUR_DEFAULTS } from '@core/models/zoneBehaviourDefaults.ts';
import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from '@core/domain/normalizeZoneBehaviourDefaults.ts';
import { STUDIO_SCHEMA_VERSION } from '@core/models/schemaVersion.ts';

/** Native YAML wire format version — bump when envelope shape changes. */
export const NATIVE_YAML_SCHEMA_VERSION = 1;

/**
 * Full-project interchange envelope for native YAML v1.
 * Serialises library entities, radio builds, and egress paths for one project (#654).
 */
export interface StudioProjectDocument {
  schemaVersion: typeof NATIVE_YAML_SCHEMA_VERSION;
  studioSchemaVersion: number;
  project: ProjectMeta;
  library: Library;
  radioBuilds: RadioBuild[];
  egressPaths: EgressPath[];
}

/**
 * In-memory project aggregate — mirrors {@link ProjectSeed} in integrations without
 * coupling core to the persistence port. Application services bridge the two (#59).
 */
export interface ProjectAggregate {
  meta: ProjectMeta;
  /** Mirrored from meta for assemble/export convenience. */
  channelDefaults?: ChannelBehaviourDefaults;
  /** Mirrored from meta for assemble/export convenience. */
  zoneDefaults?: ZoneBehaviourDefaults;
  channels: Channel[];
  zones: Zone[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  analogContacts: AnalogContact[];
  rxGroupLists: RxGroupList[];
  scanLists: ScanList[];
  aprsConfiguration: AprsConfiguration | null;
  radioBuilds: RadioBuild[];
  egressPaths: EgressPath[];
}

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

export function documentFromAggregate(aggregate: ProjectAggregate): StudioProjectDocument {
  return {
    schemaVersion: NATIVE_YAML_SCHEMA_VERSION,
    studioSchemaVersion: STUDIO_SCHEMA_VERSION,
    project: aggregate.meta,
    library: {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: aggregate.scanLists,
      aprsConfiguration: aggregate.aprsConfiguration,
      channelDefaults: normalizeChannelBehaviourDefaults(
        aggregate.meta.channelDefaults ?? aggregate.channelDefaults,
      ),
      zoneDefaults: normalizeZoneBehaviourDefaults(
        aggregate.meta.zoneDefaults ?? aggregate.zoneDefaults,
      ),
    },
    radioBuilds: aggregate.radioBuilds,
    egressPaths: aggregate.egressPaths,
  };
}

export function aggregateFromDocument(doc: StudioProjectDocument): ProjectAggregate {
  const channelDefaults = normalizeChannelBehaviourDefaults(
    doc.library.channelDefaults ?? doc.project.channelDefaults,
  );
  const zoneDefaults = normalizeZoneBehaviourDefaults(
    doc.library.zoneDefaults ?? doc.project.zoneDefaults,
  );
  return {
    meta: { ...doc.project, channelDefaults, zoneDefaults },
    channelDefaults,
    zoneDefaults,
    channels: doc.library.channels,
    zones: doc.library.zones,
    talkGroups: doc.library.talkGroups,
    digitalContacts: doc.library.digitalContacts,
    analogContacts: doc.library.analogContacts,
    rxGroupLists: doc.library.rxGroupLists,
    scanLists: doc.library.scanLists ?? [],
    aprsConfiguration: doc.library.aprsConfiguration ?? null,
    radioBuilds: doc.radioBuilds,
    egressPaths: doc.egressPaths,
  };
}
