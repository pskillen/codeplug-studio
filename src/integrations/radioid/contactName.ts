import type { RadioidDmrUserListing } from './types.ts';

/** How RadioID.net listing fields map to library `DigitalContact.name` on import/update. */
export type RadioidContactNameMode = 'name' | 'callsign' | 'callsign-name';

export const DEFAULT_RADIOID_CONTACT_NAME_MODE: RadioidContactNameMode = 'name';

const MODE_LABELS: Record<RadioidContactNameMode, string> = {
  name: 'Name',
  callsign: 'Callsign',
  'callsign-name': 'Callsign + name',
};

export function radioidContactNameModeLabel(mode: RadioidContactNameMode): string {
  return MODE_LABELS[mode];
}

export const RADIOID_CONTACT_NAME_MODES: readonly RadioidContactNameMode[] = [
  'callsign-name',
  'name',
  'callsign',
];

export function isRadioidContactNameMode(value: string): value is RadioidContactNameMode {
  return (RADIOID_CONTACT_NAME_MODES as readonly string[]).includes(value);
}

/** Resolve library display `name` from a RadioID.net listing using the chosen import mode. */
export function radioidListingImportName(
  listing: RadioidDmrUserListing,
  mode: RadioidContactNameMode = DEFAULT_RADIOID_CONTACT_NAME_MODE,
): string {
  const callsign = listing.callsign.trim();
  const wireName = listing.name.trim();

  switch (mode) {
    case 'name':
      return wireName || callsign || 'Untitled contact';
    case 'callsign':
      return callsign || wireName || 'Untitled contact';
    case 'callsign-name':
      if (callsign && wireName) return `${callsign} ${wireName}`;
      return callsign || wireName || 'Untitled contact';
  }
}
