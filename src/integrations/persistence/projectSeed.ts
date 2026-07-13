import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import type { ProjectSeed } from './types.ts';

export function assertSeedProjectId(projectId: string, seed: ProjectSeed): void {
  if (seed.meta.projectId !== projectId) {
    throw new Error(
      `seed meta.projectId (${seed.meta.projectId}) does not match projectId (${projectId})`,
    );
  }
  const rows = [
    ...(seed.channels ?? []),
    ...(seed.zones ?? []),
    ...(seed.talkGroups ?? []),
    ...(seed.digitalContacts ?? []),
    ...(seed.analogContacts ?? []),
    ...(seed.rxGroupLists ?? []),
    ...(seed.scanLists ?? []),
    ...(seed.aprsConfigurations ?? []),
    ...(seed.formatBuilds ?? []),
  ];
  for (const row of rows) {
    if (row.projectId !== projectId) {
      throw new Error(`seed row ${row.id} has projectId ${row.projectId}, expected ${projectId}`);
    }
  }
}

export function seedFromAggregate(aggregate: ProjectAggregate): ProjectSeed {
  return {
    meta: aggregate.meta,
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfigurations: aggregate.aprsConfigurations,
    formatBuilds: aggregate.formatBuilds,
  };
}

export function aggregateFromSeed(seed: ProjectSeed): ProjectAggregate {
  return {
    meta: seed.meta,
    channels: seed.channels ?? [],
    zones: seed.zones ?? [],
    talkGroups: seed.talkGroups ?? [],
    digitalContacts: seed.digitalContacts ?? [],
    analogContacts: seed.analogContacts ?? [],
    rxGroupLists: seed.rxGroupLists ?? [],
    scanLists: seed.scanLists ?? [],
    aprsConfigurations: seed.aprsConfigurations ?? [],
    formatBuilds: seed.formatBuilds ?? [],
  };
}
