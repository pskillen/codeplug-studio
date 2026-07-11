import { getAnytoneProfile } from '@core/import-export/formats/anytone/profiles.ts';
import { getChirpProfile } from '@core/import-export/formats/chirp/profiles.ts';
import { getDm32Profile } from '@core/import-export/formats/dm32/profiles.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';

export type WireNameEntityKind =
  'Channel' | 'Talk group' | 'Zone' | 'Scan list' | 'RX group list' | 'Contact' | 'Wire name';

export function resolveProfileLabel(profileId: string | undefined): string | undefined {
  if (!profileId) return undefined;
  if (profileId.startsWith('chirp-')) return getChirpProfile(profileId).label;
  if (profileId.startsWith('dm32-')) return getDm32Profile(profileId).label;
  if (profileId.startsWith('opengd77-')) return getOpenGd77Profile(profileId).label;
  if (profileId.startsWith('anytone-')) return getAnytoneProfile(profileId).label;
  return undefined;
}

/** Warn when a wire name exceeds the profile limit, including the export-shortened form when applicable. */
export function pushWireNameLengthWarning(
  warnings: string[],
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
  const profileSuffix = profileLabel ? ` for ${profileLabel}` : '';

  if (params.shortenEnabled && exported !== original) {
    if (exported.length <= params.maxLen) {
      warnings.push(
        `${params.entityKind} wire name "${original}" exceeds ${params.maxLen} characters${profileSuffix}; exported as "${exported}"`,
      );
      return;
    }
    warnings.push(
      `${params.entityKind} wire name "${original}" exceeds ${params.maxLen} characters${profileSuffix}; shortened to "${exported}" still exceeds limit`,
    );
    return;
  }

  warnings.push(
    `${params.entityKind} wire name "${original}" exceeds ${params.maxLen} characters${profileSuffix}`,
  );
}
