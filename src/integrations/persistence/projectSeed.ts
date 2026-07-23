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
    ...(seed.radioBuilds ?? []),
    ...(seed.egressPaths ?? []),
  ];
  for (const row of rows) {
    if (row.projectId !== projectId) {
      throw new Error(`seed row ${row.id} has projectId ${row.projectId}, expected ${projectId}`);
    }
  }
}

/**
 * Bridge {@link ProjectAggregate} (native YAML / core) to {@link ProjectSeed}
 * (persistence port). `ProjectAggregate.formatBuilds` still holds the pre-#654
 * `RadioBuild` shape — mapped onto `seed.radioBuilds`; `egressPaths` are not yet
 * modelled on the aggregate (native YAML egress support lands in a later slice
 * of #654), so they round-trip empty here.
 */
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
    aprsConfigurations: aggregate.aprsConfiguration ? [aggregate.aprsConfiguration] : [],
    radioBuilds: aggregate.formatBuilds,
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
    aprsConfiguration: seed.aprsConfigurations?.[0] ?? null,
    formatBuilds: seed.radioBuilds ?? [],
  };
}
