import { describe, expect, it } from 'vitest';
import { RT95_ALL_SETTINGS_FIELD_IDS } from '@core/radios/retevis/rt95/radioSettings.ts';
import { RT95_POWER_ON_PASSWORD_ADDRESS } from './constants.ts';
import { projectRt95Settings } from './debugMemorySettings.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';

function image() {
  const img = buildSyntheticRt95Image();
  img[0x3204] = 0x05; // squelch A
  img[0x321c] = 0x01; // VOX on
  img.set([0x31, 0x32, 0x33, 0x34, 0x35, 0x36], RT95_POWER_ON_PASSWORD_ADDRESS);
  return img;
}

describe('projectRt95Settings', () => {
  it('lists every registered field and decodes known values', () => {
    const inv = projectRt95Settings(image());
    expect(inv.fields).toHaveLength(73);
    expect(inv.fields.map((f) => f.id).sort()).toEqual([...RT95_ALL_SETTINGS_FIELD_IDS].sort());
    expect(inv.counts.captured).toBe(73);
    const squelch = inv.fields.find((f) => f.id === 'squelchLevelA')!;
    expect(squelch.value).toBeDefined();
    expect(squelch.raw).toEqual([0x05]);
    expect(inv.fields.find((f) => f.id === 'voxOnOff')!.value).toBe('On');
    expect(inv.fields.every((f) => f.targets.length > 0 && f.trust)).toBe(true);
  });

  it('flags only the power-on password as sensitive', () => {
    const inv = projectRt95Settings(image());
    const sensitive = inv.fields.filter((f) => f.sensitive).map((f) => f.id);
    expect(sensitive).toEqual(['powerOnPasswordDigits']);
    expect(inv.fields.find((f) => f.sensitive)!.value).toBe('123456');
  });

  it('computes the bytes no field claims', () => {
    const inv = projectRt95Settings(image());
    expect(inv.counts.windowBytes).toBe(512);
    expect(inv.counts.claimedBytes).toBe(377);
    expect(inv.counts.unclaimedBytes).toBe(135);
    expect(inv.unclaimed.reduce((n, r) => n + r.length, 0)).toBe(135);
    expect(inv.unclaimed[0]).toMatchObject({ address: 0x1987, length: 9 });
    expect(inv.unclaimed[0]!.raw).toHaveLength(9);
  });

  it('does not fill missing bytes', () => {
    const inv = projectRt95Settings(undefined);
    expect(inv.counts.captured).toBe(0);
    expect(inv.fields.every((f) => f.status === 'not-captured' && f.raw === undefined)).toBe(true);
    const partial = projectRt95Settings(image().subarray(0x3200), 0x3200);
    expect(partial.fields.find((f) => f.id === 'startingDisplay')!.status).toBe('not-captured');
    expect(partial.fields.find((f) => f.id === 'squelchLevelA')!.status).toBe('captured');
  });
});
