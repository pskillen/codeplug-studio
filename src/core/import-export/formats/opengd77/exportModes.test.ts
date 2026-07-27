import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import {
  filterOpenGd77ExportChannel,
  isOpenGd77ExportableMode,
  openGd77DroppedModesWarning,
  openGd77OmittedChannelWarning,
} from './exportModes.ts';

describe('OpenGD77 exportModes', () => {
  it('accepts analogue and DMR only', () => {
    expect(isOpenGd77ExportableMode('fm')).toBe(true);
    expect(isOpenGd77ExportableMode('am')).toBe(true);
    expect(isOpenGd77ExportableMode('ssb')).toBe(true);
    expect(isOpenGd77ExportableMode('dmr')).toBe(true);
    expect(isOpenGd77ExportableMode('ysf')).toBe(false);
    expect(isOpenGd77ExportableMode('dstar')).toBe(false);
    expect(isOpenGd77ExportableMode('p25')).toBe(false);
  });

  it('filters non-DMR digital profiles and warns', () => {
    const channel = {
      ...newChannel('p1', 'Repeater'),
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none' as const, txTone: 'none' as const, bandwidthKHz: null },
        { mode: 'dmr' as const, colourCode: 1, timeslot: 1 as const, dmrId: 1, contactRef: null, rxGroupListId: null },
        { mode: 'ysf' as const, dgId: null, wiresDtmfId: '' },
      ],
    };
    const warnings: string[] = [];
    const filtered = filterOpenGd77ExportChannel(channel, warnings);
    expect(filtered?.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr']);
    expect(warnings).toEqual([openGd77DroppedModesWarning('Repeater', ['ysf'])]);
  });

  it('omits YSF-only channels with warning', () => {
    const channel = {
      ...newChannel('p1', 'Fusion only'),
      modeProfiles: [{ mode: 'ysf' as const, dgId: null, wiresDtmfId: '' }],
    };
    const warnings: string[] = [];
    expect(filterOpenGd77ExportChannel(channel, warnings)).toBeNull();
    expect(warnings).toEqual([
      openGd77DroppedModesWarning('Fusion only', ['ysf']),
      openGd77OmittedChannelWarning('Fusion only'),
    ]);
  });
});
