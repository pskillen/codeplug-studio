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
  formatBuilds: number;
}

export interface ProjectSyncSummary {
  projectId: string;
  projectName: string;
  lastModifiedAt: string | null;
  portableSyncedAt: string | null;
  counts: ProjectSyncCounts;
}

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

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function formatCounts(counts: ProjectSyncCounts): string {
  const parts = [
    `${counts.channels} channel${counts.channels === 1 ? '' : 's'}`,
    `${counts.zones} zone${counts.zones === 1 ? '' : 's'}`,
    `${counts.talkGroups} talk group${counts.talkGroups === 1 ? '' : 's'}`,
    `${counts.formatBuilds} build${counts.formatBuilds === 1 ? '' : 's'}`,
  ];
  return parts.join(', ');
}

export function formatSyncDiffSummary(
  local: ProjectSyncSummary,
  remote: ProjectSyncSummary,
): string[] {
  return [
    `Local last edited: ${formatTimestamp(local.lastModifiedAt)}`,
    `Remote last saved: ${formatTimestamp(remote.portableSyncedAt ?? remote.lastModifiedAt)}`,
    `Local: ${formatCounts(local.counts)}`,
    `Remote: ${formatCounts(remote.counts)}`,
  ];
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
