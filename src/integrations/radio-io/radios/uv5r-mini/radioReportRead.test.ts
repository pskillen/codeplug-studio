import { describe, expect, it } from 'vitest';

import {
  decodeUv5rMiniRadioReport,
  UV5RMINI_RADIO_REPORT_ADDRESS,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';

import { PROGRAM_RW_ACK } from '../../kit/codecs/programRw.ts';
import type { BytePipe } from '../../types.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import { fakeMagicReply } from '../uv17pro-family/magicReplyTestKit.ts';
import { UV5R_MINI_BLOCK_SIZE, UV5R_MINI_IDENT, UV5R_MINI_READ_RESPONSE_LEN } from './constants.ts';
import { uv5rMiniCrypt } from './crypt.ts';
import { UV5R_MINI_MAGICS_READ } from './magics.ts';
import { readUv5rMiniRadioReport, UV5RMINI_RADIO_REPORT_LINK } from './radioReportRead.ts';
import { assertUv5rMiniWriteAllowed, Uv5rMiniWriteRefusedError } from './writeInterlock.ts';

/** The firmware project's made-up example block (an L2 build), decoded. */
const EXAMPLE = Uint8Array.from(
  '4d4d3952010000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000000000000000000000000000000000cf95'
    .match(/../g)!
    .map((x) => parseInt(x, 16)),
);

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** A radio in normal mode: answers the handshake, and each `R` with `block` XOR'd as the clone sends it. */
class FakeRadio implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private buf: number[] = [];
  constructor(private readonly block: Uint8Array) {}

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (same(data, UV5R_MINI_IDENT)) {
      this.buf.push(PROGRAM_RW_ACK);
      return;
    }
    const magic = UV5R_MINI_MAGICS_READ.find((m) => same(m.send, data));
    if (magic) {
      this.buf.push(
        ...fakeMagicReply(magic.send, magic.responseLen, UV5R_MINI_LAYOUT.modelReplyPrefix),
      );
      return;
    }
    if (data[0] === 0x52) {
      const reply = new Uint8Array(UV5R_MINI_READ_RESPONSE_LEN);
      reply.set([0x52, data[1]!, data[2]!, UV5R_MINI_BLOCK_SIZE]);
      reply.set(uv5rMiniCrypt(this.block), 4);
      this.buf.push(...reply);
    }
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.buf.length < n) throw new Error(`FakeRadio: needed ${n}, have ${this.buf.length}`);
    return new Uint8Array(this.buf.splice(0, n));
  }

  async flush(): Promise<void> {
    this.buf = [];
  }

  async close(): Promise<void> {}
}

describe('readUv5rMiniRadioReport', () => {
  it('sends one R at 0xEFC0 after the handshake, and no W', async () => {
    const radio = new FakeRadio(EXAMPLE);
    await readUv5rMiniRadioReport(radio, { settleScale: 0 });
    expect(radio.writes[0]).toEqual(UV5R_MINI_IDENT);
    const reads = radio.writes.filter((w) => w[0] === 0x52 && w.length === 4);
    expect(reads).toEqual([new Uint8Array([0x52, 0xef, 0xc0, 0x40])]);
    expect(radio.writes.some((w) => w[0] === 0x57)).toBe(false);
    // The read is the last thing sent.
    expect(radio.writes.at(-1)).toEqual(new Uint8Array([0x52, 0xef, 0xc0, 0x40]));
  });

  it('undoes the clone XOR, so the report decodes', async () => {
    const bytes = await readUv5rMiniRadioReport(new FakeRadio(EXAMPLE), { settleScale: 0 });
    expect(bytes).toEqual(EXAMPLE);
    expect(decodeUv5rMiniRadioReport(bytes)).toMatchObject({ kind: 'report', layout: 'L2' });
  });

  it('reads a stock radio as erased flash: no report', async () => {
    const bytes = await readUv5rMiniRadioReport(new FakeRadio(new Uint8Array(64).fill(0xff)), {
      settleScale: 0,
    });
    expect(decodeUv5rMiniRadioReport(bytes)).toEqual({ kind: 'stock', reason: 'magic' });
  });

  it('opens the cable with DTR and RTS low', () => {
    expect(UV5RMINI_RADIO_REPORT_LINK.raiseDtrRts).toBe(false);
  });
});

describe('the clone write interlock around the report', () => {
  it('refuses a W at the report frame and anywhere from 0xE000 up, on either profile', () => {
    for (const profile of ['stock', 'mm9pdy'] as const) {
      for (const address of [0xe000, UV5RMINI_RADIO_REPORT_ADDRESS, 0xefc0 - 0x40, 0xf000]) {
        expect(() =>
          assertUv5rMiniWriteAllowed(address, 64, { profile, operation: 'write' }),
        ).toThrow(Uv5rMiniWriteRefusedError);
        expect(() =>
          assertUv5rMiniWriteAllowed(address, 64, { profile, operation: 'restore' }),
        ).toThrow(/at or above 0xE000/);
      }
    }
  });
});
