import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { formatChannelBulkEditMessage, persistChannelBulkEdit } from './channelBulkEdit.ts';

describe('persistChannelBulkEdit', () => {
  it('updates channels that would change and skips no-ops', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const unchanged: Channel = {
      ...newChannel(meta.projectId, 'Same'),
      scanInclusion: 'skip' as const,
    };
    const toUpdate: Channel = {
      ...newChannel(meta.projectId, 'Update me'),
      scanInclusion: 'default' as const,
    };
    await store.seedProject({ meta, channels: [unchanged, toUpdate] });

    const outcome = await persistChannelBulkEdit({
      persistence: store,
      channels: [unchanged, toUpdate],
      patch: { scanInclusion: 'skip' },
    });

    expect(outcome).toEqual({ ok: true, updatedCount: 1, skippedCount: 1 });

    const loaded = await store.getChannel(meta.projectId, toUpdate.id);
    expect(loaded?.scanInclusion).toBe('skip');
  });

  it('stops on revision conflict', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const first = newChannel(meta.projectId, 'First');
    const second = newChannel(meta.projectId, 'Second');
    await store.seedProject({ meta, channels: [first, second] });

    await store.putChannel({ ...first, name: 'First stale' }, 1);

    const outcome = await persistChannelBulkEdit({
      persistence: store,
      channels: [first, second],
      patch: { forbidTransmit: 'forbid' },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('revision_conflict');
      expect(outcome.updatedCount).toBe(0);
    }
  });

  it('patches analog squelch on channels with analog profiles', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const fm: Channel = {
      ...newChannel(meta.projectId, 'FM'),
      modeProfiles: [defaultModeProfile('fm')],
    };
    await store.seedProject({ meta, channels: [fm] });

    const outcome = await persistChannelBulkEdit({
      persistence: store,
      channels: [fm],
      patch: { analogSquelch: 50 },
    });

    expect(outcome).toEqual({ ok: true, updatedCount: 1, skippedCount: 0 });
    const loaded = await store.getChannel(meta.projectId, fm.id);
    expect(loaded?.modeProfiles[0]).toMatchObject({ squelch: 50 });
  });
});

describe('formatChannelBulkEditMessage', () => {
  it('formats updated and skipped counts', () => {
    expect(formatChannelBulkEditMessage({ ok: true, updatedCount: 3, skippedCount: 2 })).toBe(
      'Updated 3 channels; 2 unchanged (values already matched or no applicable mode profile).',
    );
  });
});
