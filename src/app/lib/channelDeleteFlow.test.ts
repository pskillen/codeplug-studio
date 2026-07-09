import { describe, expect, it, vi } from 'vitest';
import { newChannel, newProjectMeta, newScanList, newZone } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { LibraryService } from '../state/libraryService.ts';
import { deleteChannelWithOptionalZoneCascade } from './channelDeleteFlow.ts';

async function setupChannels(
  build: (projectId: string) => {
    channels: ReturnType<typeof newChannel>[];
    zones?: ReturnType<typeof newZone>[];
    scanLists?: ReturnType<typeof newScanList>[];
  },
) {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  const { channels, zones, scanLists } = build(meta.projectId);
  await persistence.seedProject({
    meta,
    channels,
    zones: zones ?? [],
    scanLists: scanLists ?? [],
  });
  const service = new LibraryService(persistence);
  const projectId = meta.projectId;
  const deleteEntity = (kind: 'channel', id: string) =>
    service.deleteWithIntegrity(projectId, kind, id);
  const reload = async () => {
    await service.loadLibrary(projectId);
  };
  return { persistence, projectId, deleteEntity, reload, channels, service };
}

describe('deleteChannelWithOptionalZoneCascade', () => {
  it('deletes a channel with no references', async () => {
    const { persistence, projectId, deleteEntity, reload, channels } = await setupChannels(
      (projectId) => ({
        channels: [newChannel(projectId, 'Free')],
      }),
    );
    const channel = channels[0]!;

    const result = await deleteChannelWithOptionalZoneCascade({
      projectId,
      channel,
      deleteEntity,
      reload,
      zoneCascade: 'auto',
    });

    expect(result).toEqual({ status: 'deleted' });
    expect(await persistence.getChannel(projectId, channel.id)).toBeNull();
  });

  it('auto-cascades zone membership and deletes', async () => {
    const { persistence, projectId, deleteEntity, reload, channels, service } = await setupChannels(
      (projectId) => {
        const channel = newChannel(projectId, 'Zoned');
        const zone = {
          ...newZone(projectId, 'Home'),
          members: [{ kind: 'channel' as const, channelId: channel.id }],
        };
        return { channels: [channel], zones: [zone] };
      },
    );
    const channel = channels[0]!;

    const result = await deleteChannelWithOptionalZoneCascade({
      projectId,
      channel,
      deleteEntity,
      reload,
      zoneCascade: 'auto',
      removeChannelFromDirectZones: (pid, channelId) =>
        service.removeChannelFromDirectZones(pid, channelId),
    });

    expect(result).toEqual({ status: 'deleted' });
    expect(await persistence.getChannel(projectId, channel.id)).toBeNull();
    const library = await service.loadLibrary(projectId);
    expect(library.zones[0]?.members).toEqual([]);
  });

  it('blocks when a scan list references the channel', async () => {
    const { persistence, projectId, deleteEntity, reload, channels } = await setupChannels(
      (projectId) => {
        const channel = newChannel(projectId, 'Listed');
        const scanList = {
          ...newScanList(projectId, 'My scan'),
          memberChannelIds: [channel.id],
        };
        return { channels: [channel], scanLists: [scanList] };
      },
    );
    const channel = channels[0]!;

    const result = await deleteChannelWithOptionalZoneCascade({
      projectId,
      channel,
      deleteEntity,
      reload,
      zoneCascade: 'auto',
    });

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.message).toContain('My scan');
      expect(result.message).toContain('scan list member');
    }
    expect(await persistence.getChannel(projectId, channel.id)).not.toBeNull();
  });

  it('prompt mode cancels when zone cascade is declined', async () => {
    const { persistence, projectId, deleteEntity, reload, channels, service } = await setupChannels(
      (projectId) => {
        const channel = newChannel(projectId, 'Zoned');
        const zone = {
          ...newZone(projectId, 'Home'),
          members: [{ kind: 'channel' as const, channelId: channel.id }],
        };
        return { channels: [channel], zones: [zone] };
      },
    );
    const channel = channels[0]!;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const result = await deleteChannelWithOptionalZoneCascade({
      projectId,
      channel,
      deleteEntity,
      reload,
      zoneCascade: 'prompt',
      removeChannelFromDirectZones: (pid, channelId) =>
        service.removeChannelFromDirectZones(pid, channelId),
    });

    expect(result).toEqual({ status: 'cancelled' });
    expect(await persistence.getChannel(projectId, channel.id)).not.toBeNull();
    confirm.mockRestore();
  });
});
