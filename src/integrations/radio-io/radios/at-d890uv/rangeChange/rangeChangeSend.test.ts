import { describe, expect, it } from 'vitest';
import { RadioInterlockError, RadioProtocolError, RadioTimeoutError } from '../../../kit/errors.ts';
import { AtD890ScriptedPipe } from '../__fixtures__/scriptedPipe.ts';
import { createAtD890RangeChangeSender } from './rangeChangeSend.ts';

const ADDR = 0x04f80000;
const data = () => new Uint8Array(16).map((_, i) => i + 1);

function pipeWithAck(): AtD890ScriptedPipe {
  const pipe = new AtD890ScriptedPipe();
  pipe.autoAckWrites = true;
  return pipe;
}

describe('createAtD890RangeChangeSender', () => {
  it('sends one W frame at 0x04F80000 and resolves on ACK', async () => {
    const pipe = pipeWithAck();
    await createAtD890RangeChangeSender(pipe).send(ADDR, data());
    expect(pipe.writes).toHaveLength(1);
    const w = pipe.writes[0]!;
    expect(w[0]).toBe(0x57);
    expect([...w.subarray(1, 5)]).toEqual([0x04, 0xf8, 0x00, 0x00]);
    expect(w[5]).toBe(0x10);
    expect([...w.subarray(6, 22)]).toEqual([...data()]);
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
      createAtD890RangeChangeSender(pipe).send(address, new Uint8Array(len)),
    ).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(0);
  });

  it('refuses a second call, with no further write', async () => {
    const pipe = pipeWithAck();
    const sender = createAtD890RangeChangeSender(pipe);
    await sender.send(ADDR, data());
    await expect(sender.send(ADDR, data())).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(1);
  });

  it('refuses a second call after a failure too', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x15]));
    const sender = createAtD890RangeChangeSender(pipe);
    await expect(sender.send(ADDR, data())).rejects.toBeInstanceOf(RadioProtocolError);
    await expect(sender.send(ADDR, data())).rejects.toBeInstanceOf(RadioInterlockError);
    expect(pipe.writes).toHaveLength(1);
  });

  it('resends the identical frame after one timeout, then ACK', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 1;
    pipe.replyAfterTimeouts = new Uint8Array([0x06]);
    await createAtD890RangeChangeSender(pipe).send(ADDR, data());
    expect(pipe.writes).toHaveLength(2);
    expect(pipe.writes[1]).toEqual(pipe.writes[0]);
    expect(pipe.flushCount).toBe(1);
  });

  it('throws on a NAK without resending', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x15]));
    await expect(createAtD890RangeChangeSender(pipe).send(ADDR, data())).rejects.toBeInstanceOf(
      RadioProtocolError,
    );
    expect(pipe.writes).toHaveLength(1);
  });

  it('throws after the third timeout (original plus two resends)', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 3;
    await expect(createAtD890RangeChangeSender(pipe).send(ADDR, data())).rejects.toBeInstanceOf(
      RadioTimeoutError,
    );
    expect(pipe.writes).toHaveLength(3);
    for (const w of pipe.writes) expect(w).toEqual(pipe.writes[0]);
  });
});
