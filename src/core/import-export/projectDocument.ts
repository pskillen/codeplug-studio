import type { FormatBuild } from '@core/models/formatBuild.ts';
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
import { STUDIO_SCHEMA_VERSION } from '@core/models/schemaVersion.ts';

/** Native YAML wire format version — bump when envelope shape changes. */
export const NATIVE_YAML_SCHEMA_VERSION = 1;

/**
 * Full-project interchange envelope for native YAML v1.
 * Serialises library entities and all format builds for one project.
 */
export interface StudioProjectDocument {
  schemaVersion: typeof NATIVE_YAML_SCHEMA_VERSION;
  studioSchemaVersion: number;
  project: ProjectMeta;
  library: Library;
  formatBuilds: FormatBuild[];
}

/**
 * In-memory project aggregate — mirrors {@link ProjectSeed} in integrations without
 * coupling core to the persistence port. Application services bridge the two (#59).
 */
export interface ProjectAggregate {
  meta: ProjectMeta;
  channels: Channel[];
  zones: Zone[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  analogContacts: AnalogContact[];
  rxGroupLists: RxGroupList[];
  scanLists: ScanList[];
  aprsConfigurations: AprsConfiguration[];
  formatBuilds: FormatBuild[];
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
    aprsConfigurations: [],
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
      aprsConfigurations: aggregate.aprsConfigurations,
    },
    formatBuilds: aggregate.formatBuilds,
  };
}

export function aggregateFromDocument(doc: StudioProjectDocument): ProjectAggregate {
  return {
    meta: doc.project,
    channels: doc.library.channels,
    zones: doc.library.zones,
    talkGroups: doc.library.talkGroups,
    digitalContacts: doc.library.digitalContacts,
    analogContacts: doc.library.analogContacts,
    rxGroupLists: doc.library.rxGroupLists,
    scanLists: doc.library.scanLists ?? [],
    aprsConfigurations: doc.library.aprsConfigurations ?? [],
    formatBuilds: doc.formatBuilds,
  };
}
