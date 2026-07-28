import { expect } from 'vitest';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { newChannel } from '@core/domain/factories.ts';
import { assembledChannelExportWireName } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { expandOpenGd77ChannelWireRows } from '@core/import-export/opengd77ExportModes.ts';
import { CHANNEL_COL } from '@core/import-export/formats/opengd77/columns.ts';
import { serialiseChannels } from '@core/import-export/formats/opengd77/serialise.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import {
  buildScanContext,
  resolveEffectiveScanInclusion,
  type EffectiveScanInclusion,
} from '@core/import-export/scanInclusion/index.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { Channel } from '@core/models/library.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

/** CSV and sibling radio-io (and optional NeonPlug) profile ids for one radio target. */
export type PathwayProfilePair = {
  csv: string;
  serial: string;
  neonplug?: string;
};

export type PathwayParityTarget = {
  csvFormatId: string;
  pairs: readonly PathwayProfilePair[];
};

/** Comparable facts for one canonical channel across egress pathways. */
export type PathwayChannelSnapshot = {
  wireNames: readonly string[];
  rowCount: number;
  scanInclusion?: EffectiveScanInclusion;
};

export type PathwayExtractInput = {
  channel: Channel;
  exportSettings?: BuildExportSettings;
  csvFormatId: string;
  csvProfileId: string;
  serialProfileId: string;
};

/** Pluggable CSV-leg extractor — supply per format family (#784–#786). */
export type PathwayCsvExtractor = (
  input: PathwayExtractInput & { csvOptions: CpsExportOptions },
) => PathwayChannelSnapshot;

/** Pluggable serial-leg extractor — default uses core `assembledChannelExportWireName`. */
export type PathwaySerialExtractor = (
  input: PathwayExtractInput & { serialOptions: CpsExportOptions },
) => PathwayChannelSnapshot;

/** Minimal FM channel for pathway parity fixtures. */
export function fmChannelFixture(partial: Partial<Channel> & Pick<Channel, 'name'>): Channel {
  return {
    ...newChannel('p1', partial.name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'fm' as const,
        squelch: null,
        rxTone: 'none' as const,
        txTone: 'none' as const,
        bandwidthKHz: 12.5,
      },
    ],
    ...partial,
  };
}

