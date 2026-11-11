import { describe, expect, it } from 'vitest';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { encodeUv5rMiniFrame, UV5RMINI_FW_CMD, uv5rMiniU32 } from './frames.ts';
import { checkUv5rMiniOutgoing, type Uv5rMiniOutgoingContext } from './outgoing.ts';

const IMAGE = Uint8Array.from({ length: 0x3000 }, (_, i) => (i * 13 + 5) & 0xff);
const { BAUD, DATA, RESULT, LENGTH, PING } = UV5RMINI_FW_CMD;
const u8 = (...b: number[]) => Uint8Array.from(b);
const dataReply = (off: number, len: number, body = IMAGE.slice(off, off + len)) =>
  encodeUv5rMiniFrame(DATA, Uint8Array.from([...uv5rMiniU32(off), ...uv5rMiniU32(len), ...body]));

const last = new Map<number, Uint8Array>([
  [RESULT, u8(0x00)],
  [LENGTH, uv5rMiniU32(0x78000)],
]);
const ctx: Uv5rMiniOutgoingContext = { image: IMAGE, lastRadioData: (cmd) => last.get(cmd) };
const ok = (frame: Uint8Array) => expect(() => checkUv5rMiniOutgoing(frame, ctx)).not.toThrow();
const refused = (frame: Uint8Array, text: RegExp) => {
  expect(() => checkUv5rMiniOutgoing(frame, ctx)).toThrow(RadioInterlockError);
  expect(() => checkUv5rMiniOutgoing(frame, ctx)).toThrow(text);
};

describe('UV-5R Mini outgoing allow-list', () => {
  it('lets through each allowed frame', () => {
    ok(encodeUv5rMiniFrame(PING));
    ok(encodeUv5rMiniFrame(BAUD, uv5rMiniU32(9600)));
    ok(encodeUv5rMiniFrame(BAUD, uv5rMiniU32(38400)));
    ok(dataReply(0x200, 0x200));
    ok(dataReply(IMAGE.length - 0x10, 0x10));
    ok(dataReply(0, 0x1000));
    ok(encodeUv5rMiniFrame(RESULT, u8(0)));
    ok(encodeUv5rMiniFrame(LENGTH, uv5rMiniU32(0x78000)));
  });

  it('refuses bytes that are not a frame, and short ones', () => {
    refused(u8(1, 2, 3, 4, 5, 6, 7), /not a frame/);
    refused(u8(0xaa, 0x55), /not a frame/);
    refused(new Uint8Array(0), /not a frame/);
  });

  it('refuses a frame that is not whole: a short one, and one with bytes after it', () => {
    const f = encodeUv5rMiniFrame(PING);
    refused(f.subarray(0, 6), /not a frame/);
    refused(encodeUv5rMiniFrame(DATA, u8(0, 0, 0, 0, 0, 0, 0, 0)).subarray(0, 14), /length field/);
    refused(Uint8Array.from([...f, 0x00]), /length field/);
    refused(Uint8Array.from([...f, ...f]), /length field/);
  });

  it('refuses a bad CRC', () => {
    const f = encodeUv5rMiniFrame(PING);
    f[f.length - 2] ^= 1;
    refused(f, /bad CRC/);
    // A frame with a wrong cmd byte but its old CRC is also refused here, not by the command rule.
    const g = encodeUv5rMiniFrame(PING);
    g[4] = 5;
    refused(g, /bad CRC/);
  });

  it('refuses a ping with data', () => {
    refused(encodeUv5rMiniFrame(PING, u8(0)), /ping with data/);
  });

  it('refuses any rate but 9600 and 38400, and an empty or long cmd 1', () => {
    refused(encodeUv5rMiniFrame(BAUD, uv5rMiniU32(115200)), /rate/);
    refused(encodeUv5rMiniFrame(BAUD, uv5rMiniU32(19200)), /rate/);
    refused(encodeUv5rMiniFrame(BAUD), /rate/);
    refused(encodeUv5rMiniFrame(BAUD, u8(0x80, 0x25, 0, 0, 0)), /rate/);
  });

  it('refuses a data reply that is not exactly the image slice', () => {
    const body = IMAGE.slice(0x200, 0x400);
    body[7] ^= 0xff;
    refused(dataReply(0x200, 0x200, body), /not the image bytes/);
    refused(dataReply(0x200, 0x200, IMAGE.slice(0x200, 0x3ff)), /not the image bytes/); // short
    refused(dataReply(0x200, 0x200, IMAGE.slice(0x200, 0x401)), /not the image bytes/); // long
    refused(dataReply(0x200, 0x200, IMAGE.slice(0x401, 0x601)), /not the image bytes/); // another place
  });

  it('refuses a data reply outside the image or over 0x1000 bytes', () => {
    refused(dataReply(IMAGE.length - 4, 0x10, new Uint8Array(0x10)), /outside the image/);
    refused(dataReply(IMAGE.length, 4, new Uint8Array(4)), /outside the image/);
    refused(dataReply(0xffffff00, 0x200, new Uint8Array(0x200)), /outside the image/);
    refused(dataReply(0, 0x1001), /size limit/);
    refused(dataReply(0, 0x2000), /size limit/);
  });

  it('refuses a data reply without its offset and length', () => {
    refused(encodeUv5rMiniFrame(DATA, u8(0, 0, 0, 0)), /offset and length/);
  });

  it('refuses a cmd 3 or cmd 4 that is not the radio last of that command', () => {
    refused(encodeUv5rMiniFrame(RESULT, u8(0x01)), /not an echo/);
    refused(encodeUv5rMiniFrame(RESULT, u8(0x00, 0x00)), /not an echo/);
    refused(encodeUv5rMiniFrame(LENGTH, uv5rMiniU32(0x78001)), /not an echo/);
    refused(encodeUv5rMiniFrame(LENGTH, uv5rMiniU32(0x78000).subarray(0, 3)), /not an echo/);
  });

  it('refuses a cmd 3 or cmd 4 when the radio has sent none', () => {
    const empty: Uv5rMiniOutgoingContext = { image: IMAGE, lastRadioData: () => undefined };
    expect(() => checkUv5rMiniOutgoing(encodeUv5rMiniFrame(RESULT, u8(0)), empty)).toThrow(
      /not an echo/,
    );
    expect(() => checkUv5rMiniOutgoing(encodeUv5rMiniFrame(LENGTH, uv5rMiniU32(1)), empty)).toThrow(
      /not an echo/,
    );
  });

  it('refuses every other command, with a good CRC', () => {
    for (const cmd of [0, 5, 7, 8, 0x45, 0xa5, 0xff]) {
      refused(encodeUv5rMiniFrame(cmd, u8(0)), new RegExp(`cmd ${cmd}`));
    }
  });

  it('the CRC the guard checks is the XMODEM one', () => {
    const f = encodeUv5rMiniFrame(PING);
    expect(f[5] | (f[6]! << 8)).toBe(crc16Xmodem(f.subarray(0, 5)));
  });
});
