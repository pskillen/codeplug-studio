import {
  newAprsConfiguration,
  newChannel,
  newFormatBuild,
  newScanList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

export const ANYTONE_GOLDEN_PROJECT_ID = '11111111-1111-4111-8111-111111111111';

export const ANYTONE_GOLDEN_SCAN_LIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Minimal library + build for directional export golden tests. */
export function minimalAnytoneExportLibrary(): LibrarySlice {
  const tg = newTalkGroup(ANYTONE_GOLDEN_PROJECT_ID, 'TG Alpha', 2355);
  const ch1 = {
    ...newChannel(ANYTONE_GOLDEN_PROJECT_ID, 'Channel 1'),
    scanListId: ANYTONE_GOLDEN_SCAN_LIST_ID,
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    power: 25,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2 as const,
        dmrId: 1_234_567,
        contactRef: { kind: 'talkGroup' as const, id: tg.id },
        rxGroupListId: null,
      },
    ],
  };
  const ch2 = {
    ...newChannel(ANYTONE_GOLDEN_PROJECT_ID, 'Channel 2'),
    rxFrequency: 155_000_000,
    txFrequency: 155_000_000,
    power: 5,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 1 as const,
        dmrId: 1_234_567,
        contactRef: { kind: 'talkGroup' as const, id: tg.id },
        rxGroupListId: null,
      },
    ],
  };
  const zone = {
    ...newZone(ANYTONE_GOLDEN_PROJECT_ID, 'Zone A'),
    members: [
      { kind: 'channel' as const, channelId: ch1.id },
      { kind: 'channel' as const, channelId: ch2.id },
    ],
  };
  const scanList = {
    ...newScanList(ANYTONE_GOLDEN_PROJECT_ID, 'Zone A SCL'),
    id: ANYTONE_GOLDEN_SCAN_LIST_ID,
    memberChannelIds: [ch1.id, ch2.id],
  };

  return {
    channels: [ch1, ch2],
    zones: [zone],
    talkGroups: [tg],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [scanList],
  };
}

export function minimalAnytoneExportBuild(library: LibrarySlice): FormatBuild {
  const zone = library.zones[0]!;
  const ch1 = library.channels[0]!;
  const ch2 = library.channels[1]!;

  return {
    ...newFormatBuild(ANYTONE_GOLDEN_PROJECT_ID, 'anytone-at-d890uv', 'Golden export'),
    layout: {
      sections: [
        {
          kind: 'zoneGrouping',
          zones: [{ id: zone.id, name: zone.name, channelIds: [ch1.id, ch2.id] }],
        },
      ],
    },
    zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone A' }],
  };
}

/** Library + APRS config for directional APRS.CSV golden tests. */
export function aprsEnabledAnytoneExportLibrary(): LibrarySlice {
  const base = minimalAnytoneExportLibrary();
  const ch1 = base.channels[0]!;
  const aprsConfiguration = {
    ...newAprsConfiguration(ANYTONE_GOLDEN_PROJECT_ID, 'Golden APRS'),
    manualTxIntervalSec: 0,
    autoTxIntervalSec: 9,
    positionSource: 'allGnss' as const,
    fixedLocation: null,
    channelSlots: [
      {
        channelRef: { kind: 'channel' as const, id: ch1.id },
        timeslot: 2 as const,
        targetDmrId: 2355,
        callType: 'group' as const,
      },
    ],
  };
  const ch1WithAprs = {
    ...ch1,
    aprs: {
      receiveEnabled: true,
      reportType: 'digital' as const,
      digitalPttMode: 'on' as const,
      reportSlotIndex: 1,
    },
  };

  return {
    ...base,
    channels: [ch1WithAprs, base.channels[1]!],
    aprsConfiguration,
  };
}