/** Single-channel assembled build for export-pathway unit tests. */
export function minimalAssembledBuild(
  channel: Channel,
  formatId: string,
  profileId: string,
): AssembledBuild {
  const wireName = defaultChannelWireName(channel);
  return {
    buildId: 'build-1',
    formatId,
    profileId,
    buildName: 'Parity',
    channels: [{ entity: channel, wireName }],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

export function mergePathwayCsvOptions(
  exportSettings: BuildExportSettings | undefined,
  csvFormatId: string,
  csvProfileId: string,
): CpsExportOptions {
  return mergeExportOptions(
    { exportSettings } as Parameters<typeof mergeExportOptions>[0],
    csvFormatId,
    { profileId: csvProfileId },
  );
}

export function mergePathwaySerialOptions(
  exportSettings: BuildExportSettings | undefined,
  serialProfileId: string,
): CpsExportOptions {
  return mergeExportOptions(
    { exportSettings } as Parameters<typeof mergeExportOptions>[0],
    'radio-io',
    { profileId: serialProfileId },
  );
}

/** Effective scan inclusion using the same build + format defaults as export. */
export function effectiveScanForPathway(
  channel: Channel,
  exportSettings: BuildExportSettings | undefined,
  formatId: string,
  profileId: string,
): EffectiveScanInclusion {
  const formatDefaults = getFormatExportDefaults(formatId, profileId);
  const scanContext = buildScanContext(exportSettings, formatDefaults);
  return resolveEffectiveScanInclusion(channel, scanContext);
}

/** Parse all channel wire names from an OpenGD77 Channels.csv string. */
export function wireNamesFromOpenGd77ChannelsCsv(csv: string): string[] {
  const rows = parseCsv(csv);
  const headers = rows[0]!;
  const nameIndex = headers.indexOf(CHANNEL_COL.name);
  return rows.slice(1).map((row) => row[nameIndex] ?? '');
}

/** Serial (radio-io) leg via OpenGD77 mode expansion (parity with CSV expand). */
export function opengd77SerialPathwaySnapshot(
  channel: Channel,
  serialOptions: CpsExportOptions,
  serialProfileId: string,
  exportSettings?: BuildExportSettings,
): PathwayChannelSnapshot {
  const wireName = defaultChannelWireName(channel);
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const expanded = expandOpenGd77ChannelWireRows(
    channel,
    wireName,
    serialOptions.expandModes ?? true,
    serialOptions,
    serialProfileId,
    reserved,
    warnings,
  );
  return {
    wireNames: expanded.map((row) => row.wireName),
    rowCount: expanded.length,
    scanInclusion: effectiveScanForPathway(channel, exportSettings, 'radio-io', serialProfileId),
  };
}

/** Serial (radio-io) leg via the shared core wire-name pipeline. */
export function serialPathwaySnapshot(
  channel: Channel,
  serialOptions: CpsExportOptions,
  serialProfileId: string,
  exportSettings?: BuildExportSettings,
): PathwayChannelSnapshot {
  const wireName = defaultChannelWireName(channel);
  const row = { entity: channel, wireName };
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const name = assembledChannelExportWireName(
    row,
    reserved,
    serialOptions,
    serialProfileId,
    warnings,
  );
  return {
    wireNames: [name],
    rowCount: 1,
    scanInclusion: effectiveScanForPathway(channel, exportSettings, 'radio-io', serialProfileId),
  };
}

/** OpenGD77 CSV leg: expansion rows + serialised Channels.csv names. */
export function opengd77CsvPathwaySnapshot(
  input: PathwayExtractInput & { csvOptions: CpsExportOptions },
): PathwayChannelSnapshot {
  const { channel, csvOptions, csvProfileId, exportSettings } = input;
  const wireName = defaultChannelWireName(channel);
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const expanded = expandOpenGd77ChannelWireRows(
    channel,
    wireName,
    true,
    csvOptions,
    csvProfileId,
    reserved,
    warnings,
  );
  return {
    wireNames: expanded.map((row) => row.wireName),
    rowCount: expanded.length,
    scanInclusion: effectiveScanForPathway(channel, exportSettings, 'opengd77', csvProfileId),
  };
}

/** Assert every pathway snapshot agrees on wire names and row count. */
export function assertPathwayParity(
  snapshots: Record<string, PathwayChannelSnapshot>,
  options?: { expectedFirstWireName?: string; compareScanInclusion?: boolean },
): void {
  const compareScan = options?.compareScanInclusion === true;
  const entries = Object.entries(snapshots);
  if (entries.length === 0) {
    throw new Error('assertPathwayParity: no snapshots provided');
  }
  const [baselineLabel, baseline] = entries[0]!;
  for (const [label, snapshot] of entries.slice(1)) {
    expect(snapshot.wireNames, `${label} wireNames vs ${baselineLabel}`).toEqual(
      baseline.wireNames,
    );
    expect(snapshot.rowCount, `${label} rowCount vs ${baselineLabel}`).toBe(baseline.rowCount);
    if (
      compareScan &&
      baseline.scanInclusion !== undefined &&
      snapshot.scanInclusion !== undefined
    ) {
      expect(snapshot.scanInclusion, `${label} scanInclusion vs ${baselineLabel}`).toBe(
        baseline.scanInclusion,
      );
    }
  }
  if (options?.expectedFirstWireName !== undefined) {
    expect(baseline.wireNames[0], `${baselineLabel} first wire name`).toBe(
      options.expectedFirstWireName,
    );
  }
}

/**
 * Collect CSV expand, CSV serialise, and serial-helper snapshots for one OpenGD77 profile pair.
 * Reference pattern for #784–#786 per-radio lock tests.
 */
export function collectOpenGd77PathwaySnapshots(
  channel: Channel,
  exportSettings: BuildExportSettings | undefined,
  pair: PathwayProfilePair,
): Record<string, PathwayChannelSnapshot> {
  const csvOptions = mergePathwayCsvOptions(exportSettings, 'opengd77', pair.csv);
  const serialOptions = mergePathwaySerialOptions(exportSettings, pair.serial);
  const input: PathwayExtractInput = {
    channel,
    exportSettings,
    csvFormatId: 'opengd77',
    csvProfileId: pair.csv,
    serialProfileId: pair.serial,
  };
  const csvExpand = opengd77CsvPathwaySnapshot({ ...input, csvOptions });
  const csvSerialisedNames = wireNamesFromOpenGd77ChannelsCsv(
    serialiseChannels(minimalAssembledBuild(channel, 'opengd77', pair.csv), csvOptions),
  );
  const serial = opengd77SerialPathwaySnapshot(channel, serialOptions, pair.serial, exportSettings);
  return {
    [`${pair.csv} expand`]: csvExpand,
    [`${pair.csv} Channels.csv`]: {
      wireNames: csvSerialisedNames,
      rowCount: csvSerialisedNames.length,
      scanInclusion: csvExpand.scanInclusion,
    },
    [`${pair.serial} expand`]: serial,
  };
}

/** Assert OpenGD77 CSV ↔ serial wire-name parity for every profile pair in the target. */
export function assertOpenGd77WireNameParity(
  channel: Channel,
  exportSettings: BuildExportSettings | undefined,
  expectedWireName: string,
  pairs: readonly PathwayProfilePair[],
): void {
  for (const pair of pairs) {
    const snapshots = collectOpenGd77PathwaySnapshots(channel, exportSettings, pair);
    assertPathwayParity(snapshots, { expectedFirstWireName: expectedWireName });
  }
}

/** Default OpenGD77 profile pairs exercised by wireNameParity.test.ts. */
export const OPENGD77_PATHWAY_PAIRS: readonly PathwayProfilePair[] = [
  { csv: 'opengd77-1701', serial: 'radio-io-opengd77-1701' },
  { csv: 'opengd77-md9600', serial: 'radio-io-opengd77-md9600' },
] as const;
