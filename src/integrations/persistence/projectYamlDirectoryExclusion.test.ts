import { describe, expect, it } from 'vitest';
import { newDigitalContact, newProjectMeta } from '@core/domain/factories.ts';
import { parse as parseYaml } from 'yaml';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { exportProjectYaml } from '@core/services/exportProjectYaml.ts';
import type { ProjectInterchangePort } from '@core/services/projectInterchangePort.ts';
import type { ProjectSeed } from '@integrations/persistence/types.ts';

function asPort(store: InMemoryProjectPersistence): ProjectInterchangePort {
  return {
    seedProject: (seed) => store.seedProject(seed as ProjectSeed),
    replaceProject: (projectId, seed) => store.replaceProject(projectId, seed as ProjectSeed),
    loadProjectSeed: (projectId) => store.loadProjectSeed(projectId),
    putProjectMeta: (row, expectedRevision) => store.putProjectMeta(row, expectedRevision),
  };
}

describe('project YAML directory shadow exclusion', () => {
  it('never serialises digitalIdDirectory rows into native YAML', async () => {
    const store = new InMemoryProjectPersistence();
    const port = asPort(store);
    const meta = newProjectMeta('Shadow test');
    const libraryContact = newDigitalContact(meta.projectId, 'Library only', 111);
    await store.seedProject({ meta, digitalContacts: [libraryContact] });
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: meta.projectId,
        digitalId: 999999,
        mode: 'dmr',
        callsign: 'SHADOW',
        name: 'Shadow only',
        city: '',
        state: '',
        country: '',
      },
    ]);

    const exported = await exportProjectYaml(port, meta.projectId);
    expect(exported.content).not.toContain('digitalIdDirectory');
    expect(exported.content).not.toContain('Shadow only');
    expect(exported.content).not.toContain('999999');

    const parsed = parseYaml(exported.content) as {
      library?: { digitalContacts?: { digitalId?: number; name?: string }[] };
    };
    expect(parsed.library?.digitalContacts).toHaveLength(1);
    expect(parsed.library?.digitalContacts?.[0]?.digitalId).toBe(111);
    expect(parsed.library?.digitalContacts?.[0]?.name).toBe('Library only');
  });

  it('keeps project YAML size stable when directory shadow grows', async () => {
    const store = new InMemoryProjectPersistence();
    const port = asPort(store);
    const meta = newProjectMeta('Size test');
    await store.seedProject({
      meta,
      digitalContacts: [newDigitalContact(meta.projectId, 'One', 1)],
    });

    const smallExport = await exportProjectYaml(port, meta.projectId);
    const manyRows = Array.from({ length: 500 }, (_, index) => ({
      projectId: meta.projectId,
      digitalId: 1_000_000 + index,
      mode: 'dmr' as const,
      callsign: `CALL${index}`,
      name: `Shadow ${index}`,
      city: '',
      state: '',
      country: '',
    }));
    await store.putDigitalIdDirectoryEntriesBatch(manyRows);

    const largeDirectoryExport = await exportProjectYaml(port, meta.projectId);
    expect(largeDirectoryExport.content.length).toBe(smallExport.content.length);
  });
});
