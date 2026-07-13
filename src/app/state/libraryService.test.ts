import { describe, expect, it } from 'vitest';
import {
  newAprsConfiguration,
  newChannel,
  newProjectMeta,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { LibraryService } from './libraryService.ts';

async function setup() {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  return { persistence, service: new LibraryService(persistence), projectId: meta.projectId };
}

describe('LibraryService', () => {
  it('aggregates entity rows into a Library', async () => {
    const { persistence, service, projectId } = await setup();
    await persistence.putChannel(newChannel(projectId, 'Local'), null);
    await persistence.putTalkGroup(newTalkGroup(projectId, 'World', 91), null);

    const library = await service.loadLibrary(projectId);
    expect(library.channels).toHaveLength(1);
    expect(library.talkGroups).toHaveLength(1);
    expect(library.zones).toHaveLength(0);
  });

  it('blocks deleting an entity that is still referenced', async () => {
    const { persistence, service, projectId } = await setup();
    const channel = newChannel(projectId, 'Local');
    const zone = {
      ...newZone(projectId, 'Home'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    await persistence.putChannel(channel, null);
    await persistence.putZone(zone, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'channel', channel.id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.references[0]?.fromName).toBe('Home');
    }
    // Channel still present because the delete was blocked.
    expect(await persistence.getChannel(projectId, channel.id)).not.toBeNull();
  });

  it('deletes when no references remain', async () => {
    const { persistence, service, projectId } = await setup();
    const tg = newTalkGroup(projectId, 'Orphan', 1);
    await persistence.putTalkGroup(tg, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'talkGroup', tg.id);
    expect(outcome.ok).toBe(true);
    expect(await persistence.getTalkGroup(projectId, tg.id)).toBeNull();
  });

  it('blocks deleting a zone referenced as a nested member', async () => {
    const { persistence, service, projectId } = await setup();
    const inner = newZone(projectId, 'Inner');
    const outer = {
      ...newZone(projectId, 'Outer'),
      members: [{ kind: 'zone' as const, zoneId: inner.id }],
    };
    await persistence.putZone(inner, null);
    await persistence.putZone(outer, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'zone', inner.id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.references[0]?.fromName).toBe('Outer');
      expect(outcome.references[0]?.relationship).toBe('nested zone member');
    }
    expect(await persistence.getZone(projectId, inner.id)).not.toBeNull();
  });

  it('enforces a single APRS configuration per project on put', async () => {
    const { persistence, projectId } = await setup();
    const first = newAprsConfiguration(projectId, 'First');
    const second = newAprsConfiguration(projectId, 'Second');
    await persistence.putAprsConfiguration(first, null);
    await persistence.putAprsConfiguration(second, null);

    const configs = await persistence.listAprsConfigurations(projectId);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe('Second');
    expect(await persistence.getAprsConfiguration(projectId, first.id)).toBeNull();
  });
});
