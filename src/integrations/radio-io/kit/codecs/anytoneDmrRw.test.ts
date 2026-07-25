import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioProtocolError, RadioTimeoutError } from '../errors.ts';
import { expectAck, PROGRAM_RW_ACK } from './programRw.ts';
import {
  anytoneDmrChecksum8AfterOpcode,
  anytoneDmrRwCodec,
  enterAnytoneDmrProgramMode,
  exitAnytoneDmrProgramMode,
  makeAnytoneDmrReadFrame,
  makeAnytoneDmrWriteFrame,
  parseAnytoneDmrReadReply,
  probeAnytoneDmrIdent,
} from './anytoneDmrRw.ts';

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
        throw new RadioTimeoutError('mockPipe: timed out');
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

function buildReadReply(addr: number, payload: Uint8Array): Uint8Array {
  const length = payload.length;
  const header = new Uint8Array(6);
  header[0] = 0x57;
  header[1] = (addr >>> 24) & 0xff;
  header[2] = (addr >>> 16) & 0xff;
  header[3] = (addr >>> 8) & 0xff;
  header[4] = addr & 0xff;
  header[5] = length & 0xff;

  const body = new Uint8Array(6 + length);
  body.set(header, 0);
  body.set(payload, 6);
  const checksum = anytoneDmrChecksum8AfterOpcode(body);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = checksum;
  frame[body.length + 1] = 0x06;
  return frame;
}

describe('anytoneDmrRwCodec frames', () => {
  it('builds read frames as R + u32 BE addr + length', () => {
    expect(makeAnytoneDmrReadFrame(0x0100_0000, 0x10)).toEqual(
      new Uint8Array([0x52, 0x01, 0x00, 0x00, 0x00, 0x10]),
    );
    expect(anytoneDmrRwCodec.makeReadFrame(0x3482_a00, 0x10)).toEqual(
      new Uint8Array([0x52, 0x03, 0x48, 0x2a, 0x00, 0x10]),
    );
  });

  it('rejects non-block-aligned read length', () => {
    expect(() => makeAnytoneDmrReadFrame(0, 0x0f)).toThrow(RangeError);
  });

  it('builds write frames with checksum and trailing ACK', () => {
    const payload = new Uint8Array(16).fill(0xab);
    const frame = makeAnytoneDmrWriteFrame(0x0100_0000, 0x10, payload);
    expect(frame[0]).toBe(0x57);
    expect(frame.slice(1, 5)).toEqual(new Uint8Array([0x01, 0x00, 0x00, 0x00]));
    expect(frame[5]).toBe(0x10);
    expect(frame.slice(6, 22)).toEqual(payload);
    expect(frame[frame.length - 1]).toBe(0x06);

    const body = frame.subarray(0, frame.length - 2);
    expect(frame[frame.length - 2]).toBe(anytoneDmrChecksum8AfterOpcode(body));
  });

  it('rejects write when payload length mismatches', () => {
    expect(() => makeAnytoneDmrWriteFrame(0, 0x10, new Uint8Array(8))).toThrow(RangeError);
  });

  it('parses read reply payload after 6-byte header', () => {
    const payload = new Uint8Array(16).fill(0xcd);
    const frame = buildReadReply(0x0100_0000, payload);
    expect(parseAnytoneDmrReadReply(frame)).toEqual(payload);
    expect(anytoneDmrRwCodec.parseReadReply?.(frame)).toEqual(payload);
  });

  it('rejects bad read reply opcode, checksum, or trailer', () => {
    const payload = new Uint8Array(16).fill(1);
    const good = buildReadReply(0, payload);

    const badOpcode = good.slice();
    badOpcode[0] = 0x52;
    expect(() => parseAnytoneDmrReadReply(badOpcode)).toThrow(RadioProtocolError);

    const badChecksum = good.slice();
    badChecksum[badChecksum.length - 2] ^= 0xff;
    expect(() => parseAnytoneDmrReadReply(badChecksum)).toThrow(RadioProtocolError);

    const badTrailer = good.slice();
    badTrailer[badTrailer.length - 1] = 0x15;
    expect(() => parseAnytoneDmrReadReply(badTrailer)).toThrow(RadioProtocolError);
  });
});

describe('enterAnytoneDmrProgramMode', () => {
  it('accepts QX\\x06 enter reply', async () => {
    const { pipe, writes } = mockPipe([
      new Uint8Array([0x51]),
      new Uint8Array([0x58, 0x06]),
    ]);
    await enterAnytoneDmrProgramMode(pipe, 100);
    expect(new TextDecoder().decode(writes[0])).toBe('PROGRAM');
  });

  it('accepts lone 0x00 enter reply', async () => {
    const { pipe } = mockPipe([new Uint8Array([0x00])]);
    await expect(enterAnytoneDmrProgramMode(pipe, 100)).resolves.toBeUndefined();
  });

  it('rejects unexpected enter reply', async () => {
    const { pipe } = mockPipe([new Uint8Array([0xff])]);
    await expect(enterAnytoneDmrProgramMode(pipe, 100)).rejects.toBeInstanceOf(
      RadioProtocolError,
    );
  });
});

describe('probeAnytoneDmrIdent', () => {
  it('returns raw ident bytes ending in 0x06', async () => {
    const ident = new Uint8Array([
      ...new TextEncoder().encode('ID890UV\0'),
      0x00,
      ...new TextEncoder().encode('V100'),
      0x06,
    ]);
    const reads: Uint8Array[] = [];
    for (const byte of ident) {
      reads.push(new Uint8Array([byte]));
    }
    const { pipe, writes } = mockPipe(reads);
    const result = await probeAnytoneDmrIdent(pipe, 500);
    expect(result).toEqual(ident);
    expect(writes[0]).toEqual(new Uint8Array([0x02]));
  });
});

describe('exitAnytoneDmrProgramMode', () => {
  it('writes END', async () => {
    const { pipe, writes } = mockPipe([]);
    await exitAnytoneDmrProgramMode(pipe);
    expect(new TextDecoder().decode(writes[0])).toBe('END');
  });
});

describe('write ACK via programRw expectAck', () => {
  it('accepts ACK 0x06 after write', async () => {
    const { pipe } = mockPipe([new Uint8Array([PROGRAM_RW_ACK])]);
    await expect(expectAck(pipe, 100)).resolves.toBeUndefined();
  });
});
