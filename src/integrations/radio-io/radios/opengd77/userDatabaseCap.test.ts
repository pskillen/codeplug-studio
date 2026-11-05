import { describe, expect, it } from 'vitest';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { OPENGD77_WRITE_CMD_SET_SECTOR } from '../../kit/codecs/opengd77Serial.ts';
import { createOpenUv380Image } from './memory.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  OPENUV380_USER_DB_ENTRIES1_ABS,
  OPENUV380_USER_DB_ENTRY_SIZE,
  OPENUV380_USER_DB_WRITE_LIMIT_ABS,
  OPENUV380_VOICE_PROMPTS_ABS,
  OPENUV380_VOICE_PROMPTS_LEGACY_ABS,
} from './constants.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { encodeOpenGd77UserDatabase, encodeUserDatabaseHeader } from './userDatabaseCodec.ts';
import {
  classifyVoicePrompts,
  openGd77NModeDatabaseWarning,
  resolveUserDatabaseCap,
} from './userDatabaseWrite.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

const LIMITS = OPENGD77_FAMILY_LIMITS;
const VP_MAGIC = [0x56, 0x50, 0x00, 0x00];
/** Magic then the version the firmware loads (0x0009), both u32 LE. */
const VP_HEADER = [...VP_MAGIC, 0x09, 0x00, 0x00, 0x00];
/** Magic then a version the firmware does not load (0x0007). */
const VP_HEADER_OLD = [...VP_MAGIC, 0x07, 0x00, 0x00, 0x00];

function rows(n: number): RadioDigitalContactDto[] {
  const out: RadioDigitalContactDto[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      wireName: `N${i}`,
      digitalId: i,
      callsign: `C${i}`,
      city: '',
      province: '',
      country: '',
      remark: '',
    });
  }
  return out;
}

function plantVp(
  pipe: OpenGd77ScriptedPipe,
  abs: number,
  header: readonly number[] = VP_HEADER,
): void {
  header.forEach((b, i) => pipe.plantByte(abs + i, b));
}

function headerCount(pipe: OpenGd77ScriptedPipe): number {
  return (
    (pipe.flashByte(0x50008)! |
      (pipe.flashByte(0x50009)! << 8) |
      (pipe.flashByte(0x5000a)! << 16) |
      (pipe.flashByte(0x5000b)! << 24)) >>>
    0
  );
}

/** Every FLASH read frame sent, in order, with its position in the whole frame log. */
function flashReads(pipe: OpenGd77ScriptedPipe): { index: number; addr: number }[] {
  const out: { index: number; addr: number }[] = [];
  pipe.writes.forEach((w, index) => {
    if (w[0] !== 0x52 || w[1] !== 0x01) return;
    out.push({ index, addr: ((w[2]! << 24) | (w[3]! << 16) | (w[4]! << 8) | w[5]!) >>> 0 });
  });
  return out;
}

/** Index of the first frame that programs FLASH (`X` + SET_SECTOR). */
function firstSectorWrite(pipe: OpenGd77ScriptedPipe): number {
  return pipe.writes.findIndex((w) => w[0] === 0x58 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR);
}

const CHANNEL: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: 'LIVE',
  rxHz: 145_500_000,
  txHz: 145_500_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 100,
  bandwidth: 'NFM',
  mode: 'analog',
};

async function writeWith(
  n: number,
  setup: (pipe: OpenGd77ScriptedPipe) => void = () => {},
  firmware: { flashId?: number; features?: number } = {},
): Promise<{ pipe: OpenGd77ScriptedPipe; proto: OpenGd77Protocol }> {
  const pipe = new OpenGd77ScriptedPipe(0x08, firmware);
  setup(pipe);
  const proto = new OpenGd77Protocol();
  await proto.connect(pipe, { settleScale: 0 });
  await proto.uploadUserDatabase(rows(n), {});
  return { pipe, proto };
}

describe('User Database header mode', () => {
  it("writes mode byte 'N' (78), never 'n' (110)", () => {
    const header = encodeUserDatabaseHeader(1);
    expect(header[2]).toBe(78);
    expect(header[2]).toBe('N'.charCodeAt(0));
    expect(header[2]).not.toBe('n'.charCodeAt(0));
  });
});

