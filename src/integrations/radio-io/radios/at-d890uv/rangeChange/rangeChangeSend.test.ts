import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RadioInterlockError, RadioProtocolError, RadioTimeoutError } from '../../../kit/errors.ts';
import { AtD890ScriptedPipe } from '../__fixtures__/scriptedPipe.ts';
import { syntheticLocalInfo } from '../__fixtures__/rangeChangeFixtures.ts';
import {
  AtD890PendingUnitsError,
  clearAllAtD890PendingRecords,
  recordAtD890PendingUnits,
} from '../pendingUnits.ts';
import {
  AtD890ReadAfterWriteError,
  assertAtD890ReadAllowed,
  isAtD890WritePhase,
  listAtD890UnitsEntered,
  readAtD890ProgramCounters,
} from '../programSession.ts';
import { createAtD890RangeChangeSender } from './rangeChangeSend.ts';

const ADDR = 0x04f80000;
const live = () => syntheticLocalInfo(3);
const ctx = () => ({ liveLocalInfo: live(), backupLocalInfo: live() });
/** Live `+0x00..+0x0F` with only `+0x03` changed: the one payload the sender accepts. */
const data = (code = 7, unlocked = false) => {
  const d = syntheticLocalInfo(3, { unlocked }).slice(0, 16);
  d[3] = code;
  return d;
};

function pipeWithAck(): AtD890ScriptedPipe {
  const pipe = new AtD890ScriptedPipe();
  pipe.autoAckWrites = true;
  return pipe;
}

beforeEach(() => clearAllAtD890PendingRecords());
afterEach(() => clearAllAtD890PendingRecords());

describe('range-change sender and the program-session latch (#1406)', () => {
  it('records its W, so an R before END is refused', async () => {
    const pipe = pipeWithAck();
    await createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx());
    expect(isAtD890WritePhase(pipe)).toBe(true);
    expect(readAtD890ProgramCounters(pipe).wFrames).toBe(1);
    expect(listAtD890UnitsEntered(pipe)).toEqual([ADDR]);
    expect(() => assertAtD890ReadAllowed(pipe, ADDR, 16)).toThrow(AtD890ReadAfterWriteError);
  });

  it('counts a resent frame and latches even when the ACK never arrives', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 3;
    await expect(
      createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx()),
    ).rejects.toBeInstanceOf(RadioTimeoutError);
    expect(readAtD890ProgramCounters(pipe).wFrames).toBe(3);
    expect(isAtD890WritePhase(pipe)).toBe(true);
  });

  it('writes nothing while units from an interrupted Write are pending', async () => {
    recordAtD890PendingUnits('unknown', [0x04000000]);
    const pipe = pipeWithAck();
    await expect(
      createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx()),
    ).rejects.toBeInstanceOf(AtD890PendingUnitsError);
    expect(pipe.writes).toHaveLength(0);
  });
});

