import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioProtocolError, RadioTimeoutError } from '../errors.ts';
import {
  enterProgramQxMode,
  exitProgramQxMode,
  makeProgramQxReadFrame,
  makeProgramQxWriteFrame,
  parseProgramQxReadReply,
  parseProgramQxWriteAck,
  probeProgramQxIdent,
  programQxChecksum8AfterOpcode,
  programQxCodec,
  sendProgramQxCommand,
  stripProgramQxEcho,
} from './programQx.ts';

function mockEchoPipe(scriptedReads: Uint8Array[]): {
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
        throw new RadioTimeoutError('mockEchoPipe: timed out');
      }
      if (next.length !== n) {
        throw new Error(`mockEchoPipe: expected read ${n}, scripted ${next.length}`);
      }
      return next.slice();
    },
    async close() {},
  };
  return { pipe, writes };
}

function buildReadReply(addr: number, payload: Uint8Array): Uint8Array {
  const length = payload.length;
  const header = new Uint8Array(4);
  header[0] = 0x52;
  header[1] = (addr >>> 8) & 0xff;
  header[2] = addr & 0xff;
  header[3] = length & 0xff;

  const body = new Uint8Array(4 + length);
  body.set(header, 0);
  body.set(payload, 4);
  const checksum = programQxChecksum8AfterOpcode(body);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = checksum;
  frame[body.length + 1] = 0x06;
  return frame;
}

describe('programQxCodec frames', () => {
  it('builds read frames as R + u16 BE addr + length', () => {
    expect(makeProgramQxReadFrame(0x0000, 0x10)).toEqual(
      new Uint8Array([0x52, 0x00, 0x00, 0x10]),
    );
    expect(programQxCodec.makeReadFrame(0x3290, 0x10)).toEqual(
      new Uint8Array([0x52, 0x32, 0x90, 0x10]),
    );
  });

  it('rejects non-block-aligned read length', () => {
    expect(() => makeProgramQxReadFrame(0, 0x0f)).toThrow(RangeError);
  });

  it('builds write frames with checksum and trailing ACK', () => {
    const payload = new Uint8Array(16).fill(0xab);
    const frame = makeProgramQxWriteFrame(0x0100, 0x10, payload);
    expect(frame[0]).toBe(0x57);
    expect(frame[1]).toBe(0x01);
    expect(frame[2]).toBe(0x00);
    expect(frame[3]).toBe(0x10);
    expect(frame.slice(4, 20)).toEqual(payload);
    expect(frame[frame.length - 1]).toBe(0x06);

    const body = frame.subarray(0, frame.length - 2);
    expect(frame[frame.length - 2]).toBe(programQxChecksum8AfterOpcode(body));
  });

  it('parses read reply payload after 4-byte header', () => {
    const payload = new Uint8Array(16).fill(0xcd);
    const frame = buildReadReply(0x0000, payload);
    expect(parseProgramQxReadReply(frame)).toEqual(payload);
    expect(programQxCodec.parseReadReply?.(frame)).toEqual(payload);
  });

  it('rejects bad read reply checksum or trailer', () => {
    const payload = new Uint8Array(16).fill(1);
    const good = buildReadReply(0, payload);

    const badChecksum = good.slice();
    badChecksum[badChecksum.length - 2] ^= 0xff;
    expect(() => parseProgramQxReadReply(badChecksum)).toThrow(RadioProtocolError);

    const badTrailer = good.slice();
    badTrailer[badTrailer.length - 1] = 0x15;
    expect(() => parseProgramQxReadReply(badTrailer)).toThrow(RadioProtocolError);
  });
});

describe('stripProgramQxEcho', () => {
  it('strips echoed command prefix', () => {
    const cmd = new Uint8Array([0x52, 0x00, 0x00, 0x10]);
    const echoed = new Uint8Array([...cmd, 0xaa, 0xbb]);
    expect(stripProgramQxEcho(cmd, echoed)).toEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it('returns copy when no echo prefix', () => {
    const cmd = new Uint8Array([0x52, 0x00, 0x00, 0x10]);
    const reply = new Uint8Array([0xaa, 0xbb]);
    expect(stripProgramQxEcho(cmd, reply)).toEqual(reply);
  });
});

describe('sendProgramQxCommand', () => {
  it('reads until echo-stripped reply length matches', async () => {
    const cmd = makeProgramQxReadFrame(0, 0x10);
    const reply = buildReadReply(0, new Uint8Array(16).fill(0x11));
    const echoed = new Uint8Array([...cmd, ...reply]);
    const bytes: Uint8Array[] = [];
    for (const b of echoed) {
      bytes.push(new Uint8Array([b]));
    }

    const { pipe } = mockEchoPipe(bytes);
    const result = await sendProgramQxCommand(pipe, cmd, 0x16, 1000);
    expect(result).toEqual(reply);
  });
});

describe('enterProgramQxMode', () => {
  it('accepts QX\\x06 enter reply after echo', async () => {
    const program = new TextEncoder().encode('PROGRAM');
    const echoed = new Uint8Array([...program, 0x51, 0x58, 0x06]);
    const bytes: Uint8Array[] = [];
    for (const b of echoed) {
      bytes.push(new Uint8Array([b]));
    }

    const { pipe, writes } = mockEchoPipe(bytes);
    await enterProgramQxMode(pipe, 1000);
    expect(writes[0]).toEqual(program);
  });

  it('rejects unexpected enter reply', async () => {
    const program = new TextEncoder().encode('PROGRAM');
    const echoed = new Uint8Array([...program, 0xff, 0xff, 0xff]);
    const bytes: Uint8Array[] = [];
    for (const b of echoed) {
      bytes.push(new Uint8Array([b]));
    }

    const { pipe } = mockEchoPipe(bytes);
    await expect(enterProgramQxMode(pipe, 1000)).rejects.toThrow(RadioProtocolError);
  });
});

describe('probeProgramQxIdent', () => {
  it('returns ident bytes ending with ACK', async () => {
    const ident = new Uint8Array([0x49, 0x52, 0x54, 0x39, 0x35, 0x2d, 0x50, 0x00, 0x01, 0x56]);
    const echoed = new Uint8Array([0x02, ...ident, 0x06]);
    const bytes: Uint8Array[] = [];
    for (const b of echoed) {
      bytes.push(new Uint8Array([b]));
    }

    const { pipe } = mockEchoPipe(bytes);
    const result = await probeProgramQxIdent(pipe, 1000);
    expect(result[result.length - 1]).toBe(0x06);
  });
});

describe('parseProgramQxWriteAck', () => {
  it('accepts ACK and rejects NACK', () => {
    expect(() => parseProgramQxWriteAck(0x06)).not.toThrow();
    expect(() => parseProgramQxWriteAck(0x0a)).toThrow(RadioProtocolError);
    expect(() => parseProgramQxWriteAck(0xff)).toThrow(RadioProtocolError);
  });
});

describe('exitProgramQxMode', () => {
  it('writes END', async () => {
    const { pipe, writes } = mockEchoPipe([]);
    await exitProgramQxMode(pipe);
    expect(writes[0]).toEqual(new TextEncoder().encode('END'));
  });
});
