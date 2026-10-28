import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RadioSession } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { expectEmittedWithinPlan, stageRecorder } from '../../plannedStagesTestKit.ts';
import {
  createFakeRt95Pipe,
  FAKE_RT95_IDENT_ADDR,
  type FakeRt95Pipe,
} from './__fixtures__/fakeRt95Pipe.ts';
import { MMD1_VECTORS, MMD1_VECTOR_CHANNELS, type Mmd1Vector } from './__fixtures__/mmd1Vectors.ts';
import { RT95_BLOCK_ADDR_END, RT95_IMAGE_SIZE } from './constants.ts';
import {
  RT95_GUARD_ALIAS_ADDR,
  Rt95WriteRefusedError,
  type Rt95ModDataInput,
  type Rt95WriteContext,
} from './modData/index.ts';
import { planRt95Stages } from './plannedStages.ts';
import { Rt95Protocol, setRt95EndAtForTests, setRt95RetryTuningForTests } from './protocol.ts';
import { RT95_WRITE_VERIFY_HOOKS } from './writeVerifyHooks.ts';
import { rt95ModDataIntentFromOrganisation } from './modDataIntent.ts';

const STOCK_WRITES = RT95_IMAGE_SIZE / 16;

function vector(id: Mmd1Vector['id']): Mmd1Vector {
  return MMD1_VECTORS.find((v) => v.id === id)!;
}
function fromHex(h: string): Uint8Array {
  return Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
}
function intentOf(v: Mmd1Vector): Rt95ModDataInput {
  return { zones: v.zones, descriptions: v.descriptions };
}
function dtos(): RadioChannelDto[] {
  return MMD1_VECTOR_CHANNELS.map((c) => ({
    slotIndex: c.slotIndex,
    empty: false,
    wireName: c.wireName,
    rxHz: c.rxHz,
    txHz: c.rxHz,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
  }));
}

function wAddrs(pipe: FakeRt95Pipe): number[] {
  return pipe.log.filter((e) => e.op === 'W').map((e) => e.addr!);
}
function expectNoForbiddenWrites(pipe: FakeRt95Pipe): void {
  for (const addr of wAddrs(pipe)) {
    expect(addr).not.toBe(0x4010);
    expect(addr).toBeLessThan(0x6000);
  }
}

/** Mirrors the session: connect, pre-write read, optional chip probe, encode, upload. */
async function write(
  pipe: FakeRt95Pipe,
  intent: Rt95ModDataInput | null,
  opts: { probe?: boolean; onProgress?: (p: never) => void } = {},
): Promise<Rt95Protocol> {
  const radio = new Rt95Protocol();
  await radio.connect(pipe);
  const prior = await radio.download();
  radio.setModDataIntent(intent);
  if (intent && opts.probe !== false) await radio.probeChipGuard();
  const image = radio.encodeChannels(prior, dtos());
  await radio.upload(image, { onProgress: opts.onProgress as never });
  return radio;
}

beforeEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
});
afterEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({});
});

