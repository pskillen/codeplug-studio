import { describe, expect, it } from 'vitest';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import type { RadioSession } from '../../types.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { createOpenGd77WriteVerifyHooks } from './writeVerifyHooks.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import { encodeOpenGd77UserDatabase } from './userDatabaseCodec.ts';
import {
  buildUserDatabaseVerifySnapshot,
  compareUserDatabaseReadback,
} from './userDatabaseVerify.ts';
import { userDatabaseFlashSpans } from './userDatabaseWrite.ts';

function contacts(n: number): RadioDigitalContactDto[] {
  return Array.from({ length: n }, (_, i) => ({
    wireName: `Op ${i}`,
    digitalId: 1000 + i,
    callsign: `M0A${i}`,
    city: '',
    province: '',
    country: '',
    remark: '',
  }));
}

/** What the radio holds after the Write: header, then the entries, as the read-back returns them. */
function occupiedFor(n: number): Uint8Array {
  const spans = userDatabaseFlashSpans(encodeOpenGd77UserDatabase(contacts(n)));
  const out = new Uint8Array(spans.reduce((t, s) => t + s.data.length, 0));
  let o = 0;
  for (const s of spans) {
    out.set(s.data, o);
    o += s.data.length;
  }
  return out;
}

describe('compareUserDatabaseReadback', () => {
  const snapshot = buildUserDatabaseVerifySnapshot(encodeOpenGd77UserDatabase(contacts(400)));

  it('splits the occupied bytes into one slice per FLASH sector touched', () => {
    expect(snapshot.slices.length).toBe(Math.ceil((12 + 400 * 27) / 4096));
    expect(snapshot.slices.every((s) => s.length <= 4096)).toBe(true);
  });

  it('matches identical read-back', () => {
    const out = compareUserDatabaseReadback(snapshot, occupiedFor(400));
    expect(out.mismatches).toEqual([]);
    expect(out.region.status).toBe('match');
    expect(out.chunkCount).toBe(1 + snapshot.slices.length);
  });

  it('reports a flipped entry byte as a digest mismatch at that sector', () => {
    const bad = occupiedFor(400);
    bad[5000] ^= 0xff;
    const out = compareUserDatabaseReadback(snapshot, bad);
    expect(out.mismatches).toHaveLength(1);
    const m = out.mismatches[0]!;
    expect(m.kind).toBe('mismatch');
    expect(m.address).toBe(snapshot.slices[1]!.abs);
    expect(m.regionLabel).toBe('User Database');
    expect(m.expectedDigest).not.toBe(m.actualDigest);
    expect(out.region.status).toBe('mismatch');
  });

  it('reports a damaged header with its bytes', () => {
    const bad = occupiedFor(400);
    bad[0] = 0x00;
    const out = compareUserDatabaseReadback(snapshot, bad);
    const m = out.mismatches.find((x) => x.address === snapshot.headerAbs)!;
    expect(m.kind).toBe('mismatch');
    expect(m.expected[0]).toBe(0x49);
    expect(m.actual![0]).toBe(0x00);
  });

  it('marks slices a good-header read-back is too short to cover as not read, never fabricated', () => {
    const out = compareUserDatabaseReadback(snapshot, occupiedFor(400).subarray(0, 5000));
    const notRead = out.mismatches.filter((m) => m.kind === 'not_read');
    expect(notRead.length).toBe(snapshot.slices.length - 1);
    expect(notRead.every((m) => m.actual === null)).toBe(true);
    expect(out.mismatches.some((m) => m.kind === 'mismatch')).toBe(false);
  });

  it('reports a lower header count as one header mismatch and does not compare entries', () => {
    const out = compareUserDatabaseReadback(snapshot, occupiedFor(100));
    expect(out.mismatches).toHaveLength(1);
    expect(out.mismatches[0]!.kind).toBe('mismatch');
    expect(out.mismatches[0]!.address).toBe(snapshot.headerAbs);
  });

  it('reports a bad-magic header as one header mismatch, not a not-read row per sector', () => {
    const bad = new Uint8Array(12).fill(0xff);
    const out = compareUserDatabaseReadback(snapshot, bad);
    expect(out.mismatches).toHaveLength(1);
    const m = out.mismatches[0]!;
    expect(m.kind).toBe('mismatch');
    expect(m.address).toBe(snapshot.headerAbs);
    expect(m.actual).toEqual(bad);
    expect(out.region.status).toBe('mismatch');
  });

  it('reports a read-back with no bytes as one not-read header row', () => {
    const out = compareUserDatabaseReadback(snapshot, new Uint8Array(0));
    expect(out.mismatches).toHaveLength(1);
    expect(out.mismatches[0]!.kind).toBe('not_read');
  });
});

describe('OpenGD77 write verify covers the User Database', () => {
  const hooks = createOpenGd77WriteVerifyHooks('dm1701');
  const asSession = (radio: OpenGd77Protocol) => ({ radio }) as unknown as RadioSession;

  async function writeThenReconnect(n: number) {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const writer = new OpenGd77Protocol();
    await writer.connect(pipe, { settleScale: 0 });
    await writer.uploadUserDatabase(contacts(n), {});
    const captured = hooks.captureAfterUpload(asSession(writer));
    const checker = new OpenGd77Protocol();
    await checker.connect(pipe, { settleScale: 0 });
    return { pipe, captured, checker };
  }

  it('captures a JSON-safe digest after the whole database was programmed', async () => {
    const { captured } = await writeThenReconnect(400);
    expect(captured).toBeDefined();
    expect(captured!.staging.chunks).toEqual([]);
    expect(captured!.kept).toMatchObject({ entries: [], userDatabase: { headerAbs: 0x50000 } });
    expect(JSON.parse(JSON.stringify(captured!.kept))).toEqual(captured!.kept);
  });

  it('passes when the radio holds what was sent', async () => {
    const { captured, checker } = await writeThenReconnect(400);
    const result = await hooks.runVerify(asSession(checker), captured!);
    expect(result.ok).toBe(true);
    const row = result.regions.find((r) => r.group === 'user-database')!;
    expect(row.status).toBe('match');
    expect(result.regionGroups.map((g) => g.id)).toContain('user-database');
  });

  it('fails and names the User Database when a sector reads back wrong', async () => {
    const { pipe, captured, checker } = await writeThenReconnect(400);
    pipe.plantByte(0x50000 + 4096 + 10, 0x5a);
    const result = await hooks.runVerify(asSession(checker), captured!);
    expect(result.ok).toBe(false);
    expect(result.staging.mismatchedChunks).toBe(1);
    expect(result.staging.mismatches[0]!.regionLabel).toBe('User Database');
    expect(result.regions.find((r) => r.group === 'user-database')!.status).toBe('mismatch');
  });

  it('a wiped header fails the check with one header mismatch', async () => {
    const { pipe, captured, checker } = await writeThenReconnect(400);
    for (let i = 0; i < 12; i++) pipe.plantByte(0x50000 + i, 0xff);
    const result = await hooks.runVerify(asSession(checker), captured!);
    expect(result.ok).toBe(false);
    const udb = result.staging.mismatches.filter((m) => m.regionLabel === 'User Database');
    expect(udb).toHaveLength(1);
    expect(udb[0]!.kind).toBe('mismatch');
    expect(udb[0]!.address).toBe(0x50000);
  });

  it('a Write that sent no User Database leaves nothing to capture for it', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe, { settleScale: 0 });
    expect(proto.takeUploadUserDatabaseSnapshot()).toBeUndefined();
  });
});
