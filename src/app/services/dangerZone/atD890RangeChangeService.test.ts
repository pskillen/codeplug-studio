import { describe, expect, it } from 'vitest';
import { createRadioSession, getRadioDescriptor, type RadioSession } from '@integrations/radio-io';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { eraseUnitBaseFor } from '@integrations/radio-io/radios/at-d890uv/eraseUnits.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { AtD890StunKillError } from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import { defaultRestorableRegionIds } from '../radioBackupRestore.ts';
import { FakeD890Radio } from './__fixtures__/fakeD890Radio.ts';
import {
  backupForRangeChange,
  changeRange,
  checkRestored,
  identifyRangeChangeRadio,
  restoreAfterChange,
  verifyAfterChange,
  type RangeChangeBackupPair,
} from './atD890RangeChangeService.ts';

const LOCAL_INFO = D890_MAP.LocalInfo;

async function open(fake: FakeD890Radio): Promise<RadioSession & { n: number }> {
  const descriptor = getRadioDescriptor('AT-D890UV')!;
  const pipe = fake.open();
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  return Object.assign(createRadioSession({ descriptor, pipe, radio }), { n: pipe.session });
}

async function sessionA(fake: FakeD890Radio) {
  const a = await open(fake);
  const radio = await identifyRangeChangeRadio(a);
  const pair = await backupForRangeChange(a, {});
  return { a, radio, pair };
}

const kinds = (fake: FakeD890Radio, session: number) =>
  fake.frames.filter((f) => f.session === session).map((f) => f.kind);