describe('User Database bit-1 warning', () => {
  it('is silent on a normal radio (bit 1 clear)', () => {
    expect(openGd77NModeDatabaseWarning(0)).toBeUndefined();
    expect(openGd77NModeDatabaseWarning(0b100)).toBeUndefined();
  });

  it('warns that voice prompts were overwritten when bit 1 is set', () => {
    expect(openGd77NModeDatabaseWarning(0b10)).toMatch(/overwrites the voice prompts/);
  });
});

describe('voice-prompt probe classification', () => {
  const vp = new Uint8Array(VP_HEADER);
  const oldVersion = new Uint8Array(VP_HEADER_OLD);
  const blank = new Uint8Array(8).fill(0xff);
  it('classifies each placement', () => {
    expect(classifyVoicePrompts(vp, blank)).toBe('current');
    expect(classifyVoicePrompts(vp, vp)).toBe('current');
    expect(classifyVoicePrompts(blank, vp)).toBe('legacy-only');
    expect(classifyVoicePrompts(blank, blank)).toBe('none');
    expect(classifyVoicePrompts(undefined, blank)).toBe('unknown');
    expect(classifyVoicePrompts(blank, undefined)).toBe('unknown');
  });
  it('counts the current slot only when the firmware would load its version', () => {
    expect(classifyVoicePrompts(oldVersion, blank)).toBe('none');
    expect(classifyVoicePrompts(oldVersion, vp)).toBe('legacy-only');
    // Magic alone, no version bytes: not loadable.
    expect(classifyVoicePrompts(new Uint8Array([...VP_MAGIC, 0, 0, 0, 0]), blank)).toBe('none');
  });
  it('guards the legacy slot on the magic, whatever its version', () => {
    expect(classifyVoicePrompts(blank, oldVersion)).toBe('legacy-only');
  });
  it('treats a short reply as unknown', () => {
    expect(classifyVoicePrompts(new Uint8Array(4), blank)).toBe('unknown');
    expect(classifyVoicePrompts(vp, new Uint8Array(4))).toBe('unknown');
  });
});

describe('resolveUserDatabaseCap', () => {
  const base = { flashId: 0x4018, features: 0, wanted: 100_000 };
  it('allows the full cap with voice prompts at the current slot', () => {
    expect(resolveUserDatabaseCap({ ...base, probe: 'current' })).toEqual({
      cap: LIMITS.USER_DATABASE_MAX,
      warnings: [],
    });
  });
  it('allows the full cap with no voice prompts', () => {
    expect(resolveUserDatabaseCap({ ...base, probe: 'none' }).cap).toBe(LIMITS.USER_DATABASE_MAX);
  });
  it('caps at 15,776 and says why when prompts live only in the legacy slot', () => {
    const d = resolveUserDatabaseCap({ ...base, probe: 'legacy-only' });
    expect(d.cap).toBe(15_776);
    expect(d.warnings.join(' ')).toMatch(/voice prompts/);
  });
  it('caps at 15,776 when the probe failed', () => {
    const d = resolveUserDatabaseCap({ ...base, probe: 'unknown' });
    expect(d.cap).toBe(15_776);
    expect(d.warnings.join(' ')).toMatch(/could not check/);
  });
  it('treats a missing probe for a large write as unknown', () => {
    expect(resolveUserDatabaseCap({ ...base, probe: undefined }).cap).toBe(15_776);
  });
  it('needs no probe for a write that fits the legacy cap', () => {
    const d = resolveUserDatabaseCap({ ...base, wanted: 15_776, probe: undefined });
    expect(d).toEqual({ cap: LIMITS.USER_DATABASE_MAX, warnings: [] });
  });
  it('falls back to 69,600 when the flash part is not the 16 MiB one', () => {
    const d = resolveUserDatabaseCap({ ...base, flashId: 0x4017, probe: 'none' });
    expect(d.cap).toBe(69_600);
    expect(d.warnings.join(' ')).toMatch(/16 MiB/);
    expect(resolveUserDatabaseCap({ ...base, flashId: undefined, probe: 'none' }).cap).toBe(69_600);
  });
  it('keeps the legacy cap when the flash is unconfirmed and prompts are legacy', () => {
    expect(resolveUserDatabaseCap({ ...base, flashId: 0, probe: 'legacy-only' }).cap).toBe(15_776);
  });
  it('adds the earlier-n-upload warning when bit 1 is set', () => {
    const d = resolveUserDatabaseCap({ ...base, features: 0b10, probe: 'none' });
    expect(d.warnings).toHaveLength(1);
  });
});

