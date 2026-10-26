import { describe, expect, it } from 'vitest';
import { AtD890StunKillError } from '../stunKillGuard.ts';
import { syntheticLocalInfo } from '../__fixtures__/rangeChangeFixtures.ts';
import { AtD890ScriptedPipe } from '../__fixtures__/scriptedPipe.ts';
import { AtD890RangeChangeRefusedError } from './rangeChangeFrame.ts';
import { AtD890RangeChangeSessionError, changeAtD890FrequencyRange } from './rangeChangeSession.ts';

const LOCAL_INFO = 0x04f80000;
const dec = new TextDecoder();

function setup(live: Uint8Array = syntheticLocalInfo(3)) {
  const pipe = new AtD890ScriptedPipe();
  pipe.readResponder = (addr, len) => {
    const off = addr - LOCAL_INFO;
    return off >= 0 && off + len <= live.length ? live.subarray(off, off + len) : null;
  };
  return pipe;
}

const kind = (w: Uint8Array) => (w[0] === 0x52 ? 'R' : w[0] === 0x57 ? 'W' : dec.decode(w));
const writeFrames = (p: AtD890ScriptedPipe) => p.writes.filter((w) => w[0] === 0x57);
const endFrames = (p: AtD890ScriptedPipe) => p.writes.filter((w) => dec.decode(w) === 'END');

describe('changeAtD890FrequencyRange', () => {
  it('happy path: reads, one W at 0x04F80000, then END; onBeforeSend runs before the W', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    pipe.autoAckWrites = true;
    const order: string[] = [];
    await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {
        order.push(`before after ${pipe.writes.length} frames`);
        expect(writeFrames(pipe)).toHaveLength(0);
      },
    });
    expect(order).toHaveLength(1);

    const log = pipe.writes.map(kind);
    expect(log.filter((k) => k === 'R').length).toBeGreaterThanOrEqual(1);
    expect(log.filter((k) => k === 'W')).toHaveLength(1);
    expect(log.at(-1)).toBe('END');
    expect(log.indexOf('W')).toBe(log.length - 2);
    expect(log.slice(0, log.indexOf('W')).every((k) => k === 'R')).toBe(true);
    expect(order[0]).toBe(`before after ${log.indexOf('W')} frames`);

    const w = writeFrames(pipe)[0]!;
    expect([...w.subarray(1, 5)]).toEqual([0x04, 0xf8, 0x00, 0x00]);
    expect(w[5]).toBe(0x10);
    const expected = backup.slice(0, 16);
    expected[3] = 7;
    expect([...w.subarray(6, 22)]).toEqual([...expected]);
  });

  it('NAK: no END', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    const realRead = pipe.readExact.bind(pipe);
    pipe.readExact = async (n, t) => (n === 1 ? new Uint8Array([0x15]) : realRead(n, t));
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.endSafe).toBe(false);
    expect(err.failure).toBe('send-failed');
    expect(endFrames(pipe)).toHaveLength(0);
    expect(writeFrames(pipe)).toHaveLength(1);
  });

  it('timeout (three tries): no END, endSafe false', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    // Reads are answered by the responder; the W's ACK read times out three times.
    const realRead = pipe.readExact.bind(pipe);
    pipe.readExact = async (n, t) => {
      if (n === 1) pipe.pendingTimeouts = 1;
      return realRead(n, t);
    };
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.endSafe).toBe(false);
    expect(endFrames(pipe)).toHaveLength(0);
    expect(writeFrames(pipe)).toHaveLength(3);
  });

  it.each([
    ['stun', 0],
    ['kill', 1],
  ])('%s flag: no W, no END, AtD890StunKillError', async (_n, offset) => {
    const flagged = syntheticLocalInfo(3);
    flagged[offset] = 1;
    const pipe = setup(flagged);
    await expect(
      changeAtD890FrequencyRange(pipe, {
        backupLocalInfo: syntheticLocalInfo(3),
        target: 7,
        onBeforeSend: () => {
          throw new Error('must not run');
        },
      }),
    ).rejects.toBeInstanceOf(AtD890StunKillError);
    expect(writeFrames(pipe)).toHaveLength(0);
    expect(endFrames(pipe)).toHaveLength(0);
  });

  it('LocalInfo differs from the backup: no W, endSafe true', async () => {
    const live = syntheticLocalInfo(3);
    live[0x80] = 0x42;
    const pipe = setup(live);
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: syntheticLocalInfo(3),
      target: 7,
      onBeforeSend: () => {
        throw new Error('must not run');
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.failure).toBe('local-info-changed');
    expect(err.endSafe).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
  });

  it('a frame refusal: no W, endSafe true', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 3,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeRefusedError);
    expect(err.endSafe).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
  });

  it('onBeforeSend throwing: no W, endSafe true', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: async () => {
        throw new Error('journal full');
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.failure).toBe('before-send-failed');
    expect(err.endSafe).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
    expect(endFrames(pipe)).toHaveLength(0);
  });

  it('an unreadable LocalInfo: no W, endSafe false', async () => {
    const pipe = new AtD890ScriptedPipe();
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: syntheticLocalInfo(3),
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.endSafe).toBe(false);
    expect(writeFrames(pipe)).toHaveLength(0);
  });
});
