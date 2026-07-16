import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import { migrateProjectAggregate } from '@core/domain/migrateZoneExportFields.ts';
import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import { newId } from '@core/models/ids.ts';
import type { ProjectSeed } from './projectInterchangePort.ts';

export function aggregateToSeed(aggregate: ProjectAggregate): ProjectSeed {
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
    formatBuilds: aggregate.formatBuilds,
  };
}

export function seedToAggregate(seed: ProjectSeed): ProjectAggregate {
  const channelDefaults = normalizeChannelBehaviourDefaults(seed.meta.channelDefaults);
  return migrateProjectAggregate({
    meta: { ...seed.meta, channelDefaults },
    channelDefaults,
    channels: seed.channels ?? [],
    zones: seed.zones ?? [],
    talkGroups: seed.talkGroups ?? [],
    digitalContacts: seed.digitalContacts ?? [],
    analogContacts: seed.analogContacts ?? [],
    rxGroupLists: seed.rxGroupLists ?? [],
    scanLists: seed.scanLists ?? [],
    aprsConfiguration: seed.aprsConfigurations?.[0] ?? null,
    formatBuilds: seed.formatBuilds ?? [],
  });
}

/** Assign a fresh project id to meta and every seeded row (import createNew). */
export function reassignSeedProjectId(seed: ProjectSeed, projectId: string = newId()): ProjectSeed {
  const meta = { ...seed.meta, id: projectId, projectId };
  const withProject = <T extends { projectId: string }>(rows: T[] | undefined): T[] | undefined =>
    rows?.map((row) => ({ ...row, projectId }));

  return {
    meta,
    channels: withProject(seed.channels),
    zones: withProject(seed.zones),
    talkGroups: withProject(seed.talkGroups),
    digitalContacts: withProject(seed.digitalContacts),
    analogContacts: withProject(seed.analogContacts),
    rxGroupLists: withProject(seed.rxGroupLists),
    scanLists: withProject(seed.scanLists),
    aprsConfigurations: withProject(seed.aprsConfigurations),
    formatBuilds: withProject(seed.formatBuilds),
  };
}

export function normaliseSeedForProject(seed: ProjectSeed, projectId: string): ProjectSeed {
  const meta = { ...seed.meta, id: projectId, projectId };
  const withProject = <T extends { projectId: string }>(rows: T[] | undefined): T[] | undefined =>
    rows?.map((row) => ({ ...row, projectId }));

  return {
    meta,
    channels: withProject(seed.channels),
    zones: withProject(seed.zones),
    talkGroups: withProject(seed.talkGroups),
    digitalContacts: withProject(seed.digitalContacts),
    analogContacts: withProject(seed.analogContacts),
    rxGroupLists: withProject(seed.rxGroupLists),
    scanLists: withProject(seed.scanLists),
    aprsConfigurations: withProject(seed.aprsConfigurations),
    formatBuilds: withProject(seed.formatBuilds),
  };
}