describe('User Database Write cap against the radio', () => {
  const WANT = 20_000;

  it('prompts at the current slot: the full list is written', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) => plantVp(p, OPENUV380_VOICE_PROMPTS_ABS));
    expect(headerCount(pipe)).toBe(WANT);
    expect(proto.getLastUserDatabaseWarnings()).toEqual([]);
  }, 60_000);

  it('prompts only in the legacy slot: capped at 15,776, with a warning', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) =>
      plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS),
    );
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/older flash slot/);
    // Nothing was written at or above the legacy slot.
    expect(pipe.flashByte(OPENUV380_VOICE_PROMPTS_LEGACY_ABS)).toBe(0x56);
    expect(pipe.flashByte(OPENUV380_VOICE_PROMPTS_LEGACY_ABS + 1)).toBe(0x50);
  }, 60_000);

  it('a stale-version header at the current slot does not shield prompts in the legacy slot', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) => {
      plantVp(p, OPENUV380_VOICE_PROMPTS_ABS, VP_HEADER_OLD);
      plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS);
    });
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/older flash slot/);
  }, 60_000);

  it('a good header at the current slot allows the full cap even with a stale legacy copy', async () => {
    const { pipe } = await writeWith(WANT, (p) => {
      plantVp(p, OPENUV380_VOICE_PROMPTS_ABS);
      plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS, VP_HEADER_OLD);
    });
    expect(headerCount(pipe)).toBe(WANT);
  }, 60_000);

  it('no prompts anywhere: the full list is written', async () => {
    const { pipe } = await writeWith(WANT);
    expect(headerCount(pipe)).toBe(WANT);
  }, 60_000);

  it('probe read failure: capped at 15,776, with a warning', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) =>
      p.failReadsAt.add(OPENUV380_VOICE_PROMPTS_ABS),
    );
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/could not check/);
  }, 60_000);

  it('legacy-slot read failure is also capped', async () => {
    const { pipe } = await writeWith(WANT, (p) =>
      p.failReadsAt.add(OPENUV380_VOICE_PROMPTS_LEGACY_ABS),
    );
    expect(headerCount(pipe)).toBe(15_776);
  }, 60_000);

  it('a small write sends no probe at all', async () => {
    const { pipe } = await writeWith(100, (p) => p.failReadsAt.add(OPENUV380_VOICE_PROMPTS_ABS));
    expect(headerCount(pipe)).toBe(100);
    const addrs = flashReads(pipe).map((r) => r.addr);
    expect(addrs).not.toContain(OPENUV380_VOICE_PROMPTS_ABS);
    expect(addrs).not.toContain(OPENUV380_VOICE_PROMPTS_LEGACY_ABS);
  });

  it('a probe that times out: capped at 15,776, with a warning', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) =>
      p.silentReadsAt.add(OPENUV380_VOICE_PROMPTS_ABS),
    );
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/could not check/);
  }, 60_000);

  it('a probe that comes back short: capped at 15,776, with a warning', async () => {
    const { pipe, proto } = await writeWith(WANT, (p) =>
      p.shortReadsAt.add(OPENUV380_VOICE_PROMPTS_LEGACY_ABS),
    );
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/could not check/);
  }, 60_000);

  it('unconfirmed flash part: held to 69,600 entries', async () => {
    const { pipe, proto } = await writeWith(
      70_000,
      (p) => plantVp(p, OPENUV380_VOICE_PROMPTS_ABS),
      { flashId: 0x4014 },
    );
    expect(headerCount(pipe)).toBe(69_600);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/16 MiB/);
  }, 120_000);

  it('says how many rows the held cap left out', async () => {
    const { proto } = await writeWith(WANT, (p) => plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS));
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(
      /20000 entries; 4224 were left out.*15776/,
    );
  }, 60_000);

  it('does not claim rows were left out when the whole list fits', async () => {
    const { proto } = await writeWith(WANT, (p) => plantVp(p, OPENUV380_VOICE_PROMPTS_ABS));
    expect(proto.getLastUserDatabaseWarnings().join(' ')).not.toMatch(/left out/);
  }, 60_000);

  it('bit 1 set: warns that an earlier n upload overwrote the voice prompts', async () => {
    const { proto } = await writeWith(10, undefined, { features: 0b10 });
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/voice prompts/);
  });
});

