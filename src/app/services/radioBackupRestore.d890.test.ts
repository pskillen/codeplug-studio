import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AT_D890_MAP_SIZE,
  AT_D890_NXDN,
  AT_D890_NXDN_SETTINGS,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { putCacheBytes } from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import {
  AtD890ScriptedPipe,
  scriptAtD890MinimalDownload,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import * as browserDownload from '@integrations/download/browserDownload.ts';
import {
  backupLiveRadioSession,
  openRadioBackupZip,
  packAtD890BackupFromSession,
} from './radioBackupRestore.ts';

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

describe('openRadioBackupZip with NXDN regions (AT-D890)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T14:02:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function nxdnCopy(cache: { blocks: Map<number, Uint8Array> }) {
    const copy = { ...cache, blocks: new Map([...cache.blocks].map(([a, d]) => [a, d.slice()])) };
    putCacheBytes(copy, AT_D890_NXDN.ListIndex, new Uint8Array(32).fill(0x11));
    putCacheBytes(copy, AT_D890_NXDN.ListSet, new Uint8Array(32).fill(0x22));
    putCacheBytes(copy, AT_D890_NXDN.ListData, new Uint8Array(32).fill(0x33));
    putCacheBytes(copy, AT_D890_NXDN.ListOrder, new Uint8Array(32).fill(0x44));
    putCacheBytes(copy, AT_D890_NXDN.RxGroupData, new Uint8Array(32).fill(0x55));
    putCacheBytes(copy, AT_D890_NXDN.RxGroupSet, new Uint8Array(32).fill(0x66));
    return copy;
  }

  // The 80 MB map takes seconds to build under load.
  it('keeps the image at the D890 map size, lists the NXDN regions and holds the RX groups', async () => {
    const { session, radio } = await downloadedSession();
    const packed = packAtD890BackupFromSession(session, {
      cache: nxdnCopy(radio.getDownloadCache()!),
    });
    const roleOf = (id: string) => packed.manifest.regions.find((r) => r.id === id)?.restoreRole;
    // What the report lists: the six NXDN regions are in the zip, all inspect-only.
    for (const id of [
      'nxdn-list-index',
      'nxdn-list-set',
      'nxdn-list-data',
      'nxdn-list-order',
      'nxdn-rx-group-data',
      'nxdn-rx-group-set',
    ]) {
      expect(roleOf(id), id).toBe('inspect-only');
    }

    const opened = openRadioBackupZip(packed.zipBytes);
    // Without the filter in openRadioBackupZip the list regions (at 0x18000000) would grow the
    // image to ~400 MB, or switch it to packed placement.
    expect(opened.image.size).toBe(AT_D890_MAP_SIZE);
    expect(opened.manifest.regions.map((r) => r.id)).toEqual(
      expect.arrayContaining(['nxdn-list-index', 'nxdn-list-data', 'nxdn-rx-group-data']),
    );
    // The RX group bytes sit at their real address in the image.
    expect(Array.from(opened.image.get(AT_D890_NXDN.RxGroupData, 32))).toEqual(
      Array(32).fill(0x55),
    );
    expect(Array.from(opened.image.get(AT_D890_NXDN.RxGroupSet, 32))).toEqual(Array(32).fill(0x66));
  }, 60_000);

  it('opens a backup that holds no NXDN regions at the same size', async () => {
    const { session, radio } = await downloadedSession();
    const cache = radio.getDownloadCache()!;
    const old = {
      ...cache,
      blocks: new Map(
        [...cache.blocks].filter(
          ([a]) =>
            a < AT_D890_NXDN_SETTINGS.Address || (a >= 0x04c0_0000 && a < AT_D890_NXDN.ListIndex),
        ),
      ),
    };
    const packed = packAtD890BackupFromSession(session, { cache: old });
    expect(packed.manifest.regions.some((r) => r.id.startsWith('nxdn-'))).toBe(false);
    expect(openRadioBackupZip(packed.zipBytes).image.size).toBe(AT_D890_MAP_SIZE);
  }, 60_000);
});
