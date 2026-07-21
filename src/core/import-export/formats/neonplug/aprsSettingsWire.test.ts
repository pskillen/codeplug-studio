import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newAprsConfiguration, newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import {
  applyNeonplugAprsRadioSettingsPatch,
  buildNeonplugAprsRadioSettingsPatch,
  encodeNeonplugAprsScheduledSendTime,
  formatNeonplugCoordinateAscii,
  formatNeonplugFixedLocation,
  neonplugGpsModeForPositionSource,
  resolveNeonplugAprsReportChannelNumber,
  resolveNeonplugAprsScheduledSendTime,
} from './aprsSettingsWire.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function dmrChannel(name: string): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: 1_234_567,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

function emptyLibrary(channels: Channel[] = []): LibrarySlice {
  return {
    channels,
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
    aprsConfiguration: null,
  };
}

describe('encodeNeonplugAprsScheduledSendTime', () => {
  it('maps unset / zero to Off', () => {
    expect(encodeNeonplugAprsScheduledSendTime(null)).toBe(0);
    expect(encodeNeonplugAprsScheduledSendTime(undefined)).toBe(0);
    expect(encodeNeonplugAprsScheduledSendTime(0)).toBe(0);
    expect(encodeNeonplugAprsScheduledSendTime(-10)).toBe(0);
  });

  it('rounds seconds to 30s combo idx and clamps', () => {
    expect(encodeNeonplugAprsScheduledSendTime(30)).toBe(1);
    expect(encodeNeonplugAprsScheduledSendTime(45)).toBe(2);
    expect(encodeNeonplugAprsScheduledSendTime(180)).toBe(6);
    expect(encodeNeonplugAprsScheduledSendTime(7200)).toBe(240);
    expect(encodeNeonplugAprsScheduledSendTime(9000)).toBe(240);
    expect(encodeNeonplugAprsScheduledSendTime(1)).toBe(1);
  });
});

describe('resolveNeonplugAprsScheduledSendTime', () => {
  it('prefers auto over manual', () => {
    const warnings: string[] = [];
    expect(
      resolveNeonplugAprsScheduledSendTime(
        { manualTxIntervalSec: 60, autoTxIntervalSec: 180 },
        warnings,
      ),
    ).toBe(6);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/using auto/i);
  });

  it('uses manual when auto unset', () => {
    expect(
      resolveNeonplugAprsScheduledSendTime(
        { manualTxIntervalSec: 60, autoTxIntervalSec: null },
        [],
      ),
    ).toBe(2);
  });

  it('does not warn when both snap to the same idx', () => {
    const warnings: string[] = [];
    expect(
      resolveNeonplugAprsScheduledSendTime(
        { manualTxIntervalSec: 180, autoTxIntervalSec: 180 },
        warnings,
      ),
    ).toBe(6);
    expect(warnings).toEqual([]);
  });
});

describe('formatNeonplugCoordinateAscii', () => {
  it('fits within 9 characters', () => {
    expect(formatNeonplugCoordinateAscii(45.123456789).length).toBeLessThanOrEqual(9);
    expect(formatNeonplugCoordinateAscii(123.123456).length).toBeLessThanOrEqual(9);
    expect(formatNeonplugCoordinateAscii(-55.9533)).toBe(formatNeonplugCoordinateAscii(55.9533));
  });
});

describe('formatNeonplugFixedLocation', () => {
  it('maps hemisphere from signed degrees', () => {
    expect(formatNeonplugFixedLocation({ lat: 55.9, lon: -3.2 })).toEqual({
      latitude: formatNeonplugCoordinateAscii(55.9),
      latitudeDirection: 'N',
      longitude: formatNeonplugCoordinateAscii(3.2),
      longitudeDirection: 'W',
    });
    expect(formatNeonplugFixedLocation({ lat: -33.9, lon: 151.2 }).latitudeDirection).toBe('S');
    expect(formatNeonplugFixedLocation({ lat: -33.9, lon: 151.2 }).longitudeDirection).toBe('E');
  });
});

describe('neonplugGpsModeForPositionSource', () => {
  it('maps GNSS sources and warns for galileo', () => {
    expect(neonplugGpsModeForPositionSource('fixed', [])).toBeUndefined();
    expect(neonplugGpsModeForPositionSource('gps', [])).toBe(0);
    expect(neonplugGpsModeForPositionSource('beidou', [])).toBe(1);
    expect(neonplugGpsModeForPositionSource('allGnss', [])).toBe(2);
    const warnings: string[] = [];
    expect(neonplugGpsModeForPositionSource('galileo', warnings)).toBe(2);
    expect(warnings[0]).toMatch(/galileo/i);
  });
});

describe('resolveNeonplugAprsReportChannelNumber', () => {
  it('returns 0 for null channelRef (current channel)', () => {
    expect(
      resolveNeonplugAprsReportChannelNumber(
        { channelRef: null, timeslot: null, targetDmrId: null, callType: 'private' },
        new Map(),
        [],
        1,
      ),
    ).toBe(0);
  });

  it('uses first expanded number and warns on multi-row', () => {
    const warnings: string[] = [];
    const id = 'ch-1';
    expect(
      resolveNeonplugAprsReportChannelNumber(
        {
          channelRef: { kind: 'channel', id },
          timeslot: 1,
          targetDmrId: 1,
          callType: 'group',
        },
        new Map([[id, [7, 8, 9]]]),
        warnings,
        2,
      ),
    ).toBe(7);
    expect(warnings[0]).toMatch(/expanded to 3/);
  });

  it('warns and uses 0 when channel missing from export', () => {
    const warnings: string[] = [];
    expect(
      resolveNeonplugAprsReportChannelNumber(
        {
          channelRef: { kind: 'channel', id: 'missing' },
          timeslot: null,
          targetDmrId: null,
          callType: 'private',
        },
        new Map(),
        warnings,
        3,
      ),
    ).toBe(0);
    expect(warnings[0]).toMatch(/not in this NeonPlug export/);
  });
});

