import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { exportChannelEligibilityWarnings } from './assemble.ts';

describe('exportChannelEligibilityWarnings', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const emptyLibrary = {
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };

  it('warns when AM channels are skipped on RT95', () => {
    const air = newChannel(projectId, 'Tower');
    air.rxFrequency = 118_800_000;
    air.modeProfiles = [
      {
        mode: 'am',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: null,
        analogSquelchMode: 'default',
      },
    ];
    const build = newFormatBuild(projectId, 'chirp-rt95');
    const warnings = exportChannelEligibilityWarnings(build, {
      ...emptyLibrary,
      channels: [air],
    });
    expect(warnings.some((w) => formatExportWarning(w).includes('unsupported mode'))).toBe(true);
    expect(warnings.some((w) => formatExportWarning(w).includes('Tower'))).toBe(true);
  });
});