describe('createAtD890RangeChangeSender', () => {
  it('sends one W frame at 0x04F80000 and resolves on ACK', async () => {
    const pipe = pipeWithAck();
    await createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx());
    expect(pipe.writes).toHaveLength(1);
    const w = pipe.writes[0]!;
    expect(w[0]).toBe(0x57);
    expect([...w.subarray(1, 5)]).toEqual([0x04, 0xf8, 0x00, 0x00]);
    expect(w[5]).toBe(0x10);
    expect([...w.subarray(6, 22)]).toEqual([...data()]);
  });

  describe('refuses an unsafe payload with zero frames written', () => {
    const base = () => data();
    const cases: Array<[string, () => Uint8Array, (() => ReturnType<typeof ctx>) | undefined]> = [
      ['stun byte set', () => Object.assign(base(), { 0: 1 }), undefined],
      ['kill byte set', () => Object.assign(base(), { 1: 1 }), undefined],
      ['+0x04 != +0x05', () => Object.assign(base(), { 4: 2 }), undefined],
      ['code 19', () => Object.assign(base(), { 3: 19 }), undefined],
      ['code 99', () => Object.assign(base(), { 3: 99 }), undefined],
      ['code 255', () => Object.assign(base(), { 3: 255 }), undefined],
      ['code 14 without 890#', () => data(14, false), undefined],
      [
        'payload differs from live at a sibling byte',
        () => Object.assign(base(), { 8: 0x77 }),
        undefined,
      ],
      ['code equals the live code', () => data(3), undefined],
      [
        'live model differs',
        base,
        () => {
          const c = ctx();
          c.liveLocalInfo[0x10] = 0x58;
          c.backupLocalInfo[0x10] = 0x58;
          return c;
        },
      ],
      [
        'live serial differs from the backup',
        base,
        () => {
          const c = ctx();
          c.liveLocalInfo[0x30] ^= 0xff;
          return c;
        },
      ],
      [
        'live model differs from the backup',
        base,
        () => {
          const c = ctx();
          c.backupLocalInfo[0x12] ^= 0xff;
          return c;
        },
      ],
      [
        'no live LocalInfo',
        base,
        () => ({ liveLocalInfo: new Uint8Array(0x10), backupLocalInfo: live() }),
      ],
    ];
    it.each(cases)('%s', async (_label, payload, context) => {
      const pipe = pipeWithAck();
      await expect(
        createAtD890RangeChangeSender(pipe).send(ADDR, payload(), (context ?? ctx)()),
      ).rejects.toBeInstanceOf(RadioInterlockError);
      expect(pipe.writes).toHaveLength(0);
    });

    it('a missing context is refused too', async () => {
      const pipe = pipeWithAck();
      await expect(
        createAtD890RangeChangeSender(pipe).send(ADDR, base(), undefined as never),
      ).rejects.toBeInstanceOf(RadioInterlockError);
      expect(pipe.writes).toHaveLength(0);
    });

    it('a refusal does not burn the one-shot, a later valid payload is sent', async () => {
      const pipe = pipeWithAck();
      const sender = createAtD890RangeChangeSender(pipe);
      await expect(sender.send(ADDR, data(19), ctx())).rejects.toBeInstanceOf(RadioInterlockError);
      await sender.send(ADDR, data(), ctx());
      expect(pipe.writes).toHaveLength(1);
    });
  });

  it('accepts code 14 with 890# in the payload', async () => {
    const pipe = pipeWithAck();
    const c = {
      liveLocalInfo: syntheticLocalInfo(3, { unlocked: true }),
      backupLocalInfo: syntheticLocalInfo(3, { unlocked: true }),
    };
    await createAtD890RangeChangeSender(pipe).send(ADDR, data(14, true), c);
    expect(pipe.writes).toHaveLength(1);
  });

  it.each([
    ['0x04FC0000', 0x04fc0000, 16],
    ['0x04F80010', 0x04f80010, 16],
    ['0x04F00000', 0x04f00000, 16],
    ['length 15', ADDR, 15],
    ['length 32', ADDR, 32],
  ])('refuses %s before any write', async (_label, address, len) => {
    const pipe = pipeWithAck();
    await expect(
      createAtD890RangeChangeSender(pipe).send(address, new Uint8Array(len), ctx()),
    ).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(0);
  });

  it('refuses a second call, with no further write', async () => {
    const pipe = pipeWithAck();
    const sender = createAtD890RangeChangeSender(pipe);
    await sender.send(ADDR, data(), ctx());
    await expect(sender.send(ADDR, data(), ctx())).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(1);
  });

  it('refuses a second call after a failure too', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x15]));
    const sender = createAtD890RangeChangeSender(pipe);
    await expect(sender.send(ADDR, data(), ctx())).rejects.toBeInstanceOf(RadioProtocolError);
    await expect(sender.send(ADDR, data(), ctx())).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(1);
  });

  it('resends the identical frame after one timeout, then ACK', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 1;
    pipe.replyAfterTimeouts = new Uint8Array([0x06]);
    await createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx());
    expect(pipe.writes).toHaveLength(2);
    expect(pipe.writes[1]).toEqual(pipe.writes[0]);
    expect(pipe.flushCount).toBe(1);
  });

  it('throws on a NAK without resending', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x15]));
    await expect(
      createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx()),
    ).rejects.toBeInstanceOf(RadioProtocolError);
    expect(pipe.writes).toHaveLength(1);
  });

  it('throws after the third timeout (original plus two resends)', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 3;
    await expect(
      createAtD890RangeChangeSender(pipe).send(ADDR, data(), ctx()),
    ).rejects.toBeInstanceOf(RadioTimeoutError);
    expect(pipe.writes).toHaveLength(3);
    for (const w of pipe.writes) expect(w).toEqual(pipe.writes[0]);
  });
});
