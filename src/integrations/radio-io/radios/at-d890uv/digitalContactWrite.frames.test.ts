/**
 * Frame-count pin for the AT-D890UV digital contact Write (#1406).
 *
 * Drives the real `uploadAtD890DigitalContacts` over the scripted pipe against a synthetic
 * "stale flash": a radio that already holds a long (18,894 contact) list, being rewritten with a
 * short one. Counts `R` and `W` frames per stage. No owner data: the stale list is generated.
 */
import { describe, expect, it } from 'vitest';
import { AtD890ScriptedPipe, assertAtD890NoReadAfterWrite } from './__fixtures__/scriptedPipe.ts';
import { uploadAtD890DigitalContacts } from './digitalContactWrite.ts';
import { packAtD890DigitalContacts } from './digitalContactCodec.ts';
import { D890_MAP } from './constants.ts';
import {
  AT_D890_ERASE_UNIT_BYTES,
  eraseUnitBaseFor,
  isAtD890EraseUnitBookkeepingAddress,
} from './eraseUnits.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';

const UNIT = AT_D890_ERASE_UNIT_BYTES;

/** About 92-byte records, the average of a real contact list. */
function contacts(n: number): RadioDigitalContactDto[] {
  return Array.from({ length: n }, (_, i) => ({
    wireName: `Name${String(i).padStart(6, '0')}`.slice(0, 10),
    digitalId: 2_340_000 + i * 7,
    callsign: `M${String(i % 100000).padStart(5, '0')}`,
    city: 'Glasgow1',
    province: 'Scotla',
    country: 'UnitedK',
    remark: '',
  }));
}

const PLANT_META_TAIL = D890_MAP.DigitalContactMeta + 0x20000;
const PLANT_ORDER_TAIL = D890_MAP.DigitalContactOrder + 0x3f000;
const PLANT_DATA_TAIL = D890_MAP.DigitalContactData + 0x3f000;
const PLANT_OTHER = 0x04a80000 + 0x100;
const PLANTED = [PLANT_META_TAIL, PLANT_ORDER_TAIL, PLANT_DATA_TAIL];

function makeStaleFlash(): Map<number, Uint8Array> {
  const flash = new Map<number, Uint8Array>();
  const unit = (base: number) => {
    let u = flash.get(base);
    if (!u) {
      u = new Uint8Array(UNIT).fill(0xff);
      flash.set(base, u);
    }
    return u;
  };
  for (const c of packAtD890DigitalContacts(contacts(18_894)).stagingChunks) {
    const base = eraseUnitBaseFor(c.address);
    unit(base).set(c.data, c.address - base);
  }
  const meta = unit(D890_MAP.DigitalContactMeta);
  const dv = new DataView(meta.buffer);
  dv.setUint32(0, 2, true);
  dv.setUint32(4, 0x07900044, true);
  meta.fill(0, 8, 16);
  for (const addr of [...PLANTED, PLANT_OTHER]) {
    const base = eraseUnitBaseFor(addr);
    unit(base).fill(0xa5, addr - base, addr - base + 16);
  }
  return flash;
}

interface StageCounts {
  r: number;
  rBytes: number;
  w: number;
}

function countByStage(pipe: AtD890ScriptedPipe, stageAt: (index: number) => string) {
  const byStage = new Map<string, StageCounts>();
  pipe.writes.forEach((f, i) => {
    if (f[0] !== 0x52 && f[0] !== 0x57) return;
    const s = stageAt(i);
    const c = byStage.get(s) ?? { r: 0, rBytes: 0, w: 0 };
    if (f[0] === 0x52) {
      c.r += 1;
      c.rBytes += f[5]!;
    } else c.w += 1;
    byStage.set(s, c);
  });
  return byStage;
}

function addr(f: Uint8Array): number {
  return ((f[1]! << 24) | (f[2]! << 16) | (f[3]! << 8) | f[4]!) >>> 0;
}

async function runWrite(n: number) {
  // Stage of each frame is the stage of the latest progress event when it was sent.
  const flash = makeStaleFlash();
  const pipe = new AtD890ScriptedPipe();
  pipe.autoAckWrites = true;
  pipe.readResponder = (a, len) => {
    const base = eraseUnitBaseFor(a);
    if (a + len > base + UNIT) throw new Error(`read crosses unit 0x${a.toString(16)}`);
    const u = flash.get(base);
    return u ? u.slice(a - base, a - base + len) : new Uint8Array(len).fill(0xff);
  };
  // Stage of each frame: the stage of the most recent progress event when it was sent.
  const stageOfFrame: string[] = [];
  const origWrite = pipe.write.bind(pipe);
  let currentStage = '(none)';
  pipe.write = async (data: Uint8Array) => {
    stageOfFrame[pipe.writes.length] = currentStage;
    return origWrite(data);
  };
  await uploadAtD890DigitalContacts(pipe, contacts(n), {
    onProgress: (p) => {
      currentStage = p.stage ?? '(none)';
    },
  });
  const stages = countByStage(pipe, (i) => stageOfFrame[i] ?? '(none)');
  const wAddrs = pipe.writes.filter((f) => f[0] === 0x57).map(addr);
  return { pipe, stages, wAddrs };
}

describe('AT-D890 digital contact write frame counts (#1406)', () => {
  const nonFfChunks = (n: number) => packAtD890DigitalContacts(contacts(n)).stagingChunks.length;

  it.each([2, 100, 1000])(
    'writes %i contacts over a stale 18,894 contact list',
    async (n) => {
      const { pipe, stages, wAddrs } = await runWrite(n);
      // No bookkeeping block and nothing in the non-contact unit is sent.
      expect(wAddrs.some(isAtD890EraseUnitBookkeepingAddress)).toBe(false);
      expect(wAddrs).not.toContain(PLANT_OTHER);
      expect(wAddrs.every((a) => a % 16 === 0)).toBe(true);
      // Ascending, each unit visited once.
      expect([...wAddrs].sort((a, b) => a - b)).toEqual(wAddrs);
      const unitRuns = wAddrs
        .map(eraseUnitBaseFor)
        .filter((u, i, arr) => i === 0 || u !== arr[i - 1]);
      expect(new Set(unitRuns).size).toBe(unitRuns.length);
      expect(unitRuns).toHaveLength(3);

      assertAtD890NoReadAfterWrite(pipe.writes);
      // No R frame at all, and no preserve stage.
      expect(stages.has('Preserving untouched contact data')).toBe(false);
      expect(stages.get('Digital contacts')).toEqual({ r: 0, rBytes: 0, w: EXPECTED_W[n] });
      expect(wAddrs).toHaveLength(nonFfChunks(n));
      // The stale tail of the earlier, longer list is erased, not re-sent.
      for (const p of PLANTED) expect(wAddrs).not.toContain(p);
    },
    30_000,
  );
});

/** Non-`FF` packer chunks: the only frames a contact Write sends. */
const EXPECTED_W: Record<number, number> = { 2: 14, 100: 626, 1000: 6251 };
