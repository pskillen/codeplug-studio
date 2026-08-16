import { getAnytoneProfile } from '@core/import-export/formats/anytone/profiles.ts';
import { getChirpProfile } from '@core/import-export/formats/chirp/profiles.ts';
import { getDm32Profile } from '@core/import-export/formats/dm32/profiles.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';
import { getNeonplugProfile } from '@core/import-export/formats/neonplug/profiles.ts';
import type { ExportWarning, ExportWarningSeverity } from '@core/import-export/exportWarning.ts';
import type { WireNameRemediation } from '@core/services/resolveWireNames.ts';

export type WireNameEntityKind =
  'Channel' | 'Talk group' | 'Zone' | 'Scan list' | 'RX group list' | 'Contact' | 'Wire name';

export function resolveProfileLabel(profileId: string | undefined): string | undefined {
  if (!profileId) return undefined;
  if (profileId.startsWith('chirp-')) return getChirpProfile(profileId).label;
  if (profileId.startsWith('dm32-')) return getDm32Profile(profileId).label;
  if (profileId.startsWith('opengd77-')) return getOpenGd77Profile(profileId).label;
  if (profileId.startsWith('anytone-')) return getAnytoneProfile(profileId).label;
  if (profileId.startsWith('neonplug-')) return getNeonplugProfile(profileId).label;
  return undefined;
}

/** Warn when uniquify appended a disambiguation suffix because the candidate was already reserved. */
export function pushWireNameCollisionWarning(
  warnings: ExportWarning[],
  params: { entityKind: WireNameEntityKind; candidate: string; disambiguated: string },
): void {
  if (params.disambiguated === params.candidate) return;
  warnings.push({
    kind: 'wire_name',
    severity: 'problem',
    remediation: 'disambiguated',
    entityKind: params.entityKind,
    original: params.candidate,
    exported: params.disambiguated,
    // Collisions are not length-driven — there is no meaningful character limit to report.
    limit: 0,
  });
}

/** Warn when a wire name exceeds the profile limit, including the export-shortened form when applicable. */
export function pushWireNameLengthWarning(
  warnings: ExportWarning[],
  params: {
    entityKind: WireNameEntityKind;
    original: string;
    exported: string;
    maxLen: number;
    profileId?: string;
    profileLabel?: string;
    shortenEnabled: boolean;
  },
): void {
  const original = params.original.trim();
  const exported = params.exported.trim();
  if (original.length <= params.maxLen) return;

  const profileLabel = params.profileLabel ?? resolveProfileLabel(params.profileId);

  let remediation: WireNameRemediation;
  let severity: ExportWarningSeverity;
  if (params.shortenEnabled && exported !== original) {
    if (exported.length <= params.maxLen) {
      remediation = 'shortened';
      severity = 'info';
    } else {
      remediation = 'truncated';
      severity = 'problem';
    }
  } else {
    remediation = 'over_limit';
    severity = 'problem';
  }

  warnings.push({
    kind: 'wire_name',
    severity,
    remediation,
    entityKind: params.entityKind,
    original,
    exported,
    limit: params.maxLen,
    profileLabel,
  });
}
