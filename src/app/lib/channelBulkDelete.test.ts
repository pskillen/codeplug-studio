import { describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta, newScanList, newZone } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { LibraryService } from '../state/libraryService.ts';
import {
  bulkDeleteAlertColor,
  formatChannelBulkDeleteMessage,
  persistChannelBulkDelete,
} from './channelBulkDelete.ts';

async function setupBulkDelete(
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
  return {
    persistence,
    projectId,
    channels,
    deleteEntity,
    reload,
    removeChannelFromDirectZones: (pid: string, channelId: string) =>
      service.removeChannelFromDirectZones(pid, channelId),
  };
}

describe('persistChannelBulkDelete', () => {
  it('deletes all channels with no references', async () => {
    const { persistence, projectId, channels, deleteEntity, reload, removeChannelFromDirectZones } =
      await setupBulkDelete((projectId) => ({
        channels: [newChannel(projectId, 'One'), newChannel(projectId, 'Two')],
      }));

    const outcome = await persistChannelBulkDelete({
      projectId,
      channels,
      deleteEntity,
      reload,
      removeChannelFromDirectZones,
    });

    expect(outcome).toEqual({ deletedCount: 2, failures: [] });
    expect(await persistence.getChannel(projectId, channels[0]!.id)).toBeNull();
    expect(await persistence.getChannel(projectId, channels[1]!.id)).toBeNull();
  });

  it('auto-cascades zone membership before deleting', async () => {
    const { persistence, projectId, channels, deleteEntity, reload, removeChannelFromDirectZones } =
      await setupBulkDelete((projectId) => {
        const channel = newChannel(projectId, 'Zoned');
        const zone = {
          ...newZone(projectId, 'Home'),
          members: [{ kind: 'channel' as const, channelId: channel.id }],
        };
        return { channels: [channel], zones: [zone] };
      });

    const outcome = await persistChannelBulkDelete({
      projectId,
      channels,
      deleteEntity,
      reload,
      removeChannelFromDirectZones,
    });

    expect(outcome).toEqual({ deletedCount: 1, failures: [] });
    expect(await persistence.getChannel(projectId, channels[0]!.id)).toBeNull();
  });

  it('continues when a scan-list member is blocked', async () => {
    const { persistence, projectId, channels, deleteEntity, reload, removeChannelFromDirectZones } =
      await setupBulkDelete((projectId) => {
        const free = newChannel(projectId, 'Free');
        const listed = newChannel(projectId, 'Listed');
        const scanList = {
          ...newScanList(projectId, 'My scan'),
          memberChannelIds: [listed.id],
        };
        return { channels: [free, listed], scanLists: [scanList] };
      });

    const outcome = await persistChannelBulkDelete({
      projectId,
      channels,
      deleteEntity,
      reload,
      removeChannelFromDirectZones,
    });

    expect(outcome.deletedCount).toBe(1);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]?.channelName).toBe('Listed');
    expect(await persistence.getChannel(projectId, channels[0]!.id)).toBeNull();
    expect(await persistence.getChannel(projectId, channels[1]!.id)).not.toBeNull();
  });

  it('reports mixed batch outcomes', async () => {
    const { channels } = await setupBulkDelete((projectId) => {
      const free = newChannel(projectId, 'Free');
      const listed = newChannel(projectId, 'Listed');
      const scanList = {
        ...newScanList(projectId, 'My scan'),
        memberChannelIds: [listed.id],
      };
      return { channels: [free, listed], scanLists: [scanList] };
    });

    const outcome = {
      deletedCount: 1,
      failures: [
        {
          channelId: channels[1]!.id,
          channelName: 'Listed',
          message: 'Delete blocked — My scan (scan list member)',
        },
      ],
    };

    expect(formatChannelBulkDeleteMessage(outcome)).toBe(
      'Deleted 1 channel. 1 not deleted — Listed: Delete blocked — My scan (scan list member).',
    );
    expect(bulkDeleteAlertColor(outcome)).toBe('orange');
  });
});

describe('formatChannelBulkDeleteMessage', () => {
  it('formats full success', () => {
    expect(formatChannelBulkDeleteMessage({ deletedCount: 3, failures: [] })).toBe(
      'Deleted 3 channels.',
    );
  });

  it('formats total failure', () => {
    expect(
      formatChannelBulkDeleteMessage({
        deletedCount: 0,
        failures: [
          {
            channelId: 'ch-1',
            channelName: 'Listed',
            message: 'Delete blocked — My scan (scan list member)',
          },
        ],
      }),
    ).toBe('1 not deleted — Listed: Delete blocked — My scan (scan list member).');
    expect(
      bulkDeleteAlertColor({
        deletedCount: 0,
        failures: [{ channelId: 'ch-1', channelName: 'Listed', message: 'blocked' }],
      }),
    ).toBe('red');
  });
});
