import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../errors.ts';
import {
  expectAck,
  makeProgramRwReadFrame,
  makeProgramRwWriteFrame,
  parseProgramRwReadReply,
  PROGRAM_RW_ACK,
  programRwCodec,
  sendIdent,
} from './programRw.ts';

function mockPipe(scriptedReads: Uint8Array[]): {
  pipe: BytePipe;
  writes: Uint8Array[];
} {
  const writes: Uint8Array[] = [];
  const queue = [...scriptedReads];
  const pipe: BytePipe = {
    async write(data) {
      writes.push(data.slice());
    },
    async readExact(n) {
      const next = queue.shift();
      if (!next) {
        throw new Error('mockPipe: no scripted read left');
      }
      if (next.length !== n) {
        throw new Error(`mockPipe: expected read ${n}, scripted ${next.length}`);
      }
      return next.slice();
    },
    async close() {},
  };
  return { pipe, writes };
}

describe('programRwCodec frames', () => {
  it('builds read frames as R + u16 BE addr + length', () => {
    expect(makeProgramRwReadFrame(0x0010, 0x40)).toEqual(
      new Uint8Array([0x52, 0x00, 0x10, 0x40]),
    );
    expect(programRwCodec.makeReadFrame(0x8240, 0x10)).toEqual(
      new Uint8Array([0x52, 0x82, 0x40, 0x10]),
    );
  });

  it('builds write frames with payload after header', () => {
    const payload = new Uint8Array(4).fill(0xab);
    const frame = makeProgramRwWriteFrame(0x0100, 4, payload);
    expect(frame.slice(0, 4)).toEqual(new Uint8Array([0x57, 0x01, 0x00, 0x04]));
    expect(frame.slice(4)).toEqual(payload);
  });

  it('rejects write when payload length mismatches', () => {
    expect(() => makeProgramRwWriteFrame(0, 2, new Uint8Array([1]))).toThrow(RangeError);
  });

  it('parses read reply by stripping the 4-byte header', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const frame = new Uint8Array([0x52, 0x00, 0x00, 0x04, ...payload]);
    expect(parseProgramRwReadReply(frame)).toEqual(payload);
    expect(programRwCodec.parseReadReply?.(frame)).toEqual(payload);
  });

  it('rejects bad read reply opcode or length', () => {
    expect(() => parseProgramRwReadReply(new Uint8Array([0x57, 0, 0, 1, 9]))).toThrow(
      RadioProtocolError,
    );
    expect(() =>
      parseProgramRwReadReply(new Uint8Array([0x52, 0, 0, 2, 1])),
    ).toThrow(RadioProtocolError);
  });
});

describe('expectAck / sendIdent', () => {
  it('accepts ACK 0x06', async () => {
    const { pipe } = mockPipe([new Uint8Array([PROGRAM_RW_ACK])]);
    await expect(expectAck(pipe, 100)).resolves.toBeUndefined();
  });

  it('rejects non-ACK', async () => {
    const { pipe } = mockPipe([new Uint8Array([0x15])]);
    await expect(expectAck(pipe, 100)).rejects.toBeInstanceOf(RadioProtocolError);
  });

  it('sendIdent writes caller bytes then expects ACK', async () => {
    const ident = new TextEncoder().encode('PROGRAMTEST');
    const { pipe, writes } = mockPipe([new Uint8Array([PROGRAM_RW_ACK])]);
    await sendIdent(pipe, ident, 100);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(ident);
  });
});
