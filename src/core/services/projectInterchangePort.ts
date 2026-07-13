import type { FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  ScanList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { ProjectMeta } from '@core/models/project.ts';

export type PutResult =
  { ok: true; revision: number } | { ok: false; reason: 'revision_conflict' | 'not_found' };

/** Core-local seed shape — mirrors integrations {@link ProjectSeed} without importing it. */
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

/** Narrow persistence port for project YAML interchange (#59). */
export interface ProjectInterchangePort {
  seedProject(seed: ProjectSeed): Promise<void>;
  replaceProject(projectId: string, seed: ProjectSeed): Promise<void>;
  loadProjectSeed(projectId: string): Promise<ProjectSeed | null>;
  putProjectMeta(row: ProjectMeta, expectedRevision: number | null): Promise<PutResult>;
}
