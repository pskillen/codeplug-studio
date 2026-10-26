import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AtD890ScriptedPipe,
  scriptAtD890MinimalDownload,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import * as browserDownload from '@integrations/download/browserDownload.ts';
import { backupLiveRadioSession, packAtD890BackupFromSession } from './radioBackupRestore.ts';

async function downloadedSession() {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890MinimalDownload(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
  await radio.download({});
  return { session, radio };
}

describe('packAtD890BackupFromSession (Review: Save backup now)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T14:02:00.000Z'));
    vi.spyOn(browserDownload, 'downloadZip').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is the zip a Backup of the same radio makes, byte for byte, with no radio traffic', async () => {
    const { session, radio } = await downloadedSession();
    const writesBefore = (session.pipe as AtD890ScriptedPipe).writes.length;

    const fromRead = packAtD890BackupFromSession(session);
    expect((session.pipe as AtD890ScriptedPipe).writes.length).toBe(writesBefore);

    const backup = await backupLiveRadioSession(session);
    expect(fromRead.manifest).toEqual(backup.manifest);
    expect(Array.from(fromRead.zipBytes)).toEqual(Array.from(backup.zipBytes));
    expect(radio.getDownloadCache()!.blocks.size).toBeGreaterThan(0);
  });

  it('packs the copy it is given, so a cache that changed since (an upload) cannot alter it', async () => {
    const { session, radio } = await downloadedSession();
    const cache = radio.getDownloadCache()!;
    const copy = {
      ...cache,
      blocks: new Map([...cache.blocks].map(([a, d]) => [a, d.slice()])),
    };
    const first = packAtD890BackupFromSession(session, { cache: copy });
    // An upload rewrites the live cache after Review.
    for (const data of cache.blocks.values()) data.fill(0x5a);
    const later = packAtD890BackupFromSession(session, { cache: copy });
    expect(Array.from(later.zipBytes)).toEqual(Array.from(first.zipBytes));
    // And it still works after Review sat idle: nothing in it expires.
    vi.setSystemTime(new Date('2026-10-26T15:30:00.000Z'));
    expect(packAtD890BackupFromSession(session, { cache: copy }).manifest.regions).toEqual(
      first.manifest.regions,
    );
  });

  it('refuses a session that has read nothing', () => {
    const pipe = new AtD890ScriptedPipe();
    const radio = new AtD890uvProtocol();
    const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
    expect(() => packAtD890BackupFromSession(session)).toThrow(/Nothing has been read/);
  });
});
