import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
  AtD890VitalMismatchError,
  readAtD890VitalUnits,
  type AtD890VitalReadSession,
} from './vitalBackup.ts';
import { AtD890StunKillError, atD890StunKillState } from './stunKillGuard.ts';
import {
  buildAtD890VitalManifest,
  packAtD890VitalZip,
  parseAtD890VitalZip,
} from './vitalBackupZip.ts';
import { parseRadioBackupZip } from '../../backup/parse.ts';
import { RadioBackupError } from '../../backup/types.ts';
import { D890_MAP } from './constants.ts';

const BLOCK = 0xf0;

function unitBytes(seed: number): Uint8Array {
  return Uint8Array.from({ length: AT_D890_VITAL_UNIT_BYTES }, (_, i) => (i * 7 + seed) & 0xff);
}

function localInfo(flags = [0, 0]): Uint8Array {
  const u = unitBytes(9);
  u[0] = flags[0]!;
  u[1] = flags[1]!;
  u.fill(0, 0x30, 0x40);
  u.set(new TextEncoder().encode('SN123456'), 0x30);
  u[3] = 3;
  return u;
}

function makeSession(opts: { flags?: number[]; flipOnSecondPass?: boolean } = {}) {
  const pipe = new AtD890ScriptedPipe();
  const li = localInfo(opts.flags);
  const store = new Map<number, Uint8Array>([
    [0x04f0_0000, unitBytes(1)],
    [0x04f4_0000, li], // diverted: the radio returns LocalInfo
    [0x04f8_0000, li],
    [0x04fc_0000, unitBytes(5)],
  ]);
  const seen: number[] = [];
  let tuneReads = 0;
  pipe.readResponder = (addr, len) => {
    seen.push(addr);
    for (const [base, data] of store) {
      if (addr >= base && addr + len <= base + AT_D890_VITAL_UNIT_BYTES) {
        const out = data.slice(addr - base, addr - base + len);
        if (opts.flipOnSecondPass && base === 0x04f0_0000 && addr === base) {
          tuneReads += 1;
          if (tuneReads === 2) out[0] ^= 0xff;
        }
        return out;
      }
      if (addr < base + AT_D890_VITAL_UNIT_BYTES && addr + len > base + AT_D890_VITAL_UNIT_BYTES) {
        throw new Error(`frame crosses unit boundary at 0x${addr.toString(16)}`);
      }
    }
    return null;
  };
  let abandoned = 0;
  const session: AtD890VitalReadSession = {
    pipe,
    readBlockSize: BLOCK,
    abandonProgramMode: () => {
      abandoned += 1;
    },
  };
  return { pipe, session, seen, abandoned: () => abandoned };
}

describe('readAtD890VitalUnits', () => {
  it('reads four units twice, compares, and sends no W frames', async () => {
    const { pipe, session, seen } = makeSession();
    const result = await readAtD890VitalUnits(session);
    expect(result.bothReadsMatched).toBe(true);
    expect(result.units.map((u) => u.def.address)).toEqual(
      AT_D890_VITAL_UNITS.map((u) => u.address),
    );
    // Diversion: the upper tune unit equals LocalInfo byte for byte.
    expect(result.units[1]!.bytes).toEqual(result.units[2]!.bytes);
    expect(seen.length).toBeGreaterThan(8000);
    expect(pipe.writes.filter((w) => w[0] === 0x57)).toEqual([]);
    expect(pipe.writes.every((w) => w[0] === 0x52)).toBe(true);
  }, 60_000);

  it('fails loudly when the two passes differ', async () => {
    const { session } = makeSession({ flipOnSecondPass: true });
    await expect(readAtD890VitalUnits(session)).rejects.toBeInstanceOf(AtD890VitalMismatchError);
  }, 60_000);

  it('stops on a stun/kill flag before reading units and abandons program mode', async () => {
    const { pipe, session, seen, abandoned } = makeSession({ flags: [0, 1] });
    await expect(readAtD890VitalUnits(session)).rejects.toBeInstanceOf(AtD890StunKillError);
    expect(abandoned()).toBe(1);
    expect(seen).toEqual([D890_MAP.LocalInfo]);
    expect(pipe.writes.every((w) => w[0] === 0x52)).toBe(true);
  });
});

describe('atD890StunKillState', () => {
  it('flags either byte', () => {
    expect(atD890StunKillState(Uint8Array.from([0, 0])).flagged).toBe(false);
    expect(atD890StunKillState(Uint8Array.from([1, 0])).flagged).toBe(true);
    expect(atD890StunKillState(Uint8Array.from([0, 2])).flagged).toBe(true);
  });
});

describe('vital zip', () => {
  async function build() {
    const li = localInfo();
    const units = AT_D890_VITAL_UNITS.map((def, i) => ({
      def,
      bytes: def.id === 'tune-b' || def.id === 'local-info' ? li : unitBytes(i),
    }));
    const ident = Uint8Array.from([
      0x49, 0x44, 0x38, 0x39, 0x30, 0x55, 0x56, 0, 3, 0x56, 0x31, 0x30, 0x30, 0, 0, 6,
    ]);
    const manifest = await buildAtD890VitalManifest({
      units,
      ident,
      firmware: 'V100',
      capturedAt: '2026-10-26T10:00:00.000Z',
      app: { buildEnv: 'test', buildVersion: '0.0.0' },
      radioModelId: 'AT-D890UV',
    });
    const zip = packAtD890VitalZip(
      manifest,
      Object.fromEntries(units.map((u) => [u.def.id, u.bytes])),
    );
    return { manifest, zip };
  }

  it('round-trips and records serial, variant, hashes and the diversion', async () => {
    const { manifest, zip } = await build();
    expect(manifest.serial).toBe('SN123456');
    expect(manifest.variant).toBe(3);
    expect(manifest.units.find((u) => u.id === 'local-info')!.identicalTo).toBe('tune-b');
    expect(manifest.units.map((u) => u.path)).toContain('units/04f00000.bin');
    const parsed = await parseAtD890VitalZip(zip);
    expect(parsed.manifest).toEqual(manifest);
    expect(Object.keys(parsed.units)).toHaveLength(4);
  });

  it('is rejected by the codeplug backup parser', async () => {
    const { zip } = await build();
    expect(() => parseRadioBackupZip(zip)).toThrow(RadioBackupError);
    expect(() => parseRadioBackupZip(zip)).toThrow(/vital/i);
  });

  it('rejects a codeplug backup and a tampered unit', async () => {
    const { zip, manifest } = await build();
    const entries = unzipSync(zip);
    entries[manifest.units[0]!.path]![5]! ^= 0xff;
    await expect(parseAtD890VitalZip(zipSync(entries))).rejects.toThrow(/SHA-256/);
    const other = zipSync({ 'manifest.json': new TextEncoder().encode('{"format":"x"}') });
    await expect(parseAtD890VitalZip(other)).rejects.toThrow(/not an AT-D890UV vital/);
  });
});