describe('RT95 MM9PDY Write', () => {
  it('writes stock blocks, then descriptions, slots, names, header last (vector A)', async () => {
    const pipe = createFakeRt95Pipe();
    await write(pipe, intentOf(vector('A')));
    const lastProgram = pipe.log.map((e) => e.op).lastIndexOf('PROGRAM');
    const fromUpload = pipe.log.slice(lastProgram);
    const compact = fromUpload.map((e) => (e.addr === undefined ? e.op : `${e.op} ${e.addr}`));
    const stock = Array.from({ length: STOCK_WRITES }, (_, i) => `W ${i * 16}`);
    expect(compact).toEqual([
      'PROGRAM',
      'IDENT',
      `R ${0x3b10}`,
      `R ${0x3b00}`,
      `R ${0x7b00}`,
      ...stock,
      `W ${0x5000}`,
      `W ${0x5020}`,
      `W ${0x4300}`,
      `W ${0x4310}`,
      `W ${0x4100}`,
      `W ${0x4000}`,
      'END',
    ]);
    for (const b of vector('A').blocks) {
      expect(pipe.eeprom.slice(b.address, b.address + 16)).toEqual(fromHex(b.hex));
    }
    expectNoForbiddenWrites(pipe);
  });

  it('ends the pre-write read with the chip probe: R 0x3B00 then R 0x7B00', async () => {
    const pipe = createFakeRt95Pipe();
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    await radio.download();
    const before = pipe.log.length;
    expect(await radio.probeChipGuard()).toEqual({ ok: true });
    expect(pipe.log.slice(before).map((e) => `${e.op} ${e.addr}`)).toEqual([
      `R ${0x3b00}`,
      `R ${0x7b00}`,
    ]);
    expect(pipe.count('W')).toBe(0);
  });

  it('writes the header only for an empty build (retires an older table)', async () => {
    const pipe = createFakeRt95Pipe();
    await write(pipe, intentOf(vector('B')));
    expect(wAddrs(pipe).filter((a) => a > RT95_BLOCK_ADDR_END)).toEqual([0x4000]);
    expect(pipe.eeprom.slice(0x4000, 0x4010)).toEqual(fromHex(vector('B').blocks[0]!.hex));
    expectNoForbiddenWrites(pipe);
  });

  it('stock target sends no mod block and never reads 0x7B00', async () => {
    const pipe = createFakeRt95Pipe();
    await write(pipe, null);
    expect(wAddrs(pipe).every((a) => a <= RT95_BLOCK_ADDR_END)).toBe(true);
    expect(pipe.log.some((e) => e.op === 'R' && e.addr === RT95_GUARD_ALIAS_ADDR)).toBe(false);
    expect(pipe.eeprom.slice(0x4000, 0x4010).every((b) => b === 0xff)).toBe(true);
  });

  it('plans and emits the MM9PDY blocks within the plan, and the stock ones too', async () => {
    const prepared = {
      channels: dtos().map((c) => ({ ...c, description: 'x' })),
      organisation: {
        writeRt95ModData: true,
        zones: [{ wireName: 'LOCAL', channelNumbers: [1, 3] }],
      },
    };
    const plan = planRt95Stages('write', { prepared });
    const stock = planRt95Stages('write', {});
    expect(plan[1]!.weight).toBe(stock[1]!.weight + 16 * (2 + 3 + 1));
    expect(plan[0]!.weight).toBe(stock[0]!.weight + 32);

    for (const intent of [null, intentOf(vector('A'))]) {
      const pipe = createFakeRt95Pipe();
      const rec = stageRecorder();
      await write(pipe, intent, { onProgress: rec.onProgress as never });
      expectEmittedWithinPlan(planRt95Stages('write', {}), rec.stages);
    }
  });
});

describe('RT95 MM9PDY chip probe refusals (zero W frames)', () => {
  async function expectRefused(pipe: FakeRt95Pipe, text: RegExp): Promise<void> {
    await expect(write(pipe, intentOf(vector('A')), { probe: false })).rejects.toThrow(text);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.log.at(-1)?.op).toBe('END');
  }
  const TOO_SMALL = /memory is too small/;

  it('refuses an aliasing (16 KiB) chip', async () => {
    await expectRefused(createFakeRt95Pipe({ aliasing16k: true }), TOO_SMALL);
  });
  it('refuses when the 0x3B00 read fails', async () => {
    await expectRefused(createFakeRt95Pipe({ silentReadAddrs: [0x3b00] }), TOO_SMALL);
  });
  it('refuses when the 0x7B00 read fails', async () => {
    await expectRefused(createFakeRt95Pipe({ silentReadAddrs: [0x7b00] }), TOO_SMALL);
  });
  it('refuses an ident that is not RT95-P', async () => {
    const pipe = createFakeRt95Pipe();
    pipe.eeprom.set(new TextEncoder().encode('RT95-X'), FAKE_RT95_IDENT_ADDR);
    await expectRefused(pipe, TOO_SMALL);
  });
  it('refuses an all-zero block at 0x7B00 (head-synthesised, fail closed) and says to retry', async () => {
    const pipe = createFakeRt95Pipe();
    pipe.eeprom.fill(0x00, 0x7b00, 0x7b10);
    await expectRefused(pipe, /returned an empty block[\s\S]*Try the Write again/);
  });
  it('refuses an all-zero ident block at 0x3B00 and says to retry', async () => {
    const pipe = createFakeRt95Pipe();
    pipe.eeprom.fill(0x00, FAKE_RT95_IDENT_ADDR, FAKE_RT95_IDENT_ADDR + 16);
    await expect(write(pipe, intentOf(vector('A')), { probe: false })).rejects.toThrow(
      /returned an empty block/,
    );
    expect(pipe.count('W')).toBe(0);
  });
  it('refuses when the guard passed at the pre-write read but the chip aliases at upload', async () => {
    const pipe = createFakeRt95Pipe();
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const prior = await radio.download();
    radio.setModDataIntent(intentOf(vector('A')));
    expect(await radio.probeChipGuard()).toEqual({ ok: true });
    pipe.aliasing16k = true;
    const image = radio.encodeChannels(prior, dtos());
    await expect(radio.upload(image, {})).rejects.toBeInstanceOf(Rt95WriteRefusedError);
    expect(pipe.count('W')).toBe(0);
  });
});

