import { describe, expect, it } from 'vitest';
import {
  assertAtD890SentinelRegionsPlausible,
  snapshotAtD890SentinelRegions,
} from './sentinelVerify.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';
import { AtD890ScriptedPipe, scriptAtD890SentinelReads } from './__fixtures__/scriptedPipe.ts';
import { D890_MAP } from './constants.ts';

function plausibleSentinelOverrides(): Partial<Record<string, Uint8Array>> {
  const overrides: Partial<Record<string, Uint8Array>> = {};
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = new Uint8Array(extent.length).fill(0xff);
    data[0] = 0x00;
    overrides[extent.id] = data;
  }
  return overrides;
}

describe('sentinelVerify', () => {
  it('snapshots every sentinel extent', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890SentinelReads(pipe, plausibleSentinelOverrides());
    const snap = await snapshotAtD890SentinelRegions(pipe);
    for (const extent of AT_D890_SENTINEL_EXTENTS) {
      expect(snap.get(extent.id)?.length).toBe(extent.length);
    }
  });

  it('plausibility passes when each sentinel has at least one non-0xff byte', () => {
    const snap = new Map<string, Uint8Array>();
    for (const extent of AT_D890_SENTINEL_EXTENTS) {
      const data = new Uint8Array(extent.length).fill(0xff);
      data[0] = 0x11;
      snap.set(extent.id, data);
    }
    expect(() => assertAtD890SentinelRegionsPlausible(snap)).not.toThrow();
  });

  it('plausibility fails when LocalInfo is all 0xff', () => {
    const snap = new Map<string, Uint8Array>();
    for (const extent of AT_D890_SENTINEL_EXTENTS) {
      const data = new Uint8Array(extent.length).fill(0xff);
      if (extent.id !== 'LocalInfo') data[0] = 0x11;
      snap.set(extent.id, data);
    }
    expect(() => assertAtD890SentinelRegionsPlausible(snap)).toThrow(
      /sentinel LocalInfo reads erased/,
    );
  });

  it('plausibility fails when OptionalSettingsAprs is all 0xff', () => {
    const snap = new Map<string, Uint8Array>();
    for (const extent of AT_D890_SENTINEL_EXTENTS) {
      const data = new Uint8Array(extent.length).fill(0xff);
      if (extent.id !== 'OptionalSettingsAprs') data[0] = 0x11;
      snap.set(extent.id, data);
    }
    expect(() => assertAtD890SentinelRegionsPlausible(snap)).toThrow(
      /sentinel OptionalSettingsAprs reads erased/,
    );
  });

  it('includes AlarmBitmap and AlarmData in sentinel set', () => {
    const ids = AT_D890_SENTINEL_EXTENTS.map((e) => e.id);
    expect(ids).toContain('AlarmBitmap');
    expect(ids).toContain('AlarmData');
    expect(ids).toContain('OptionalSettingsAprs');
  });

  it('covers alarm regions at expected addresses', () => {
    const alarmBitmap = AT_D890_SENTINEL_EXTENTS.find((e) => e.id === 'AlarmBitmap');
    const alarmData = AT_D890_SENTINEL_EXTENTS.find((e) => e.id === 'AlarmData');
    expect(alarmBitmap?.start).toBe(D890_MAP.AlarmBitmap);
    expect(alarmData?.start).toBe(D890_MAP.AlarmData);
  });
});
