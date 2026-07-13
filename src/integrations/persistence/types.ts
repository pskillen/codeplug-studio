import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  ScanList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';

export type PutResult =
  { ok: true; revision: number } | { ok: false; reason: 'revision_conflict' | 'not_found' };

export type EntityKind =
  | 'project'
  | 'channel'
  | 'zone'
  | 'talkGroup'
  | 'digitalContact'
  | 'analogContact'
  | 'rxGroupList'
  | 'scanList'
  | 'formatBuild';

/** Library entity kinds (everything except project metadata). */
export type LibraryEntityKind = Exclude<EntityKind, 'project' | 'formatBuild'>;

/** Cross-tab / same-tab change notification emitted on every write or delete. */
export interface PersistenceChange {
  projectId: string;
  kind: EntityKind;
  id: string;
  op: 'put' | 'delete';
}

export type PersistenceListener = (change: PersistenceChange) => void;

export interface ProjectSeed {
  meta: ProjectMeta;
  channels?: Channel[];
  zones?: Zone[];
  talkGroups?: TalkGroup[];
  digitalContacts?: DigitalContact[];
  analogContacts?: AnalogContact[];
  rxGroupLists?: RxGroupList[];
  scanLists?: ScanList[];
  aprsConfigurations?: AprsConfiguration[];
  formatBuilds?: FormatBuild[];
}

/**
 * Port for project + library persistence. Implementations store one row per
 * editable entity keyed by `projectId` + `id`, enforce optimistic concurrency
 * via `revision`, and emit {@link PersistenceChange} notifications on write.
 *
 * `core` never imports this port; it is the boundary between the app/UI layer
 * and browser storage (see docs/poc-migration/storage.md).
 */
export interface ProjectPersistence {
  listProjects(): Promise<ProjectMeta[]>;
  loadProjectMeta(projectId: string): Promise<ProjectMeta | null>;
  putProjectMeta(row: ProjectMeta, expectedRevision: number | null): Promise<PutResult>;

  getChannel(projectId: string, id: string): Promise<Channel | null>;
  putChannel(row: Channel, expectedRevision: number | null): Promise<PutResult>;
  listChannels(projectId: string): Promise<Channel[]>;

  getZone(projectId: string, id: string): Promise<Zone | null>;
  putZone(row: Zone, expectedRevision: number | null): Promise<PutResult>;
  listZones(projectId: string): Promise<Zone[]>;

  getTalkGroup(projectId: string, id: string): Promise<TalkGroup | null>;
  putTalkGroup(row: TalkGroup, expectedRevision: number | null): Promise<PutResult>;
  listTalkGroups(projectId: string): Promise<TalkGroup[]>;

  getDigitalContact(projectId: string, id: string): Promise<DigitalContact | null>;
  putDigitalContact(row: DigitalContact, expectedRevision: number | null): Promise<PutResult>;
  listDigitalContacts(projectId: string): Promise<DigitalContact[]>;

  getAnalogContact(projectId: string, id: string): Promise<AnalogContact | null>;
  putAnalogContact(row: AnalogContact, expectedRevision: number | null): Promise<PutResult>;
  listAnalogContacts(projectId: string): Promise<AnalogContact[]>;

  getRxGroupList(projectId: string, id: string): Promise<RxGroupList | null>;
  putRxGroupList(row: RxGroupList, expectedRevision: number | null): Promise<PutResult>;
  listRxGroupLists(projectId: string): Promise<RxGroupList[]>;

  getScanList(projectId: string, id: string): Promise<ScanList | null>;
  putScanList(row: ScanList, expectedRevision: number | null): Promise<PutResult>;
  listScanLists(projectId: string): Promise<ScanList[]>;

  getFormatBuild(projectId: string, id: string): Promise<FormatBuild | null>;
  putFormatBuild(row: FormatBuild, expectedRevision: number | null): Promise<PutResult>;
  listFormatBuilds(projectId: string): Promise<FormatBuild[]>;

  deleteEntity(projectId: string, kind: EntityKind, id: string): Promise<void>;
  seedProject(seed: ProjectSeed): Promise<void>;
  loadProjectSeed(projectId: string): Promise<ProjectSeed | null>;
  replaceProject(projectId: string, seed: ProjectSeed): Promise<void>;

  /** Subscribe to change notifications. Returns an unsubscribe function. */
  subscribe(listener: PersistenceListener): () => void;
}
