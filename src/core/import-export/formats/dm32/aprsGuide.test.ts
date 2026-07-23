import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newAprsConfiguration, newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { buildDm32AprsGuide, DM32_APRS_GUIDE_FILE_NAME, DM32_APRS_GUIDE_TIP } from './aprsGuide.ts';
import { resolveDm32ExportFileNames, serialiseDm32Files } from './serialise.ts';
import { collectDm32ExportWarnings } from './warnings.ts';
import { DM32_EXPORT_FILE_NAMES } from './columns.ts';

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

describe('buildDm32AprsGuide', () => {
  it('returns null when no APRS configuration', () => {
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = emptyLibrary([dmrChannel('A')]);
    const assembled = assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' });
    expect(buildDm32AprsGuide(assembled)).toBeNull();
  });

  it('builds markdown with consensus call type and upload number', () => {
    const channel = dmrChannel('GB7GL');
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'Home APRS'),
      manualTxIntervalSec: 60,
      autoTxIntervalSec: 180,
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
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = { ...emptyLibrary([channel]), aprsConfiguration: config };
    const assembled = assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' });
    const guide = buildDm32AprsGuide(assembled)!;

    expect(guide.callType).toBe('group');
    expect(guide.uploadNumber).toBe(23551);
    expect(guide.reportChannels[0]?.wireName).toBe('GB7GL');
    expect(guide.reportChannels[1]?.wireName).toBe('Current Channel');
    expect(guide.markdown).toContain('Scheduled send time');
    expect(guide.markdown).toContain('Upload number');
    expect(guide.markdown).toContain('**Report channel 1:** GB7GL');
    expect(guide.warnings).toEqual([]);
  });

  it('warns when slots disagree on call type or upload number', () => {
    const channel = dmrChannel('A');
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'Split'),
      channelSlots: [
        {
          channelRef: { kind: 'channel' as const, id: channel.id },
          timeslot: 1 as const,
          targetDmrId: 1,
          callType: 'group' as const,
        },
        {
          channelRef: { kind: 'channel' as const, id: channel.id },
          timeslot: 2 as const,
          targetDmrId: 99,
          callType: 'private' as const,
        },
      ],
    };
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = { ...emptyLibrary([channel]), aprsConfiguration: config };
    const assembled = assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' });
    const guide = buildDm32AprsGuide(assembled)!;

    expect(guide.callType).toBe('group');
    expect(guide.uploadNumber).toBe(1);
    expect(guide.warnings.some((w) => w.includes('call type'))).toBe(true);
    expect(guide.warnings.some((w) => w.includes('upload DMR ID'))).toBe(true);
  });
});

describe('DM32 APRS.md export wiring', () => {
  it('omits APRS.md from file list without config', () => {
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = emptyLibrary([dmrChannel('A')]);
    const assembled = assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' });
    expect(resolveDm32ExportFileNames(assembled)).toEqual([...DM32_EXPORT_FILE_NAMES]);
    expect(serialiseDm32Files(assembled, library)[DM32_APRS_GUIDE_FILE_NAME]).toBeUndefined();
  });

  it('includes APRS.md when config is present and surfaces tip warning', () => {
    const channel = dmrChannel('A');
    const config = newAprsConfiguration(PROJECT_ID, 'Home');
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = { ...emptyLibrary([channel]), aprsConfiguration: config };
    const assembled = assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' });

    expect(resolveDm32ExportFileNames(assembled)).toContain(DM32_APRS_GUIDE_FILE_NAME);
    const files = serialiseDm32Files(assembled, library);
    expect(files[DM32_APRS_GUIDE_FILE_NAME]).toContain('DM-32 APRS setup');
    expect(collectDm32ExportWarnings(assembled, library)).toContain(DM32_APRS_GUIDE_TIP);
  });
});
