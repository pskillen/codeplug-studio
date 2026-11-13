/**
 * The Mini ends a clone session about 2 s after the last byte it receives, and outside a session it drops `W`
 * frames without a reply. Write and Restore hold the pre-write read's session through Review, so they must redo
 * the handshake before the first `W` once the session has gone idle. Fake radio and fake clock only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryMap } from '../../types.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { RadioWrongIdentError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { reviewNeedsReconnect } from '../../programHold.ts';
import { uv17ProBackupMemSpans } from '../uv17pro-family/backupRestoreRoles.ts';
import { UV21_PRO_V2_LAYOUT, UV5R_MINI_LAYOUT as layout } from '../uv17pro-family/layout.ts';
import { FakeMiniRadio } from './__fixtures__/fakeMiniRadio.ts';
import { UV5R_MINI_DESCRIPTOR } from './descriptor.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

/** The idle drop decoded from the Mini's firmware. */
const RADIO_SESSION_DROP_MS = 2000;

function sessionRadio(modelPrefix?: Uint8Array): FakeMiniRadio {
  const radio = modelPrefix ? new FakeMiniRadio(modelPrefix) : new FakeMiniRadio();
  radio.sessionDropMs = RADIO_SESSION_DROP_MS;
  return radio;
}

/** Connect with the read handshake and read the clone, as the Write stepper does before Review. */
async function readThenHold(radio: FakeMiniRadio, holdMs: number) {
  const proto = new Uv5rMiniProtocol();
  await proto.connect(radio, { settleScale: 0 });
  await proto.download();
  radio.writes.length = 0;
  vi.advanceTimersByTime(holdMs);
  return proto;
}

function restoreArchive(): { manifest: RadioBackupManifestV1; image: MemoryMap } {
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: layout.radioModelId,
    descriptorLabel: layout.protocolLabel,
    coverage: 'full-clone',
    imageByteLength: layout.memTotal,
    regions: uv17ProBackupMemSpans(layout).map((s) => ({
      id: s.id,
      label: s.id,
      address: s.packedOffset,
      byteLength: s.size,
      path: `regions/${s.id}.bin`,
      restoreRole: 'restorable' as const,
    })),
  };
  return { manifest, image: createMemoryMap(layout.memTotal) };
}

const ALL_MEM = ['mem-0', 'mem-1', 'mem-2'];

/** The frames before the first `W`. */
function beforeFirstW(radio: FakeMiniRadio): string[] {
  const log = radio.frameLog();
  return log.slice(0, log.indexOf('W'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FakeMiniRadio session model', () => {
  it('drops a W sent more than 2 s after the last byte, and answers a fresh ident', async () => {
    const radio = sessionRadio();
    const proto = new Uv5rMiniProtocol();
    await proto.connect(radio, { settleScale: 0 });
    vi.advanceTimersByTime(RADIO_SESSION_DROP_MS + 1);
    await radio.write(new Uint8Array([0x57, 0x00, 0x00, 0x40, ...new Uint8Array(0x40)]));
    await expect(radio.readExact(1)).rejects.toThrow(/needed 1/);
    await radio.write(layout.ident);
    expect(await radio.readExact(1)).toEqual(new Uint8Array([0x06]));
  });
});

describe('UV-5R Mini Write after the radio dropped the session', () => {
  it('re-handshakes before the first W after a 5 s Review, and writes the whole plan', async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 5000);
    await proto.upload(createMemoryMap(layout.memTotal), {});
    expect(beforeFirstW(radio)).toEqual(['ident', 'magic', 'magic', 'magic']);
    expect(radio.wAddresses()).toHaveLength(layout.cloneBlockCount);
  });

  it("main's rule (reuse any held session) gets no ACK for the first W", async () => {
    // The pre-fix protocol trusted a held session however long it had been idle. A layout without
    // `sessionIdleMs` still does, so it shows the failure on the same fake radio.
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 5000);
    const legacy = proto as unknown as { layout: typeof layout };
    legacy.layout = { ...layout, sessionIdleMs: undefined, sessionEndedAfterMs: undefined };
    await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(
      'Expected ACK 0x06, timed out',
    );
    expect(radio.frameLog()).toEqual(['W']);
  });

  it('reuses the session when Write follows the read within the idle window', async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 1000);
    await proto.upload(createMemoryMap(layout.memTotal), {});
    expect(beforeFirstW(radio)).toEqual([]);
    expect(radio.wAddresses()).toHaveLength(layout.cloneBlockCount);
  });

  it('between the idle window and the drop, waits for the old session to end before the ident', async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 1700);
    const upload = proto.upload(createMemoryMap(layout.memTotal), {});
    await vi.advanceTimersByTimeAsync(1000);
    await upload;
    expect(beforeFirstW(radio)).toEqual(['ident', 'magic', 'magic', 'magic']);
    expect(radio.wAddresses()).toHaveLength(layout.cloneBlockCount);
  });

  it('the re-handshake keeps the model check: a radio that is not a Mini gets no W frame', async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 5000);
    // The radio answers the next M with another model's name.
    const other = sessionRadio(new TextEncoder().encode('UV17PRO'));
    (proto as unknown as { pipe: FakeMiniRadio }).pipe = other;
    await expect(proto.upload(createMemoryMap(layout.memTotal), {})).rejects.toThrow(
      RadioWrongIdentError,
    );
    expect(other.wAddresses()).toEqual([]);
  });
});

describe('UV-5R Mini Restore after the radio dropped the session', () => {
  it('re-handshakes before the first W after a 5 s pause, and writes the whole plan', async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 5000);
    await proto.restoreFromBackup(restoreArchive(), { regionIds: ALL_MEM });
    expect(beforeFirstW(radio)).toEqual(['ident', 'magic', 'magic', 'magic']);
    expect(radio.wAddresses()).toHaveLength(layout.cloneBlockCount);
  });

  it("main's rule (reuse any held session) gets no ACK for the first W", async () => {
    const radio = sessionRadio();
    const proto = await readThenHold(radio, 5000);
    const legacy = proto as unknown as { layout: typeof layout };
    legacy.layout = { ...layout, sessionIdleMs: undefined, sessionEndedAfterMs: undefined };
    await expect(proto.restoreFromBackup(restoreArchive(), { regionIds: ALL_MEM })).rejects.toThrow(
      'Expected ACK 0x06, timed out',
    );
    expect(radio.frameLog()).toEqual(['W']);
  });
});

describe('UV-5R Mini session idle settings', () => {
  it('trusts the session for less than the 2 s drop, and waits past it before a re-handshake', () => {
    expect(layout.sessionIdleMs).toBeLessThan(RADIO_SESSION_DROP_MS);
    expect(layout.sessionEndedAfterMs).toBeGreaterThan(RADIO_SESSION_DROP_MS);
  });

  it('the descriptor reconnects after any Review longer than the drop (backstop)', () => {
    expect(UV5R_MINI_DESCRIPTOR.programHoldSafeMs).toBeLessThan(RADIO_SESSION_DROP_MS);
    expect(reviewNeedsReconnect(UV5R_MINI_DESCRIPTOR, 5000)).toBe(true);
  });

  it('leaves the UV-21Pro V2 unchanged: no idle drop is known for it', () => {
    expect(UV21_PRO_V2_LAYOUT.sessionIdleMs).toBeUndefined();
  });
});
