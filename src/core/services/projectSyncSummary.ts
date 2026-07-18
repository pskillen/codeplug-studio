import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { portableSyncedAt } from './interchangeMeta.ts';
import type { ProjectSeed } from './projectInterchangePort.ts';

export interface ProjectSyncCounts {
  channels: number;
  zones: number;
  talkGroups: number;
  digitalContacts: number;
  analogContacts: number;
  rxGroupLists: number;
  scanLists: number;
  aprsConfigurations: number;
  formatBuilds: number;
}

export type ProjectSyncCountKey = keyof ProjectSyncCounts;

export interface ProjectSyncSummary {
  projectId: string;
  projectName: string;
  lastModifiedAt: string | null;
  portableSyncedAt: string | null;
  counts: ProjectSyncCounts;
}

export type ProjectSyncNewerSide = 'local' | 'remote' | 'tie' | 'unknown';

export interface ProjectSyncTimestampRow {
  key: 'lastEdited' | 'lastSynced';
  label: string;
  local: string | null;
  remote: string | null;
  newerSide: ProjectSyncNewerSide;
}

export interface ProjectSyncCountRow {
  key: ProjectSyncCountKey;
  label: string;
  local: number;
  remote: number;
  /** Remote minus local. */
  delta: number;
}

/** Structured local-vs-remote comparison for overwrite / conflict UI. */
export interface ProjectSyncDiff {
  local: ProjectSyncSummary;
  remote: ProjectSyncSummary;
  timestamps: ProjectSyncTimestampRow[];
  counts: ProjectSyncCountRow[];
}

const COUNT_LABELS: Record<ProjectSyncCountKey, string> = {
  channels: 'Channels',
  zones: 'Zones',
  talkGroups: 'Talk groups',
  digitalContacts: 'Digital contacts',
  analogContacts: 'Analog contacts',
  rxGroupLists: 'RX group lists',
  scanLists: 'Scan lists',
  aprsConfigurations: 'APRS configurations',
  formatBuilds: 'Format builds',
};

const COUNT_ORDER: ProjectSyncCountKey[] = [
  'channels',
  'zones',
  'talkGroups',
  'digitalContacts',
  'analogContacts',
  'rxGroupLists',
  'scanLists',
  'aprsConfigurations',
  'formatBuilds',
];

function countRows<T>(rows: T[] | undefined): number {
  return rows?.length ?? 0;
}

function maxIsoTimestamp(values: Array<string | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return null;
  return present.reduce((latest, value) => (value > latest ? value : latest));
}

function countsFromSeed(seed: ProjectSeed): ProjectSyncCounts {
  return {
    channels: countRows(seed.channels),
    zones: countRows(seed.zones),
    talkGroups: countRows(seed.talkGroups),
    digitalContacts: countRows(seed.digitalContacts),
    analogContacts: countRows(seed.analogContacts),
    rxGroupLists: countRows(seed.rxGroupLists),
    scanLists: countRows(seed.scanLists),
    aprsConfigurations: countRows(seed.aprsConfigurations),
    formatBuilds: countRows(seed.formatBuilds),
  };
}

function lastModifiedFromSeed(seed: ProjectSeed): string | null {
  return maxIsoTimestamp([
    seed.meta.updatedAt,
    ...(seed.channels ?? []).map((row) => row.updatedAt),
    ...(seed.zones ?? []).map((row) => row.updatedAt),
    ...(seed.talkGroups ?? []).map((row) => row.updatedAt),
    ...(seed.digitalContacts ?? []).map((row) => row.updatedAt),
    ...(seed.analogContacts ?? []).map((row) => row.updatedAt),
    ...(seed.rxGroupLists ?? []).map((row) => row.updatedAt),
    ...(seed.scanLists ?? []).map((row) => row.updatedAt),
    ...(seed.aprsConfigurations ?? []).map((row) => row.updatedAt),
    ...(seed.formatBuilds ?? []).map((row) => row.updatedAt),
  ]);
}

export function summariseProjectSeed(seed: ProjectSeed): ProjectSyncSummary {
  return {
    projectId: seed.meta.projectId,
    projectName: seed.meta.name,
    lastModifiedAt: lastModifiedFromSeed(seed),
    portableSyncedAt: portableSyncedAt(seed.meta),
    counts: countsFromSeed(seed),
  };
}

