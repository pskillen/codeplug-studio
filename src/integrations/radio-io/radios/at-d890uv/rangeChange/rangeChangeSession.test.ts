import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AtD890StunKillError } from '../stunKillGuard.ts';
import { syntheticLocalInfo } from '../__fixtures__/rangeChangeFixtures.ts';
import { AtD890ScriptedPipe } from '../__fixtures__/scriptedPipe.ts';
import {
  AtD890PendingUnitsError,
  clearAllAtD890PendingRecords,
  recordAtD890PendingUnits,
  readAtD890PendingUnits,
} from '../pendingUnits.ts';
import { AtD890RangeChangeRefusedError, buildAtD890RangeChangeFrame } from './rangeChangeFrame.ts';
import {
  AtD890RangeChangeSessionError,
  atD890RangeChangeMayEndAfter,
  changeAtD890FrequencyRange,
} from './rangeChangeSession.ts';

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

beforeEach(() => clearAllAtD890PendingRecords());
afterEach(() => clearAllAtD890PendingRecords());

describe('changeAtD890FrequencyRange', () => {
  it('pending units from an interrupted Write: refused before the journal, no W, no END, not mayEnd', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    pipe.autoAckWrites = true;
    // The radio's serial is only known once LocalInfo is read, so the record sits under the unknown bucket,
    // which blocks every D890.
    recordAtD890PendingUnits('unknown', [0x04000000]);
    let journalled = false;
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {
        journalled = true;
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890PendingUnitsError);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(false);
    expect(journalled).toBe(false);
    expect(writeFrames(pipe)).toHaveLength(0);
    expect(endFrames(pipe)).toHaveLength(0);
    expect(readAtD890PendingUnits('unknown')).toEqual([0x04000000]);
  });

  it('a clean change leaves no in-progress marker behind', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    pipe.autoAckWrites = true;
    await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {},
    });
    expect(localStorage.getItem('codeplug-studio:d890-pending-units')).toBeNull();
  });

  it('END failing after the W leaves no marker that would block the next Write', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    pipe.autoAckWrites = true;
    const realWrite = pipe.write.bind(pipe);
    pipe.write = async (b) => {
      if (dec.decode(b) === 'END') throw new Error('port lost');
      return realWrite(b);
    };
    await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {},
    }).catch(() => undefined);
    expect(localStorage.getItem('codeplug-studio:d890-pending-units')).toBeNull();
  });

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
    expect(err.mayEnd).toBe(false);
    expect(err.frameSent).toBe(true);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(false);
    expect(err.failure).toBe('send-failed');
    expect(endFrames(pipe)).toHaveLength(0);
    expect(writeFrames(pipe)).toHaveLength(1);
  });

  it('timeout (three tries): no END, mayEnd false, frameSent true', async () => {
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
    expect(err.mayEnd).toBe(false);
    expect(err.frameSent).toBe(true);
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

  it.each([
    ['stun', 0],
    ['kill', 1],
  ])('%s flag: the helper says do not END', async (_n, offset) => {
    const flagged = syntheticLocalInfo(3);
    flagged[offset] = 1;
    const err = await changeAtD890FrequencyRange(setup(flagged), {
      backupLocalInfo: syntheticLocalInfo(3),
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890StunKillError);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(false);
  });

  it('LocalInfo differs from the backup: no W, mayEnd true', async () => {
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
    expect(err.mayEnd).toBe(true);
    expect(err.frameSent).toBe(false);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
  });

  it('a frame refusal: no W, mayEnd true', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 3,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeRefusedError);
    expect(err.mayEnd).toBe(true);
    expect(err.frameSent).toBe(false);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
  });

  it('onBeforeSend throwing: no W, mayEnd true', async () => {
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
    expect(err.mayEnd).toBe(true);
    expect(err.frameSent).toBe(false);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
    expect(endFrames(pipe)).toHaveLength(0);
  });

  it('an unreadable LocalInfo: no W, mayEnd false', async () => {
    const pipe = new AtD890ScriptedPipe();
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: syntheticLocalInfo(3),
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.mayEnd).toBe(false);
    expect(err.frameSent).toBe(false);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(false);
    expect(writeFrames(pipe)).toHaveLength(0);
  });

  it('END failing after a clean ACK: end-failed, frameSent, no further END', async () => {
    const backup = syntheticLocalInfo(3);
    const pipe = setup(backup);
    pipe.autoAckWrites = true;
    const realWrite = pipe.write.bind(pipe);
    pipe.write = async (b) => {
      if (dec.decode(b) === 'END') throw new Error('port lost');
      return realWrite(b);
    };
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: backup,
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.failure).toBe('end-failed');
    expect(err.frameSent).toBe(true);
    expect(err.mayEnd).toBe(false);
    expect(atD890RangeChangeMayEndAfter(err)).toBe(false);
    expect(writeFrames(pipe)).toHaveLength(1);
  });

  it('a backup shorter than 0x100: refused as local-info-changed with no W', async () => {
    const pipe = setup(syntheticLocalInfo(3));
    const err = await changeAtD890FrequencyRange(pipe, {
      backupLocalInfo: syntheticLocalInfo(3).slice(0, 0x80),
      target: 7,
      onBeforeSend: () => {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtD890RangeChangeSessionError);
    expect(err.mayEnd).toBe(true);
    expect(writeFrames(pipe)).toHaveLength(0);
  });
});

describe('atD890RangeChangeMayEndAfter fails closed', () => {
  it('false for unknown errors, non-errors and the stun/kill error', () => {
    expect(atD890RangeChangeMayEndAfter(new Error('???'))).toBe(false);
    expect(atD890RangeChangeMayEndAfter(undefined)).toBe(false);
    expect(atD890RangeChangeMayEndAfter('x')).toBe(false);
    expect(
      atD890RangeChangeMayEndAfter(new AtD890StunKillError({ stun: 1, kill: 0, flagged: true })),
    ).toBe(false);
  });

  it('false for the stun/kill and short-local-info frame refusals, true for the others', () => {
    for (const [reason, expected] of [
      ['stun-kill-flag', false],
      ['short-local-info', false],
      ['market-lock-mismatch', true],
      ['model-mismatch', true],
      ['target-not-allowed', true],
      ['maintenance-locked', true],
      ['target-is-current', true],
    ] as const) {
      const err = new AtD890RangeChangeRefusedError(reason, 'x');
      expect(err.frameSent).toBe(false);
      expect(atD890RangeChangeMayEndAfter(err)).toBe(expected);
    }
  });

  it('the builder refuses a short LocalInfo with mayEnd false', () => {
    try {
      buildAtD890RangeChangeFrame(new Uint8Array(0x20), 7);
      expect.unreachable();
    } catch (e) {
      expect((e as AtD890RangeChangeRefusedError).mayEnd).toBe(false);
    }
  });

  it('false for a session error that says frameSent, whatever mayEnd says', () => {
    expect(
      atD890RangeChangeMayEndAfter(
        new AtD890RangeChangeSessionError('send-failed', { frameSent: true, mayEnd: true }, 'x'),
      ),
    ).toBe(false);
  });
});
