import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newProjectMeta, newZone } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import {
  formatChannelBulkZoneMembershipMessage,
  persistChannelBulkZoneMembership,
} from './channelBulkZoneMembership.ts';

describe('persistChannelBulkZoneMembership', () => {
  it('adds selected channels and skips zones that already have them', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const ch1 = newChannel(meta.projectId, 'One');
    const ch2 = newChannel(meta.projectId, 'Two');
    const already = {
      ...newZone(meta.projectId, 'Already'),
      members: [
        { kind: 'channel' as const, channelId: ch1.id },
        { kind: 'channel' as const, channelId: ch2.id },
      ],
    };
    const target = newZone(meta.projectId, 'Target');
    const library = {
      ...emptyLibrary(),
      channels: [ch1, ch2],
      zones: [already, target],
    };
    await store.seedProject({ meta, channels: [ch1, ch2], zones: [already, target] });

    const outcome = await persistChannelBulkZoneMembership({
      persistence: store,
      library,
      channelIds: [ch1.id, ch2.id],
      addToZoneIds: [already.id, target.id],
      removeFromZoneIds: [],
    });

    expect(outcome).toEqual({ ok: true, updatedCount: 1, skippedCount: 1 });
    const loaded = await store.getZone(meta.projectId, target.id);
    expect(loaded?.members).toEqual([
      { kind: 'channel', channelId: ch1.id },
      { kind: 'channel', channelId: ch2.id },
    ]);
  });

  it('removes direct members and skips nested-only zones', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Nested');
    const child = {
      ...newZone(meta.projectId, 'Child'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const parent = {
      ...newZone(meta.projectId, 'Parent'),
      members: [{ kind: 'zone' as const, zoneId: child.id }],
    };
    const library = { ...emptyLibrary(), channels: [channel], zones: [child, parent] };
    await store.seedProject({ meta, channels: [channel], zones: [child, parent] });

    const outcome = await persistChannelBulkZoneMembership({
      persistence: store,
      library,
      channelIds: [channel.id],
      addToZoneIds: [],
      removeFromZoneIds: [parent.id, child.id],
    });

    expect(outcome).toEqual({ ok: true, updatedCount: 1, skippedCount: 1 });
    const loadedChild = await store.getZone(meta.projectId, child.id);
    const loadedParent = await store.getZone(meta.projectId, parent.id);
    expect(loadedChild?.members).toEqual([]);
    expect(loadedParent?.members).toEqual([{ kind: 'zone', zoneId: child.id }]);
  });
});

describe('formatChannelBulkZoneMembershipMessage', () => {
  it('formats updated and skipped counts', () => {
    expect(
      formatChannelBulkZoneMembershipMessage({ ok: true, updatedCount: 2, skippedCount: 1 }),
    ).toBe('Updated 2 zones; 1 zone unchanged (already members or nested-only).');
  });
});
