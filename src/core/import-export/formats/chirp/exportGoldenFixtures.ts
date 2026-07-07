import { parseCsv } from '@core/import-export/csvParse.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel, ChannelModeProfileAnalog } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { CHIRP_COL } from './columns.ts';
import {
  parseChirpDuplex,
  parseChirpFrequencyWire,
  parseChirpModeWire,
  parseChirpOffsetMhz,
  parseChirpPowerWire,
  parseChirpTones,
  scanInclusionFromChirpSkipColumn,
} from './channelWire.ts';

const GOLDEN_PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function colIndex(headers: string[], name: string): number {
  return headers.indexOf(name);
}

function cell(row: string[], index: number): string {
  return index >= 0 && index < row.length ? (row[index] ?? '').trim() : '';
}

/** Parse committed CHIRP export fixtures into library channels + flat-memory build (test harness). */
export function libraryAndBuildFromChirpFixture(
  csv: string,
  profileId: string,
): { library: LibrarySlice; build: FormatBuild } {
  const rows = parseCsv(csv.replace(/^\uFEFF/, '').trim());
  if (!rows.length) throw new Error('Empty CHIRP fixture CSV');

  const headers = rows[0]!.map((header) => header.trim());
  const nameIdx = colIndex(headers, CHIRP_COL.Name);
  if (nameIdx < 0) throw new Error('Missing Name column');

  const idx = {
    frequency: colIndex(headers, CHIRP_COL.Frequency),
    duplex: colIndex(headers, CHIRP_COL.Duplex),
    offset: colIndex(headers, CHIRP_COL.Offset),
    tone: colIndex(headers, CHIRP_COL.Tone),
    rToneFreq: colIndex(headers, CHIRP_COL.rToneFreq),
    cToneFreq: colIndex(headers, CHIRP_COL.cToneFreq),
    mode: colIndex(headers, CHIRP_COL.Mode),
    skip: colIndex(headers, CHIRP_COL.Skip),
    power: colIndex(headers, CHIRP_COL.Power),
  };

  const channels: Channel[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const name = cell(row, nameIdx);
    if (!name) continue;

    const rxFrequency = parseChirpFrequencyWire(cell(row, idx.frequency));
    const duplexWire = cell(row, idx.duplex);
    const offsetMhz = parseChirpOffsetMhz(cell(row, idx.offset));
    const { txFrequency, forbidTransmit } = parseChirpDuplex(duplexWire, rxFrequency, offsetMhz);
    const tones = parseChirpTones(
      cell(row, idx.tone),
      cell(row, idx.rToneFreq),
      cell(row, idx.cToneFreq),
    );
    const { mode, bandwidthKHz } = parseChirpModeWire(cell(row, idx.mode));
    if (mode === 'other') continue;

    const modeProfile: ChannelModeProfileAnalog = {
      mode,
      rxTone: tones.rxTone,
      txTone: tones.txTone,
      squelch: null,
      bandwidthKHz,
    };

    channels.push({
      id: `chirp-golden-${rowIndex}`,
      projectId: GOLDEN_PROJECT_ID,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name,
      callsign: '',
      rxFrequency,
      txFrequency,
      location: null,
      useLocation: false,
      maidenheadLocator: null,
      power: parseChirpPowerWire(cell(row, idx.power), profileId),
      scanInclusion: scanInclusionFromChirpSkipColumn(cell(row, idx.skip)),
      forbidTransmit,
      comment: '',
      modeProfiles: [modeProfile],
    });
  }

  const channelIds = channels.map((channel) => channel.id);
  const build: FormatBuild = {
    id: 'build-chirp-golden',
    projectId: GOLDEN_PROJECT_ID,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'CHIRP golden export',
    formatId: 'chirp',
    profileId,
    layout: { sections: [] },
    channelOverrides: channelIds.map((libraryEntityId, index) => ({
      libraryEntityId,
      orderOrSlot: index + 1,
    })),
    zoneOverrides: [],
    talkGroupOverrides: [],
    rxGroupListOverrides: [],
    contactOverrides: [],
    exportSettings: { shortenNames: false },
  };

  return {
    library: {
      channels,
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    },
    build,
  };
}
