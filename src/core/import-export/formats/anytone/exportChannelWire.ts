import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { channelPickForWireExport, composeChannelWireName } from '@core/domain/channelNaming.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { pushWireNameLengthWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { uniqueWireName } from '@core/import-export/channelExpansion/shortenName.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';

export interface AnytoneChannelWireOptions {
  reserved: Set<string>;
  warnings?: string[];
}

export function effectiveAnytoneMaxNameLength(
  options: CpsExportOptions | undefined,
  profileId: string,
): number {
  if (options?.maxNameLength != null) return options.maxNameLength;
  return getAnytoneProfile(profileId).nameLimit;
}

/** CPS wire name for Channel.CSV — mirrors previewGeneratedChannelWireName / CHIRP export path. */
export function anytoneChannelWireName(
  row: AssembledChannel,
  wireOptions: AnytoneChannelWireOptions,
  exportOptions?: CpsExportOptions,
  profileId: string = DEFAULT_ANYTONE_PROFILE_ID,
): string {
  const resolvedProfileId = exportOptions?.profileId ?? profileId;
  const maxNameLength = effectiveAnytoneMaxNameLength(exportOptions, resolvedProfileId);
  const shortenNames = exportOptions?.shortenNames !== false;
  const warnings = wireOptions.warnings ?? [];

  const override = row.wireNameOverride?.trim();
  if (override) {
    const name = sanitiseAsciiWireString(uniqueWireName(override, wireOptions.reserved));
    wireOptions.reserved.add(name);
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original: override,
      exported: name,
      maxLen: maxNameLength,
      profileId: resolvedProfileId,
      shortenEnabled: false,
    });
    return name;
  }

  const pick = channelPickForWireExport(row.entity, {
    nameModeOverride: exportOptions?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  let base = composeChannelWireName(pick);
  const abbrev = row.entity.abbreviation?.trim();
  if (abbrev && exportOptions?.useChannelAbbreviation !== false) {
    base = composeChannelWireName({ ...pick, name: abbrev });
  }

  if (!shortenNames) {
    const name = sanitiseAsciiWireString(uniqueWireName(base, wireOptions.reserved));
    wireOptions.reserved.add(name);
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original: base,
      exported: name,
      maxLen: maxNameLength,
      profileId: resolvedProfileId,
      shortenEnabled: false,
    });
    return name;
  }

  return applyWireNameLimits(
    base,
    row.entity,
    wireOptions.reserved,
    exportOptions,
    resolvedProfileId,
    warnings,
  );
}
