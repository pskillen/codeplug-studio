import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { channelPickForWireExport, composeChannelWireName } from '@core/domain/channelNaming.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { formatChirpSkipColumn } from '@core/import-export/scanInclusion/wire.ts';
import {
  buildScanContext,
  resolveEffectiveScanInclusion,
  type ScanInclusionContext,
} from '@core/import-export/scanInclusion/resolve.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { getChirpProfile } from './profiles.ts';
import {
  deriveChirpDuplexAndOffset,
  formatChirpFrequencyWire,
  formatChirpModeWire,
  formatChirpPowerWireForProfile,
  formatChirpToneColumns,
  formatChirpTStepWire,
  pickChirpAnalogueProfile,
} from './channelWire.ts';

const DEFAULT_DTCS_CODE = '023';
const DEFAULT_DTCS_POLARITY = 'NN';
const DEFAULT_CROSS_MODE = 'Tone->Tone';

export interface ChirpChannelWireOptions {
  reserved: Set<string>;
  maxNameLength: number;
  shortenNames: boolean;
  nameModeOverride?: ChannelExportNameMode;
  useChannelAbbreviation?: boolean;
  warnings?: string[];
}

export function effectiveMaxNameLength(
  options: CpsExportOptions | undefined,
  profileId: string,
): number {
  if (options?.maxNameLength != null) return options.maxNameLength;
  return getChirpProfile(profileId).nameLimit;
}

function channelWireName(
  row: AssembledChannel,
  options: ChirpChannelWireOptions,
  exportOptions?: CpsExportOptions,
): string {
  const pick = channelPickForWireExport(row.entity, {
    nameModeOverride: options.nameModeOverride,
  });
  let base = row.wireNameOverride?.trim() ? row.wireName : composeChannelWireName(pick);

  const abbrev = row.entity.abbreviation?.trim();
  if (abbrev && (options.useChannelAbbreviation || exportOptions?.useChannelAbbreviation)) {
    base = composeChannelWireName({ ...pick, name: abbrev });
  }

  if (!options.shortenNames) {
    if (base.length > options.maxNameLength) {
      options.warnings?.push(`Channel name "${base}" exceeds ${options.maxNameLength} characters`);
    }
    if (!options.reserved.has(base)) {
      options.reserved.add(base);
    }
    return base;
  }

  return applyWireNameLimits(
    base,
    row.entity,
    options.reserved,
    exportOptions,
    exportOptions?.profileId,
    options.warnings ?? [],
  );
}

/** Map one assembled channel to a CHIRP CSV row (header order). */
export function channelToChirpRow(
  row: AssembledChannel,
  location: number,
  profileId: string,
  wireOptions: ChirpChannelWireOptions,
  scanContext: ScanInclusionContext,
  exportOptions?: CpsExportOptions,
): string[] {
  const channel = row.entity;
  const analogue = pickChirpAnalogueProfile(channel)!;
  const { duplex, offsetMhz } = deriveChirpDuplexAndOffset(
    channel.rxFrequency,
    channel.txFrequency,
    channel.forbidTransmit,
  );
  const tones = formatChirpToneColumns(analogue.rxTone, analogue.txTone);
  const skip = formatChirpSkipColumn(resolveEffectiveScanInclusion(channel, scanContext));

  return [
    String(location),
    channelWireName(row, wireOptions, exportOptions),
    formatChirpFrequencyWire(channel.rxFrequency),
    duplex,
    offsetMhz.toFixed(6),
    tones.tone,
    tones.rToneFreq,
    tones.cToneFreq,
    DEFAULT_DTCS_CODE,
    DEFAULT_DTCS_POLARITY,
    DEFAULT_DTCS_CODE,
    DEFAULT_CROSS_MODE,
    formatChirpModeWire(analogue.mode, analogue.bandwidthKHz),
    formatChirpTStepWire(),
    skip,
    formatChirpPowerWireForProfile(channel.power, profileId),
    '',
    '',
    '',
    '',
    '',
  ];
}

export function buildChirpScanContext(exportOptions?: CpsExportOptions): ScanInclusionContext {
  return buildScanContext(
    exportOptions?.defaultScanInclusion
      ? { defaultScanInclusion: exportOptions.defaultScanInclusion }
      : undefined,
    { defaultScanInclusion: 'skip' },
  );
}