describe('range change service', () => {
  it('the whole flow: exactly one W to 0x04F80000/0x10 in A, writes only inside restorable units in B, none in C', async () => {
    const fake = new FakeD890Radio(3);
    const { a, radio, pair } = await sessionA(fake);
    expect(radio.serial).toBe('TESTSERIAL01');
    expect(radio.identCode).toBe(3);
    // Session A so far: only reads.
    expect(fake.writesIn(a.n)).toHaveLength(0);

    let beforeSendWrites = -1;
    const outcome = await changeRange(a, {
      backupLocalInfo: pair.localInfo,
      target: 7,
      onBeforeSend: () => {
        beforeSendWrites = fake.writesIn(a.n).length;
      },
    });
    expect(outcome).toEqual({ kind: 'changed', endConfirmed: true });
    expect(beforeSendWrites).toBe(0);
    expect(fake.band).toBe(7);

    // Session A: read, guard, one W, END. Nothing follows the W but END, and END is sent once.
    const aKinds = kinds(fake, a.n);
    const w = aKinds.indexOf('W');
    expect(aKinds.filter((k) => k === 'W')).toHaveLength(1);
    expect(aKinds.slice(w)).toEqual(['W', 'END']);
    expect(fake.writesIn(a.n)).toEqual([
      { session: a.n, kind: 'W', address: 0x04f80000, length: 0x10 },
    ]);

    // Session B: verify, then restore every restorable region.
    const b = await open(fake);
    const live = await identifyRangeChangeRadio(b);
    expect(live.identCode).toBe(7);
    const verified = await verifyAfterChange(b, {
      serial: pair.serial,
      backupLocalInfo: pair.localInfo,
      backupTune: pair.tune,
      target: 7,
    });
    expect(verified.kind).toBe('ok');
    // The radio is wiped now.
    expect(fake.getBytes(D890_MAP.ChannelSet, 16).every((x) => x === 0xff)).toBe(true);
    const { regionIds } = await restoreAfterChange(b, pair.backup, {});
    expect(regionIds).toEqual(defaultRestorableRegionIds(pair.backup.manifest));
    expect(regionIds.length).toBeGreaterThan(10);

    const restorableUnits = new Set(
      pair.backup.manifest.regions
        .filter((r) => r.restoreRole === 'restorable')
        .flatMap((r) => {
          const units: number[] = [];
          for (let x = eraseUnitBaseFor(r.address); x < r.address + r.byteLength; x += 0x40000) {
            units.push(x);
          }
          return units;
        }),
    );
    const bWrites = fake.writesIn(b.n);
    expect(bWrites.length).toBeGreaterThan(0);
    for (const f of bWrites) {
      expect(f.address! < 0x04f00000 || f.address! > 0x04ffffff).toBe(true);
      expect(restorableUnits.has(eraseUnitBaseFor(f.address!))).toBe(true);
    }
    expect(fake.endsIn(b.n)).toBe(1);
    // Every R of session B came before its first W.
    const bKinds = kinds(fake, b.n);
    expect(bKinds.lastIndexOf('R')).toBeLessThan(bKinds.indexOf('W'));

    // Session C: read only.
    const c = await open(fake);
    const check = await checkRestored(c, pair.backup, {});
    expect(check).toMatchObject({ ok: true, differences: [] });
    expect(fake.writesIn(c.n)).toHaveLength(0);

    // The whole flow: exactly one W to the range address, none at LocalInfo or the tune bank anywhere else.
    const all = fake.allWrites();
    expect(all.filter((f) => f.address === 0x04f80000 && f.length === 0x10)).toHaveLength(1);
    expect(all.filter((f) => f.address! >= 0x04f00000 && f.address! <= 0x04ffffff)).toHaveLength(1);
    expect(all.filter((f) => f.session === a.n)).toHaveLength(1);
  }, 60_000);

  it('a stun flag at identify: no W and no END', async () => {
    const fake = new FakeD890Radio(3);
    const li = fake.getBytes(LOCAL_INFO, 0x100);
    li[0] = 1;
    fake.setBytes(LOCAL_INFO, li);
    const a = await open(fake);
    await expect(identifyRangeChangeRadio(a)).rejects.toBeInstanceOf(AtD890StunKillError);
    expect(fake.allWrites()).toHaveLength(0);
    expect(fake.frames.filter((f) => f.kind === 'END')).toHaveLength(0);
  });

  it('a stun flag that appears before the frame: no W, no END, journal never written', async () => {
    const fake = new FakeD890Radio(3);
    const { a, pair } = await sessionA(fake);
    const li = fake.getBytes(LOCAL_INFO, 0x100);
    li[1] = 1;
    fake.setBytes(LOCAL_INFO, li);
    let journalled = false;
    const outcome = await changeRange(a, {
      backupLocalInfo: pair.localInfo,
      target: 7,
      onBeforeSend: () => {
        journalled = true;
      },
    });
    expect(outcome.kind).toBe('stun-kill');
    expect(journalled).toBe(false);
    expect(fake.allWrites()).toHaveLength(0);
    expect(fake.endsIn(a.n)).toBe(0);
  }, 60_000);

  it('LocalInfo changed since the backup: no W, END sent, nothing changed', async () => {
    const fake = new FakeD890Radio(3);
    const { a, pair } = await sessionA(fake);
    const li = fake.getBytes(LOCAL_INFO, 0x100);
    li[0x80] = 0x42;
    fake.setBytes(LOCAL_INFO, li);
    const outcome = await changeRange(a, {
      backupLocalInfo: pair.localInfo,
      target: 7,
      onBeforeSend: () => {},
    });
    expect(outcome).toMatchObject({ kind: 'nothing-changed', reason: 'radio-changed' });
    expect(fake.allWrites()).toHaveLength(0);
    expect(fake.endsIn(a.n)).toBe(1);
    expect(fake.band).toBe(3);
  }, 60_000);

  it('a NAK on the W: not taken, no END, the range is unchanged', async () => {
    const fake = new FakeD890Radio(3);
    const { a, pair } = await sessionA(fake);
    fake.nakAddress = LOCAL_INFO;
    const outcome = await changeRange(a, {
      backupLocalInfo: pair.localInfo,
      target: 7,
      onBeforeSend: () => {},
    });
    expect(outcome.kind).toBe('not-taken');
    expect(fake.endsIn(a.n)).toBe(0);
    expect(fake.band).toBe(3);
  }, 60_000);

  it('a target the frame builder refuses (the current range) sends nothing', async () => {
    const fake = new FakeD890Radio(3);
    const { a, pair } = await sessionA(fake);
    const outcome = await changeRange(a, {
      backupLocalInfo: pair.localInfo,
      target: 3,
      onBeforeSend: () => {
        throw new Error('must not run');
      },
    });
    expect(outcome).toMatchObject({ kind: 'nothing-changed', reason: 'refused' });
    expect(fake.allWrites()).toHaveLength(0);
  }, 60_000);

  describe('session B checks', () => {
    async function changed(): Promise<{ fake: FakeD890Radio; pair: RangeChangeBackupPair }> {
      const fake = new FakeD890Radio(3);
      const { a, pair } = await sessionA(fake);
      await changeRange(a, { backupLocalInfo: pair.localInfo, target: 7, onBeforeSend: () => {} });
      return { fake, pair };
    }
    const verify = async (fake: FakeD890Radio, pair: RangeChangeBackupPair, over = {}) => {
      const b = await open(fake);
      return verifyAfterChange(b, {
        serial: pair.serial,
        backupLocalInfo: pair.localInfo,
        backupTune: pair.tune,
        target: 7,
        ...over,
      });
    };

    it('the same radio, the new range', async () => {
      const { fake, pair } = await changed();
      expect((await verify(fake, pair)).kind).toBe('ok');
    }, 60_000);

    it('a different radio (serial differs)', async () => {
      const { fake, pair } = await changed();
      const li = fake.getBytes(LOCAL_INFO, 0x100);
      li.set(new TextEncoder().encode('TESTSERIAL02'), 0x30);
      fake.setBytes(LOCAL_INFO, li);
      expect(await verify(fake, pair)).toMatchObject({
        kind: 'wrong-radio',
        serial: 'TESTSERIAL02',
      });
    }, 60_000);

    it('the old range with LocalInfo as in the backup: the change did not take', async () => {
      const fake = new FakeD890Radio(3);
      const { pair } = await sessionA(fake);
      expect((await verify(fake, pair)).kind).toBe('not-taken');
    }, 60_000);

    it('an unexpected range', async () => {
      const { fake, pair } = await changed();
      fake.band = 9;
      const li = fake.getBytes(LOCAL_INFO, 0x100);
      li[3] = 9;
      fake.setBytes(LOCAL_INFO, li);
      expect(await verify(fake, pair)).toMatchObject({ kind: 'unexpected-range', code: 9 });
    }, 60_000);

    it('an extra LocalInfo byte differs', async () => {
      const { fake, pair } = await changed();
      const li = fake.getBytes(LOCAL_INFO, 0x100);
      li[0x90] ^= 0xff;
      fake.setBytes(LOCAL_INFO, li);
      const out = await verify(fake, pair);
      expect(out.kind).toBe('identity-differs');
      if (out.kind === 'identity-differs') expect(out.result.localInfoDiffs).toEqual([0x90]);
    }, 60_000);

    it('an extra tune byte differs', async () => {
      const { fake, pair } = await changed();
      const tune = fake.getBytes(0x04f00000, 0x2000);
      tune[0x100] ^= 0xff;
      fake.setBytes(0x04f00000, tune);
      const out = await verify(fake, pair);
      expect(out.kind).toBe('identity-differs');
      if (out.kind === 'identity-differs') expect(out.result.tuneDiffs).toEqual([0x100]);
    }, 60_000);

    it('without the vital zip the tune is not compared', async () => {
      const { fake, pair } = await changed();
      const tune = fake.getBytes(0x04f00000, 0x2000);
      tune[0x100] ^= 0xff;
      fake.setBytes(0x04f00000, tune);
      expect((await verify(fake, pair, { backupTune: undefined })).kind).toBe('ok');
    }, 60_000);
  });

  it('the restore check names a region that differs', async () => {
    const fake = new FakeD890Radio(3);
    const { a, pair } = await sessionA(fake);
    await changeRange(a, { backupLocalInfo: pair.localInfo, target: 7, onBeforeSend: () => {} });
    const b = await open(fake);
    await restoreAfterChange(b, pair.backup, {});
    const zone = pair.backup.manifest.regions.find((r) => r.id === 'zone-set')!;
    const bytes = fake.getBytes(zone.address, 16);
    bytes[0] ^= 0xff;
    fake.setBytes(zone.address, bytes);
    const c = await open(fake);
    const check = await checkRestored(c, pair.backup, {});
    expect(check.ok).toBe(false);
    expect(check.differences.map((d) => d.regionId)).toContain('zone-set');
  }, 60_000);
});