describe('buildNeonplugAprsRadioSettingsPatch', () => {
  it('returns null patch when no APRS configuration', () => {
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
    const assembled = assemble(build, emptyLibrary([dmrChannel('A')]));
    expect(buildNeonplugAprsRadioSettingsPatch(assembled, new Map())).toEqual({
      patch: null,
      warnings: [],
    });
  });

  it('maps slots, consensus call/upload, auto interval, and fixed beacon', () => {
    const channel = dmrChannel('GB7GL');
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'Home APRS'),
      manualTxIntervalSec: 60,
      autoTxIntervalSec: 180,
      positionSource: 'fixed' as const,
      fixedLocation: { lat: 55.9533, lon: -3.1883 },
      channelSlots: [
        {
          channelRef: { kind: 'channel' as const, id: channel.id },
          timeslot: 1 as const,
          targetDmrId: 23551,
          callType: 'group' as const,
        },
        {
          channelRef: null,
          timeslot: 2 as const,
          targetDmrId: 23551,
          callType: 'group' as const,
        },
      ],
    };
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
    const assembled = assemble(build, { ...emptyLibrary([channel]), aprsConfiguration: config });
    const numbers = new Map([[channel.id, [4]]]);
    const { patch, warnings } = buildNeonplugAprsRadioSettingsPatch(assembled, numbers);

    expect(patch).toMatchObject({
      aprsScheduledSendTime: 6,
      aprsFixedBeacon: true,
      latitudeDirection: 'N',
      longitudeDirection: 'W',
      aprsReportChannel1: 4,
      aprsReportChannel2: 0,
      aprsReportChannel3: 0,
      aprsCallType: true,
      aprsUploadId: 23551,
    });
    expect(patch?.latitude).toBe(formatNeonplugCoordinateAscii(55.9533));
    expect(patch?.longitude).toBe(formatNeonplugCoordinateAscii(3.1883));
    expect(warnings.some((w) => /using auto/i.test(w))).toBe(true);
  });

  it('sets gpsEnabled/gpsMode for GNSS position source', () => {
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'GPS APRS'),
      positionSource: 'gps' as const,
      fixedLocation: null,
      channelSlots: [],
    };
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
    const assembled = assemble(build, { ...emptyLibrary(), aprsConfiguration: config });
    const { patch } = buildNeonplugAprsRadioSettingsPatch(assembled, new Map());
    expect(patch).toMatchObject({
      aprsFixedBeacon: false,
      gpsEnabled: true,
      gpsMode: 0,
    });
  });

  it('warns when slots disagree on call type / upload', () => {
    const channel = dmrChannel('A');
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'Split'),
      channelSlots: [
        {
          channelRef: { kind: 'channel' as const, id: channel.id },
          timeslot: 1 as const,
          targetDmrId: 100,
          callType: 'group' as const,
        },
        {
          channelRef: null,
          timeslot: 1 as const,
          targetDmrId: 200,
          callType: 'private' as const,
        },
      ],
    };
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
    const assembled = assemble(build, { ...emptyLibrary([channel]), aprsConfiguration: config });
    const { patch, warnings } = buildNeonplugAprsRadioSettingsPatch(
      assembled,
      new Map([[channel.id, [1]]]),
    );
    expect(patch?.aprsCallType).toBe(true);
    expect(patch?.aprsUploadId).toBe(100);
    expect(warnings.some((w) => /call type/i.test(w))).toBe(true);
    expect(warnings.some((w) => /upload DMR ID/i.test(w))).toBe(true);
  });
});

describe('applyNeonplugAprsRadioSettingsPatch', () => {
  it('returns null when donor is null (greenfield)', () => {
    expect(
      applyNeonplugAprsRadioSettingsPatch(null, {
        aprsScheduledSendTime: 6,
        aprsFixedBeacon: false,
        latitude: '0',
        latitudeDirection: 'N',
        longitude: '0',
        longitudeDirection: 'E',
        aprsReportChannel1: 1,
        aprsReportChannel2: 0,
        aprsReportChannel3: 0,
        aprsReportChannel4: 0,
        aprsReportChannel5: 0,
        aprsReportChannel6: 0,
        aprsReportChannel7: 0,
        aprsReportChannel8: 0,
        aprsCallType: false,
        aprsUploadId: 0,
      }),
    ).toBeNull();
  });

  it('returns donor unchanged when patch is null', () => {
    const donor = { powerOnDisplayLine1: 'KEEP', aprsUploadId: 99 };
    expect(applyNeonplugAprsRadioSettingsPatch(donor, null)).toEqual(donor);
  });

  it('shallow-merges APRS keys and retains unmodelled donor fields', () => {
    const donor = {
      powerOnDisplayLine1: 'KEEP',
      aprsRepeaterActiveDelay: 5,
      aprsUploadId: 1,
      aprsReportChannel1: 9,
    };
    const result = applyNeonplugAprsRadioSettingsPatch(donor, {
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
    }) as Record<string, unknown>;

    expect(result.powerOnDisplayLine1).toBe('KEEP');
    expect(result.aprsRepeaterActiveDelay).toBe(5);
    expect(result.aprsUploadId).toBe(23551);
    expect(result.aprsReportChannel1).toBe(4);
    expect(result.aprsScheduledSendTime).toBe(6);
  });
});
