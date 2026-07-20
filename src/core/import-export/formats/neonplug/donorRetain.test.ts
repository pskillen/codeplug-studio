import { describe, expect, it } from 'vitest';
import {
  extractNeonplugDonorRetain,
  neonplugDonorRetainAsMergeBase,
  summariseNeonplugDonorRetain,
  summariseNeonplugRadioSettings,
} from './donorRetain.ts';
import { mergeNeonplugCodeplug } from './merge.ts';
import type { NeonplugCodeplugData } from './wireTypes.ts';

function sampleCodeplug(overrides: Partial<NeonplugCodeplugData> = {}): NeonplugCodeplugData {
  return {
    version: '1.0.0',
    exportDate: '2026-07-20T12:00:00.000Z',
    channels: [{ number: 99, name: 'Old' } as NeonplugCodeplugData['channels'][number]],
    zones: [{ id: 'z-old', name: 'OldZone', channels: [99] }],
    scanLists: [],
    contacts: [],
    rxGroups: [],
    radioIds: [
      { index: 0, dmrId: '2350001', dmrIdValue: 2350001, dmrIdBytes: [1, 0, 0], name: 'Op' },
    ],
    quickContacts: [{ index: 1, name: 'QC' }],
    messages: [{ text: 'CQ' }],
    digitalEmergencies: [{ id: 1 }],
    analogEmergencies: [{ id: 2 }],
    encryptionKeys: [{ id: 1, key: 'SECRET-DO-NOT-SHOW' }],
    digitalEmergencyConfig: { countIndex: 2 },
    radioSettings: {
      powerOnDisplayLine1: 'KEEP',
      beep: true,
      volume: 5,
      vfoA: { number: 1, name: 'nested' },
      nestedBag: { a: 1 },
    },
    radioInfo: { model: 'DP570UV', firmware: 'radio-fw', buildDate: '2024' },
    ...overrides,
  };
}

describe('neonplug/donorRetain', () => {
  it('extracts retain slices without modelled channels/zones', () => {
    const data = sampleCodeplug();
    const bag = extractNeonplugDonorRetain(data, {
      sourceFileName: 'radio.neonplug',
      capturedAt: '2026-07-20T18:00:00.000Z',
    });

    expect(bag.sourceFileName).toBe('radio.neonplug');
    expect(bag.capturedAt).toBe('2026-07-20T18:00:00.000Z');
    expect(bag.retain.radioIds).toEqual(data.radioIds);
    expect(bag.retain.radioSettings).toEqual(data.radioSettings);
    expect(bag.retain.encryptionKeys).toHaveLength(1);
    expect(bag.retain.radioInfo.model).toBe('DP570UV');
    expect('channels' in bag.retain).toBe(false);
  });

  it('rehydrates a merge base with empty modelled arrays', () => {
    const bag = extractNeonplugDonorRetain(sampleCodeplug(), {
      capturedAt: '2026-07-20T18:00:00.000Z',
    });
    const base = neonplugDonorRetainAsMergeBase(bag, '2026-07-20T19:00:00.000Z');

    expect(base.channels).toEqual([]);
    expect(base.zones).toEqual([]);
    expect(base.scanLists).toEqual([]);
    expect(base.contacts).toEqual([]);
    expect(base.rxGroups).toEqual([]);
    expect(base.radioIds).toHaveLength(1);
    expect(base.radioSettings).toEqual(bag.retain.radioSettings);
    expect(base.exportDate).toBe('2026-07-20T19:00:00.000Z');
  });

  it('merges Studio projection over a rehydrated stored donor', () => {
    const bag = extractNeonplugDonorRetain(sampleCodeplug());
    const base = neonplugDonorRetainAsMergeBase(bag);
    const projected: NeonplugCodeplugData = {
      ...sampleCodeplug({
        channels: [{ number: 1, name: 'Studio' } as NeonplugCodeplugData['channels'][number]],
        zones: [{ id: 'z-new', name: 'NewZone', channels: [1] }],
        radioIds: [],
        radioSettings: null,
        radioInfo: { model: 'DP570UV', firmware: '', buildDate: '' },
      }),
    };

    const { data } = mergeNeonplugCodeplug(base, projected, {
      exportDate: '2026-07-20T21:00:00.000Z',
      expectedRadioModel: 'DP570UV',
    });

    expect(data.channels).toEqual(projected.channels);
    expect(data.zones).toEqual(projected.zones);
    expect(data.radioIds).toEqual(bag.retain.radioIds);
    expect(data.radioSettings).toEqual(bag.retain.radioSettings);
    expect(data.encryptionKeys).toEqual(bag.retain.encryptionKeys);
  });

  it('summarises radioSettings with leaf values only', () => {
    const preview = summariseNeonplugRadioSettings({
      powerOnDisplayLine1: 'KEEP',
      beep: true,
      volume: 5,
      vfoA: { number: 1 },
      list: [1, 2],
    });
    expect(preview).toEqual({
      powerOnDisplayLine1: 'KEEP',
      beep: true,
      volume: 5,
    });
  });

  it('summarises donor for UI without exposing encryption key material', () => {
    const bag = extractNeonplugDonorRetain(sampleCodeplug(), {
      sourceFileName: 'donor.neonplug',
      capturedAt: '2026-07-20T18:00:00.000Z',
    });
    const summary = summariseNeonplugDonorRetain(bag);

    expect(summary.radioIdCount).toBe(1);
    expect(summary.radioIds[0]?.name).toBe('Op');
    expect(summary.quickContactCount).toBe(1);
    expect(summary.messageCount).toBe(1);
    expect(summary.digitalEmergencyCount).toBe(1);
    expect(summary.analogEmergencyCount).toBe(1);
    expect(summary.encryptionKeyCount).toBe(1);
    expect(summary.hasDigitalEmergencyConfig).toBe(true);
    expect(summary.hasRadioSettings).toBe(true);
    expect(summary.radioSettingsPreview.powerOnDisplayLine1).toBe('KEEP');
    expect(JSON.stringify(summary)).not.toContain('SECRET-DO-NOT-SHOW');
  });
});
