import { describe, expect, it } from 'vitest';

import { DM32UV_FIRMWARE_BLOCK0_FILE_NAME } from '@core/radios/baofeng/dm-32uv/firmware.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { syntheticDm32Image } from './__fixtures__/syntheticImage.ts';
import { crc16Xmodem } from './crc16Xmodem.ts';
import { createDm32TxGuard } from './interlocks.ts';
import { buildDm32FirmwarePlan, buildDm32IdentSteps, DM32_PRELUDE_IDENT_STEPS } from './plan.ts';

/** Independent bitwise CRC16-XMODEM. */
function crcRef(data: Uint8Array): number {
  let crc = 0;
  for (const x of data) {
    crc ^= x << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

const hex = (b: Uint8Array | null) =>
  b ? Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ') : null;
const ascii = (s: string) => new TextEncoder().encode(s);

describe('crc16Xmodem', () => {
  it('matches an independent bitwise implementation', () => {
    const blobs = [new Uint8Array(0), ascii('123456789'), syntheticDm32Image(2048, 7)];
    for (const b of blobs) expect(crc16Xmodem(b)).toBe(crcRef(b));
    expect(crc16Xmodem(ascii('123456789'))).toBe(0x31c3);
  });
});

describe('buildDm32FirmwarePlan', () => {
  const image = syntheticDm32Image();
  const body = image.slice(0x100);
  const plan = buildDm32FirmwarePlan(image, DM32UV_FIRMWARE_BLOCK0_FILE_NAME);
  const blocks = plan.filter((s) => s.name.startsWith('block#'));
  const types = plan.filter((s) => s.name.startsWith('type#'));

  it('sends the CPS prelude bytes and expects the CPS replies', () => {
    expect(plan.slice(0, 6).map((s) => hex(s.tx))).toEqual([
      '52',
      '4d 00 00 00 01',
      '06',
      '45 00 00 00 00',
      '31',
      '01',
    ]);
    expect(plan.slice(0, 6).map((s) => hex(s.rx))).toEqual([
      '06',
      '4d 01 09',
      hex(image.slice(0, 9)),
      '06',
      '43',
      '43',
    ]);
    expect(plan.slice(0, 6).every((s) => s.phase === 'handshake' && !s.touchesRadio)).toBe(true);
  });

  it('matches the ident steps for the first three frames', () => {
    const ident = buildDm32IdentSteps();
    expect(ident).toHaveLength(DM32_PRELUDE_IDENT_STEPS);
    ident.forEach((s, i) => {
      expect(s.tx).toEqual(plan[i]!.tx);
      expect(s.rx).toEqual(plan[i]!.rx);
    });
  });

  it('builds the golden block 0', () => {
    const s = plan[6]!;
    const meta = ascii(`${DM32UV_FIRMWARE_BLOCK0_FILE_NAME}\x00860160`);
    const b0 = new Uint8Array(128);
    b0.set(meta);
    expect(s.name).toBe('block0+erase');
    expect(s.phase).toBe('erase');
    expect(s.touchesRadio).toBe(true);
    expect(s.tx).toHaveLength(0x84);
    expect(crcRef(b0)).toBe(0x4227);
    expect(Array.from(s.tx.slice(0, 2))).toEqual([0x00, 0xff]);
    expect(s.tx.slice(2, 130)).toEqual(b0);
    expect(Array.from(s.tx.slice(130))).toEqual([0x42, 0x27]);
    expect(hex(s.rx)).toBe('06 43');
  });

  it('gives 840 STX blocks for a stock-length image', () => {
    expect(blocks).toHaveLength(840);
    expect(plan).toHaveLength(6 + 1 + 840 * 2 + 1);
    expect(new Set(types.map((t) => hex(t.tx)))).toEqual(new Set(['02']));
    expect(blocks[blocks.length - 1]!.tx[0]).toBe(0x48);
    expect(blocks[255]!.tx.slice(0, 2)).toEqual(Uint8Array.of(0x00, 0xff));
  });

  it('frames every block as seq, ~seq, chunk, CRC', () => {
    blocks.forEach((s, i) => {
      const seq = (i + 1) & 0xff;
      const chunk = body.slice(i * 1024, (i + 1) * 1024);
      const crc = crcRef(chunk);
      expect(s.tx[0]).toBe(seq);
      expect(s.tx[1]).toBe(0xff - seq);
      expect(s.tx.slice(2, 2 + 1024)).toEqual(chunk);
      expect(s.tx[1026]).toBe(crc >> 8);
      expect(s.tx[1027]).toBe(crc & 0xff);
      expect(hex(s.rx)).toBe('06');
    });
  });

  it('ends with EOT and never sends the header', () => {
    const last = plan[plan.length - 1]!;
    expect(last.name).toBe('eot');
    expect(hex(last.tx)).toBe('04');
    expect(last.rx).toBeNull();
    expect(last.phase).toBe('finish');
    const stream = Buffer.concat(plan.map((s) => Buffer.from(s.tx)));
    expect(stream.indexOf(Buffer.from(image.slice(0, 0x100)))).toBe(-1);
  });

  it('uses SOH tails with 0x1A padding and wraps the sequence', () => {
    const img = syntheticDm32Image(0x100 + 300 * 1024 + 200, 9);
    const p = buildDm32FirmwarePlan(img, DM32UV_FIRMWARE_BLOCK0_FILE_NAME);
    const bl = p.filter((s) => s.name.startsWith('block#'));
    expect(bl).toHaveLength(302);
    expect(bl[255]!.tx.slice(0, 2)).toEqual(Uint8Array.of(0x00, 0xff));
    const tail = bl[bl.length - 1]!.tx;
    expect(tail).toHaveLength(2 + 128 + 2);
    expect(tail.slice(2 + 72, 2 + 128)).toEqual(new Uint8Array(56).fill(0x1a));
    const tailTypes = p.filter((s) => s.name === 'type#300' || s.name === 'type#301');
    expect(tailTypes.map((s) => hex(s.tx))).toEqual(['01', '01']);
    expect(p.find((s) => s.name === 'type#299')!.tx).toEqual(Uint8Array.of(0x02));
  });
});

describe('createDm32TxGuard', () => {
  const plan = buildDm32FirmwarePlan(syntheticDm32Image(), DM32UV_FIRMWARE_BLOCK0_FILE_NAME);

  it('accepts only the next frame', () => {
    const g = createDm32TxGuard(plan);
    expect(() => g.check(Uint8Array.of(0x52))).not.toThrow();
    const bad = [
      plan[1]!.tx,
      new Uint8Array(0),
      Uint8Array.of(0x04),
      plan[3]!.tx,
      Uint8Array.of(0x52, 0x00),
      plan[7]!.tx,
      new Uint8Array(1024),
    ];
    for (const frame of bad) expect(() => g.check(frame)).toThrow(RadioInterlockError);
    g.advance();
    expect(() => g.check(plan[1]!.tx)).not.toThrow();
  });

  it('refuses everything past the end of the plan', () => {
    const g = createDm32TxGuard(plan, plan.length);
    expect(() => g.check(Uint8Array.of(0x04))).toThrow(RadioInterlockError);
  });
});