describe('RT95 write interlock reached through the protocol', () => {
  type Internals = {
    writeBlock(
      pipe: unknown,
      addr: number,
      payload: Uint8Array,
      ctx: Rt95WriteContext,
    ): Promise<void>;
  };
  const passing: Rt95WriteContext = {
    profile: 'mm9pdy',
    chipGuardPassed: true,
    operation: 'write',
  };

  async function attempt(addr: number, ctx: Rt95WriteContext, length = 16): Promise<FakeRt95Pipe> {
    const pipe = createFakeRt95Pipe();
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const before = pipe.eeprom.slice();
    await expect(
      (radio as unknown as Internals).writeBlock(
        pipe,
        addr,
        new Uint8Array(length).fill(0x11),
        ctx,
      ),
    ).rejects.toBeInstanceOf(Rt95WriteRefusedError);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.eeprom).toEqual(before);
    return pipe;
  }

  it('refuses 0x4010 (the radio state block)', async () => {
    await attempt(0x4010, passing);
  });
  it('refuses 0x6000 and above', async () => {
    await attempt(0x6000, passing);
  });
  it('refuses 0x7B00 (the alias of the ident)', async () => {
    await attempt(0x7b00, passing);
  });
  it('refuses the ident range 0x3B00 and the gap before the MMD1 range', async () => {
    await attempt(0x3b00, passing);
    await attempt(0x32a0, passing);
  });
  it('refuses an MMD1 block with the stock context, and without a passing chip guard', async () => {
    await attempt(0x4000, { ...passing, profile: 'stock' });
    await attempt(0x4000, { ...passing, chipGuardPassed: false });
  });
  it('refuses a misaligned address and a short payload', async () => {
    await attempt(0x4008, passing);
    await attempt(0x4000, passing, 8);
  });
});

describe('RT95 MM9PDY verify', () => {
  async function writeAndVerify(corrupt?: (pipe: FakeRt95Pipe) => void) {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 60 });
    const radio = await write(pipe, intentOf(vector('A')));
    corrupt?.(pipe);
    const session = { radio, pipe } as unknown as RadioSession;
    const pending = RT95_WRITE_VERIFY_HOOKS.captureAfterUpload(session);
    expect(pending).toBeDefined();
    const result = await RT95_WRITE_VERIFY_HOOKS.runVerify(session, pending!);
    return { result, pipe };
  }

  it('passes and reads the six MMD1 blocks back', async () => {
    const { result, pipe } = await writeAndVerify();
    expect(result.ok).toBe(true);
    const modReads = pipe.log.filter((e) => e.op === 'R' && e.addr! >= 0x4000 && e.addr! < 0x6000);
    expect(modReads.map((e) => e.addr).sort()).toEqual(
      [0x4000, 0x4100, 0x4300, 0x4310, 0x5000, 0x5020].sort(),
    );
    expect(result.regions.map((r) => r.id)).toEqual(
      expect.arrayContaining(['zones', 'descriptions']),
    );
  });

  it('reports a mismatch in Zones when 0x4100 is corrupted', async () => {
    const { result } = await writeAndVerify((pipe) => {
      pipe.eeprom[0x4100] = 0x00;
    });
    expect(result.ok).toBe(false);
    const zones = result.regions.find((r) => r.id === 'zones');
    expect(zones?.status).toBe('mismatch');
  });

  it('does not add MMD1 regions to a stock verify', async () => {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 60 });
    const radio = await write(pipe, null);
    const session = { radio, pipe } as unknown as RadioSession;
    const result = await RT95_WRITE_VERIFY_HOOKS.runVerify(
      session,
      RT95_WRITE_VERIFY_HOOKS.captureAfterUpload(session)!,
    );
    expect(result.ok).toBe(true);
    expect(result.regions.some((r) => r.id === 'zones')).toBe(false);
  });
});

describe('rt95ModDataIntentFromOrganisation', () => {
  it('is null unless the projection asks for mod data', () => {
    expect(rt95ModDataIntentFromOrganisation({}, dtos())).toBeNull();
    expect(rt95ModDataIntentFromOrganisation(undefined, undefined)).toBeNull();
  });
  it('maps zones to 0-based indexes and keeps non-empty descriptions only', () => {
    const channels = [
      { ...dtos()[0]!, description: 'Calling ch' },
      { ...dtos()[1]!, description: '' },
    ];
    expect(
      rt95ModDataIntentFromOrganisation(
        { writeRt95ModData: true, zones: [{ wireName: 'LOCAL', channelNumbers: [1, 3] }] },
        channels,
      ),
    ).toEqual({
      zones: [{ name: 'LOCAL', channelIndexes: [0, 2] }],
      descriptions: [{ channelIndex: 0, text: 'Calling ch' }],
    });
  });
  it('keeps an empty table as an intent (it retires an older one)', () => {
    expect(rt95ModDataIntentFromOrganisation({ writeRt95ModData: true }, [])).toEqual({
      zones: [],
      descriptions: [],
    });
  });
});
