import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { buildNeonplugZip } from './packageZip.ts';
import { mergeNeonplugCodeplug, parseNeonplugCodeplugJson, parseNeonplugZip } from './merge.ts';
import { NEONPLUG_JSON_FILE_NAME } from './serialise.ts';
import type { NeonplugCodeplugData } from './wireTypes.ts';

function emptyProjection(overrides: Partial<NeonplugCodeplugData> = {}): NeonplugCodeplugData {
  return {
    version: '1.0.0',
    exportDate: '2026-07-20T12:00:00.000Z',
    channels: [],
    zones: [],
    scanLists: [],
    contacts: [],
    rxGroups: [],
    radioIds: [],
    quickContacts: [],
    messages: [],
    digitalEmergencies: [],
    analogEmergencies: [],
    encryptionKeys: [],
    digitalEmergencyConfig: null,
    radioSettings: null,
    radioInfo: { model: 'DP570UV', firmware: '', buildDate: '', vframes: {} },
    ...overrides,
  };
}

describe('neonplug/merge', () => {
  it('parses a ZIP with codeplug.json', () => {
    const body = JSON.stringify({
      version: '1.0.0',
      exportDate: '2026-01-01T00:00:00.000Z',
      channels: [{ number: 1, name: 'A' }],
      zones: [],
      scanLists: [],
      contacts: [],
      rxGroups: [],
      radioIds: [{ index: 0, dmrId: '123', dmrIdValue: 123, dmrIdBytes: [123, 0, 0], name: 'Me' }],
      quickContacts: [{ index: 1 }],
      messages: ['hi'],
      digitalEmergencies: [],
      analogEmergencies: [],
      encryptionKeys: [],
      digitalEmergencyConfig: { countIndex: 1 },
      radioSettings: { powerOnDisplayLine1: 'HELLO' },
      radioInfo: { model: 'DP570UV', firmware: '1.2' },
    });
    const zip = buildNeonplugZip({ [NEONPLUG_JSON_FILE_NAME]: body });
    const { data, warnings } = parseNeonplugZip(zip);
    expect(warnings).toEqual([]);
    expect(data.radioInfo.model).toBe('DP570UV');
    expect(data.radioSettings).toEqual({ powerOnDisplayLine1: 'HELLO' });
    expect(data.radioIds).toHaveLength(1);
    expect(data.digitalEmergencyConfig).toEqual({ countIndex: 1 });
  });

  it('rejects ZIP without codeplug.json and invalid archives', () => {
    expect(() => parseNeonplugCodeplugJson(null)).toThrow(/JSON object/);
    expect(() => parseNeonplugZip(new Uint8Array([1, 2, 3, 4]))).toThrow(/ZIP|readable/);
    const bad = zipSync({ 'other.json': strToU8('{}') });
    expect(() => parseNeonplugZip(bad)).toThrow(/codeplug\.json/);
  });

  it('merges Studio projection over donor while retaining settings and radioIds', () => {
    const base = emptyProjection({
      channels: [{ number: 99, name: 'Old' } as NeonplugCodeplugData['channels'][number]],
      zones: [{ id: 'z-old', name: 'OldZone', channels: [99] }],
      radioIds: [
        { index: 0, dmrId: '2350001', dmrIdValue: 2350001, dmrIdBytes: [1, 0, 0], name: 'Op' },
      ],
      quickContacts: [{ index: 1, name: 'QC' }],
      messages: [{ text: 'CQ' }],
      radioSettings: { powerOnDisplayLine1: 'KEEP' },
      digitalEmergencyConfig: { countIndex: 2 },
      radioInfo: { model: 'DP570UV', firmware: 'radio-fw', buildDate: '2024' },
    });
    const projected = emptyProjection({
      channels: [{ number: 1, name: 'Studio' } as NeonplugCodeplugData['channels'][number]],
      zones: [{ id: 'z-new', name: 'NewZone', channels: [1] }],
      contacts: [{ id: 1, name: 'Local', dmrId: 9 }],
      rxGroups: [
        {
          index: 0,
          name: 'RX',
          bitmask: 0,
          statusFlag: 0,
          entryFlag: 1,
          validationFlag: 0,
          talkGroupIndices: [9],
        },
      ],
      scanLists: [{ name: 'Scan', channels: [1], ctcScanMode: 0, scanTxMode: 0 }],
      radioIds: [],
      radioSettings: null,
      radioInfo: { model: 'DP570UV', firmware: '', buildDate: '' },
    });

    const { data, warnings } = mergeNeonplugCodeplug(base, projected, {
      exportDate: '2026-07-20T21:00:00.000Z',
      expectedRadioModel: 'DP570UV',
    });

    expect(warnings).toEqual([]);
    expect(data.exportDate).toBe('2026-07-20T21:00:00.000Z');
    expect(data.channels).toEqual(projected.channels);
    expect(data.zones).toEqual(projected.zones);
    expect(data.contacts).toEqual(projected.contacts);
    expect(data.rxGroups).toEqual(projected.rxGroups);
    expect(data.scanLists).toEqual(projected.scanLists);
    expect(data.radioIds).toEqual(base.radioIds);
    expect(data.quickContacts).toEqual(base.quickContacts);
    expect(data.messages).toEqual(base.messages);
    expect(data.radioSettings).toEqual({ powerOnDisplayLine1: 'KEEP' });
    expect(data.digitalEmergencyConfig).toEqual({ countIndex: 2 });
    expect(data.radioInfo.firmware).toBe('radio-fw');
  });

  it('warns when donor radioInfo.model disagrees with expected profile model', () => {
    const base = emptyProjection({
      radioInfo: { model: 'UV5R-Mini' },
    });
    const projected = emptyProjection();
    const { warnings } = mergeNeonplugCodeplug(base, projected, {
      expectedRadioModel: 'DP570UV',
    });
    expect(warnings.some((w) => /UV5R-Mini/.test(w) && /DP570UV/.test(w))).toBe(true);
  });

  it('patches donor radioSettings APRS slice while retaining unmodelled keys', () => {
    const base = emptyProjection({
      radioSettings: {
        powerOnDisplayLine1: 'KEEP',
        aprsRepeaterActiveDelay: 5,
        aprsUploadId: 1,
        aprsReportChannel1: 9,
      },
    });
    const projected = emptyProjection({
      channels: [{ number: 1, name: 'Studio' } as NeonplugCodeplugData['channels'][number]],
    });
    const { data } = mergeNeonplugCodeplug(base, projected, {
      aprsRadioSettingsPatch: {
        aprsScheduledSendTime: 6,
        aprsFixedBeacon: true,
        latitude: '55.9',
        latitudeDirection: 'N',
        longitude: '3.2',
        longitudeDirection: 'W',
        aprsReportChannel1: 4,
        aprsReportChannel2: 0,
        aprsReportChannel3: 0,
        aprsReportChannel4: 0,
        aprsReportChannel5: 0,
        aprsReportChannel6: 0,
        aprsReportChannel7: 0,
        aprsReportChannel8: 0,
        aprsCallType: true,
        aprsUploadId: 23551,
      },
    });
    expect(data.radioSettings).toEqual({
      powerOnDisplayLine1: 'KEEP',
      aprsRepeaterActiveDelay: 5,
      aprsScheduledSendTime: 6,
      aprsFixedBeacon: true,
      latitude: '55.9',
      latitudeDirection: 'N',
      longitude: '3.2',
      longitudeDirection: 'W',
      aprsReportChannel1: 4,
      aprsReportChannel2: 0,
      aprsReportChannel3: 0,
      aprsReportChannel4: 0,
      aprsReportChannel5: 0,
      aprsReportChannel6: 0,
      aprsReportChannel7: 0,
      aprsReportChannel8: 0,
      aprsCallType: true,
      aprsUploadId: 23551,
    });
  });
});
