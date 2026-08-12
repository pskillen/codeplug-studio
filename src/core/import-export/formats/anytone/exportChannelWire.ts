import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { channelPickForWireExport, composeChannelWireName } from '@core/domain/channelNaming.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import {
  hardTruncateUniqueWireName,
  uniqueWireName,
} from '@core/import-export/channelExpansion/shortenName.ts';
import {
  pushWireNameCollisionWarning,
  pushWireNameLengthWarning,
} from '@core/import-export/channelExpansion/wireNameWarning.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';

export interface AnytoneChannelWireOptions {
  reserved: Set<string>;
  warnings?: string[];
  /** When false, compute the wire name without reserving it (e.g. phantom site label before RX fan-out). */
  reserve?: boolean;
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
  const reserve = wireOptions.reserve !== false;

  const override = row.wireNameOverride?.trim();
  if (override) {
    const { name: truncated, collided, stem } = hardTruncateUniqueWireName(
      override,
      wireOptions.reserved,
      maxNameLength,
      reserve,
    );
    const name = sanitiseAsciiWireString(truncated);
    if (collided) {
      pushWireNameCollisionWarning(warnings, {
        entityKind: 'Channel',
        candidate: stem,
        disambiguated: name,
      });
    }
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
  const base = composeChannelWireName(pick);

  if (!shortenNames) {
    const uniquified = reserve ? uniqueWireName(base, wireOptions.reserved) : base;
    const name = sanitiseAsciiWireString(uniquified);
    if (reserve) {
      wireOptions.reserved.add(name);
      pushWireNameCollisionWarning(warnings, {
        entityKind: 'Channel',
        candidate: base,
        disambiguated: name,
      });
    }
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
    reserve,
    false,
  );
}