describe('User Database cap in a combined Write', () => {
  async function combined(
    n: number,
    setup: (pipe: OpenGd77ScriptedPipe) => void,
  ): Promise<{ pipe: OpenGd77ScriptedPipe; proto: OpenGd77Protocol }> {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    setup(pipe);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe, { settleScale: 0 });
    proto.armWriteProjection([CHANNEL], { zones: [], userDatabaseContacts: rows(n) });
    await proto.upload(createOpenUv380Image(), {});
    return { pipe, proto };
  }

  it('reads the voice prompts before any FLASH sector is programmed', async () => {
    const { pipe, proto } = await combined(20_000, (p) =>
      plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS),
    );
    const first = firstSectorWrite(pipe);
    expect(first).toBeGreaterThan(0);
    const probes = flashReads(pipe).filter(
      (r) =>
        r.addr === OPENUV380_VOICE_PROMPTS_ABS || r.addr === OPENUV380_VOICE_PROMPTS_LEGACY_ABS,
    );
    expect(probes.map((r) => r.addr)).toEqual([
      OPENUV380_VOICE_PROMPTS_ABS,
      OPENUV380_VOICE_PROMPTS_LEGACY_ABS,
    ]);
    for (const probe of probes) expect(probe.index).toBeLessThan(first);
    expect(headerCount(pipe)).toBe(15_776);
    expect(proto.getLastUserDatabaseWarnings().join(' ')).toMatch(/older flash slot/);
  }, 60_000);

  it('a codeplug-only Write after a held one reports nothing', async () => {
    const { pipe, proto } = await combined(20_000, (p) =>
      plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS),
    );
    expect(proto.getLastUserDatabaseWarnings().length).toBeGreaterThan(0);
    proto.armWriteProjection([CHANNEL], { zones: [] });
    await proto.upload(createOpenUv380Image(), {});
    expect(pipe.rebooted).toBe(true);
    expect(proto.getLastUserDatabaseWarnings()).toEqual([]);
  }, 60_000);

  it('a User Database-only Write resets the warnings of the one before', async () => {
    const { proto } = await combined(20_000, (p) => plantVp(p, OPENUV380_VOICE_PROMPTS_LEGACY_ABS));
    await proto.uploadUserDatabase(rows(10), {});
    expect(proto.getLastUserDatabaseWarnings()).toEqual([]);
  }, 60_000);
});

describe('User Database encode safety', () => {
  it('the first 69,600 entries are byte-identical to the old 69,600-entry encode', () => {
    const all = rows(100_000);
    const old = encodeOpenGd77UserDatabase(all, [], {
      cap: LIMITS.USER_DATABASE_MAX_UNCONFIRMED_FLASH,
    });
    const now = encodeOpenGd77UserDatabase(all);
    expect(old.entryCount).toBe(69_600);
    expect(now.entryCount).toBe(100_000);
    expect(now.entries0).toEqual(old.entries0);
    const prefix = old.entries1.byteLength;
    expect(now.entries1.subarray(0, prefix)).toEqual(old.entries1);
    // Only the header count differs.
    expect(now.header.subarray(0, 8)).toEqual(old.header.subarray(0, 8));
  }, 60_000);

  it('never reaches the GPS log, however many rows are offered', () => {
    const big = encodeOpenGd77UserDatabase(rows(560_000), [], { cap: 10_000_000 });
    expect(big.entryCount).toBe(520_646);
    expect(big.truncated).toBe(560_000 - 520_646);
    expect(OPENUV380_USER_DB_ENTRIES1_ABS + big.entries1.byteLength).toBeLessThanOrEqual(
      OPENUV380_USER_DB_WRITE_LIMIT_ABS,
    );
    expect(OPENUV380_USER_DB_ENTRY_SIZE).toBe(27);
  }, 60_000);

  it('the legacy cap keeps segment 1 below the legacy voice-prompt slot', () => {
    const e = encodeOpenGd77UserDatabase(rows(20_000), [], { cap: 15_776 });
    expect(OPENUV380_USER_DB_ENTRIES1_ABS + e.entries1.byteLength).toBeLessThanOrEqual(
      OPENUV380_VOICE_PROMPTS_LEGACY_ABS,
    );
  });
});
