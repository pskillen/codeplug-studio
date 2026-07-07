import { DEFAULT_CHIRP_PROFILE_ID, getChirpProfile } from './profiles.ts';
import { serialiseChirpCsv } from './serialise.ts';

export const chirpExportAdapter = {
  id: 'chirp' as const,
  label: 'CHIRP CSV',
  status: 'shipped' as const,
  delivery: 'single-file-cps' as const,
  defaultExportSettings: {
    defaultScanInclusion: 'skip' as const,
    expandModes: false,
    expandRxGroupLists: false,
  },
  defaultFileName(profileId: string) {
    return getChirpProfile(profileId).defaultFileName;
  },
  serialise(assembled, options) {
    const result = serialiseChirpCsv(assembled, options);
    return { content: result.csv, warnings: result.warnings };
  },
} satisfies import('../../exportAdapter.ts').SingleFileCpsExportAdapter;

export { DEFAULT_CHIRP_PROFILE_ID };
