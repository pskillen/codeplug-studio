import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../errors.ts';
import {
  makeCommandFrame,
  makeFinishFlashSectorFrame,
  makeOpenGd77ReadFrame,
  makePingFrame,
  makeSetFlashSectorFrame,
  makeWriteEepromFrame,
  makeWriteSectorBufferFrame,
  OPENGD77_BLOCK,
  OPENGD77_CMD_OK,
  OPENGD77_WRITE_CMD_EEPROM,
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SET_SECTOR,
  parseCommandAck,
  parseOpenGd77ReadReply,
  parseWriteAck,
  readOpenGd77WriteAck,
} from './opengd77Serial.ts';
import type { BytePipe } from '../../types.ts';

describe('OpenGD77 command frames', () => {
  it('builds minimal ping C fe', () => {
    expect(makePingFrame()).toEqual(new Uint8Array([0x43, 0xfe]));
  });

  it('builds command with optional payload', () => {
    expect(makeCommandFrame(0x06, new Uint8Array([0x01]))).toEqual(
      new Uint8Array([0x43, 0x06, 0x01]),
    );
  });

  it('accepts command ACK -', () => {
    expect(() => parseCommandAck(new Uint8Array([OPENGD77_CMD_OK]))).not.toThrow();
  });

  it('rejects non-ACK command replies', () => {
    expect(() => parseCommandAck(new Uint8Array([0x06]))).toThrow(RadioProtocolError);
  });
});

describe('OpenGD77 read frames', () => {
  it('builds 8-byte R request with mem + addr BE + len BE', () => {
    expect(makeOpenGd77ReadFrame(0x02, 0x00001000, OPENGD77_BLOCK)).toEqual(
      new Uint8Array([0x52, 0x02, 0x00, 0x00, 0x10, 0x00, 0x00, 0x20]),
    );
  });

  it('parses R reply header + payload', () => {
    const payload = new Uint8Array(4).fill(0xab);
    const frame = new Uint8Array([0x52, 0x00, 0x04, ...payload]);
    expect(parseOpenGd77ReadReply(frame)).toEqual(payload);
  });

  it('rejects wrong type or length mismatch', () => {
    expect(() => parseOpenGd77ReadReply(new Uint8Array([0x57, 0x00, 0x01, 0x00]))).toThrow(
      RadioProtocolError,
    );
    expect(() => parseOpenGd77ReadReply(new Uint8Array([0x52, 0x00, 0x02, 0x01]))).toThrow(
      RadioProtocolError,
    );
  });
});

describe('OpenGD77 write frames W vs X', () => {
  it('builds set-sector with W and X variants', () => {
    // addr 0x1000 → sector 1
    expect(makeSetFlashSectorFrame('W', 0x1000)).toEqual(
      new Uint8Array([0x57, 0x01, 0x00, 0x00, 0x01]),
    );
    expect(makeSetFlashSectorFrame('X', 0x1000)).toEqual(
      new Uint8Array([0x58, 0x01, 0x00, 0x00, 0x01]),
    );
  });

  it('builds sector buffer, finish, and EEPROM frames', () => {
    const block = new Uint8Array(OPENGD77_BLOCK).fill(0x11);
    const buf = makeWriteSectorBufferFrame('X', 0x2000, block);
    expect(buf.slice(0, 8)).toEqual(
      new Uint8Array([0x58, 0x02, 0x00, 0x00, 0x20, 0x00, 0x00, 0x20]),
    );
    expect(buf.slice(8)).toEqual(block);

    expect(makeFinishFlashSectorFrame('W')).toEqual(new Uint8Array([0x57, 0x03]));

    const eepromPayload = new Uint8Array([1, 2, 3]);
    const ee = makeWriteEepromFrame('W', 0x100, eepromPayload);
    expect(ee.slice(0, 8)).toEqual(
      new Uint8Array([0x57, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03]),
    );
    expect(ee.slice(8)).toEqual(eepromPayload);
  });

  it('parseWriteAck accepts type+cmd echo and rejects - as error', () => {
    expect(() =>
      parseWriteAck(
        new Uint8Array([0x58, OPENGD77_WRITE_CMD_SET_SECTOR]),
        'X',
        OPENGD77_WRITE_CMD_SET_SECTOR,
      ),
    ).not.toThrow();
    expect(() =>
      parseWriteAck(
        new Uint8Array([0x57, OPENGD77_WRITE_CMD_FINISH_SECTOR]),
        'W',
        OPENGD77_WRITE_CMD_FINISH_SECTOR,
      ),
    ).not.toThrow();
    expect(() =>
      parseWriteAck(new Uint8Array([OPENGD77_CMD_OK, 0x00]), 'W', OPENGD77_WRITE_CMD_EEPROM),
    ).toThrow(RadioProtocolError);
    expect(() =>
      parseWriteAck(new Uint8Array([0x57, 0x02]), 'W', OPENGD77_WRITE_CMD_SET_SECTOR),
    ).toThrow(RadioProtocolError);
  });
});

function pipeWith(bytes: number[]): BytePipe & { left: () => number } {
  let buf = Uint8Array.from(bytes);
  return {
    async write() {},
    async readExact(n) {
      if (buf.length < n) throw new Error(`needed ${n}, have ${buf.length}`);
      const out = buf.slice(0, n);
      buf = buf.slice(n);
      return out;
    },
    async close() {},
    left: () => buf.length,
  };
}

describe('readOpenGd77WriteAck (firmware framing)', () => {
  it('a one-byte - is a NACK and does not wait for a second byte', async () => {
    const pipe = pipeWith([OPENGD77_CMD_OK]);
    await expect(readOpenGd77WriteAck(pipe, 'X', 0x03, 100)).resolves.toEqual({ kind: 'nack' });
  });

  it('a two-byte {type, cmd} echo is an ACK', async () => {
    const pipe = pipeWith([0x58, 0x01]);
    await expect(readOpenGd77WriteAck(pipe, 'X', 0x01, 100)).resolves.toEqual({ kind: 'ack' });
  });

  it("'-' followed by X 01 in one chunk is a NACK, never a success, and leaves the X 01 unread", async () => {
    const pipe = pipeWith([OPENGD77_CMD_OK, 0x58, 0x01]);
    await expect(readOpenGd77WriteAck(pipe, 'X', 0x01, 100)).resolves.toEqual({ kind: 'nack' });
    expect(pipe.left()).toBe(2);
  });

  it('a stale byte ahead of the ACK is reported as unexpected, not accepted', async () => {
    const pipe = pipeWith([0x52, 0x58, 0x01]);
    await expect(readOpenGd77WriteAck(pipe, 'X', 0x01, 100)).resolves.toEqual({
      kind: 'unexpected',
      bytes: new Uint8Array([0x52, 0x58]),
    });
  });

  it('a wrong command echo is unexpected', async () => {
    const pipe = pipeWith([0x58, 0x02]);
    const result = await readOpenGd77WriteAck(pipe, 'X', 0x03, 100);
    expect(result.kind).toBe('unexpected');
  });
});
