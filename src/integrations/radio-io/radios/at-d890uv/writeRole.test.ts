import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import {
  radioIdAddress,
  receiveGroupAddress,
  talkgroupAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from './memory.ts';
import { atD890RegionLabel, atD890WriteRole } from './writeRole.ts';

describe('atD890RegionLabel / atD890WriteRole', () => {
  it('labels LocalInfo as kept', () => {
    expect(atD890RegionLabel(D890_MAP.LocalInfo)).toBe('Local info');
    expect(atD890WriteRole(D890_MAP.LocalInfo)).toBe('kept');
  });

  it('classifies zone names despite ZonesName > ZoneAChannel (non-monotonic map)', () => {
    const addr = zoneNameAddress(0);
    expect(addr).toBe(D890_MAP.ZonesName);
    expect(addr).toBeGreaterThan(D890_MAP.ZoneAChannel);
    expect(atD890RegionLabel(addr)).toBe('Zone names');
    expect(atD890WriteRole(addr)).toBe('replaced');
    expect(atD890RegionLabel(zoneNameAddress(12))).toBe('Zone names');
    expect(atD890WriteRole(zoneNameAddress(12))).toBe('replaced');
  });

  it('classifies zone membership', () => {
    expect(atD890RegionLabel(zoneChannelsAddress(3))).toBe('Zone membership');
    expect(atD890WriteRole(zoneChannelsAddress(3))).toBe('replaced');
  });

  it('classifies talk groups despite TalkgroupData > ReceiveGroupSet', () => {
    const addr = talkgroupAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.ReceiveGroupSet);
    expect(atD890RegionLabel(addr)).toBe('Talk groups');
    expect(atD890WriteRole(addr)).toBe('replaced');
    expect(talkgroupAddress(1)).toBe(D890_MAP.TalkgroupData + 0xc8);
    expect(atD890RegionLabel(talkgroupAddress(9))).toBe('Talk groups');
  });

  it('classifies RX groups despite ReceiveGroupData > MasterIdData', () => {
    const addr = receiveGroupAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.MasterIdData);
    expect(atD890RegionLabel(addr)).toBe('RX group lists');
    expect(atD890WriteRole(addr)).toBe('replaced');
  });

  it('classifies operator radio IDs despite RadioIdData > ScanListData', () => {
    const addr = radioIdAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.ScanListData);
    expect(atD890RegionLabel(addr)).toBe('Operator radio IDs');
    expect(atD890WriteRole(addr)).toBe('replaced');
  });

  it('keeps unknown addresses as other retained', () => {
    // TalkgroupOrder — documented but not modelled / not in v1 download path.
    expect(atD890RegionLabel(D890_MAP.TalkgroupOrder)).toBe('Other retained region');
    expect(atD890WriteRole(D890_MAP.TalkgroupOrder)).toBe('kept');
  });
});