export function summariseProjectAggregate(aggregate: ProjectAggregate): ProjectSyncSummary {
  return summariseProjectSeed({
    meta: aggregate.meta,
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfigurations: aggregate.aprsConfiguration ? [aggregate.aprsConfiguration] : [],
    formatBuilds: aggregate.formatBuilds,
  });
}

export function summariseRemoteYamlMeta(
  meta: ProjectMeta,
  counts: ProjectSyncCounts,
  remoteModifiedAt?: string | null,
): ProjectSyncSummary {
  return {
    projectId: meta.projectId,
    projectName: meta.name,
    lastModifiedAt: remoteModifiedAt ?? portableSyncedAt(meta),
    portableSyncedAt: portableSyncedAt(meta),
    counts,
  };
}

function parseTimestampMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function compareSyncTimestamps(
  local: string | null,
  remote: string | null,
): ProjectSyncNewerSide {
  const localMs = parseTimestampMs(local);
  const remoteMs = parseTimestampMs(remote);
  if (localMs == null && remoteMs == null) return 'unknown';
  if (localMs == null) return 'remote';
  if (remoteMs == null) return 'local';
  if (localMs === remoteMs) return 'tie';
  return localMs > remoteMs ? 'local' : 'remote';
}

export function formatSyncTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function formatSyncDelta(delta: number): string {
  if (delta === 0) return '0';
  return delta > 0 ? `+${delta}` : String(delta);
}

export function buildProjectSyncDiff(
  local: ProjectSyncSummary,
  remote: ProjectSyncSummary,
): ProjectSyncDiff {
  const timestamps: ProjectSyncTimestampRow[] = [
    {
      key: 'lastEdited',
      label: 'Last edited',
      local: local.lastModifiedAt,
      remote: remote.lastModifiedAt,
      newerSide: compareSyncTimestamps(local.lastModifiedAt, remote.lastModifiedAt),
    },
    {
      key: 'lastSynced',
      label: 'Last portable sync',
      local: local.portableSyncedAt,
      remote: remote.portableSyncedAt,
      newerSide: compareSyncTimestamps(local.portableSyncedAt, remote.portableSyncedAt),
    },
  ];

  const counts: ProjectSyncCountRow[] = COUNT_ORDER.map((key) => {
    const localCount = local.counts[key];
    const remoteCount = remote.counts[key];
    return {
      key,
      label: COUNT_LABELS[key],
      local: localCount,
      remote: remoteCount,
      delta: remoteCount - localCount,
    };
  });

  return { local, remote, timestamps, counts };
}

/** Compact string lines for logs / legacy tests — prefer {@link buildProjectSyncDiff} in UI. */
export function formatSyncDiffSummary(
  local: ProjectSyncSummary,
  remote: ProjectSyncSummary,
): string[] {
  const diff = buildProjectSyncDiff(local, remote);
  const lines = diff.timestamps.map(
    (row) =>
      `${row.label}: local ${formatSyncTimestamp(row.local)}, remote ${formatSyncTimestamp(row.remote)}`,
  );
  for (const row of diff.counts) {
    lines.push(`${row.label}: local ${row.local}, remote ${row.remote} (${formatSyncDelta(row.delta)})`);
  }
  return lines;
}

/** Buffer for export-then-upload timing and minor Drive clock skew. */
export const PORTABLE_SYNC_TOLERANCE_MS = 2_000;

export function isRemotePortableNewer(
  remoteModifiedAt: string | null | undefined,
  localSyncedAt: string | null | undefined,
): boolean {
  if (!remoteModifiedAt || !localSyncedAt) {
    return false;
  }
  const remoteMs = Date.parse(remoteModifiedAt);
  const localMs = Date.parse(localSyncedAt);
  if (Number.isNaN(remoteMs) || Number.isNaN(localMs)) {
    return remoteModifiedAt > localSyncedAt;
  }
  return remoteMs > localMs + PORTABLE_SYNC_TOLERANCE_MS;
}

export function hasPortableInterchange(meta: ProjectMeta): boolean {
  return Boolean(meta.interchange?.googleDrive ?? meta.interchange?.localFile);
}

export function portableInterchangeLabel(meta: ProjectMeta): string | null {
  const drive = meta.interchange?.googleDrive;
  if (drive) {
    return `Google Drive · ${drive.fileName}`;
  }
  const local = meta.interchange?.localFile;
  if (local) {
    return `Local file · ${local.fileName}`;
  }
  return null;
}
