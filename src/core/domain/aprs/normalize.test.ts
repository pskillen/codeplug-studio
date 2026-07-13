import { describe, expect, it } from 'vitest';
import { normalizeAprsConfiguration, normalizeChannelAprsBinding } from './normalize.ts';

describe('normalizeChannelAprsBinding', () => {
  it('maps wire Analog report type to off with warning', () => {
    const warnings: import('./normalize.ts').AprsNormalizeWarning[] = [];
    const result = normalizeChannelAprsBinding(
      {
        receiveEnabled: true,
        reportType: 'analog' as never,
        digitalPttMode: 'on',
        reportChannelRef: null,
      },
      warnings,
    );
    expect(result?.reportType).toBe('off');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('analog_report_type_mapped_off');
  });

  it('returns undefined for all-off binding', () => {
    expect(
      normalizeChannelAprsBinding({
        receiveEnabled: false,
        reportType: 'off',
        digitalPttMode: 'off',
        reportChannelRef: null,
      }),
    ).toBeUndefined();
  });
});

describe('normalizeAprsConfiguration', () => {
  it('trims name and normalizes DMR ids', () => {
    const config = normalizeAprsConfiguration({
      id: 'cfg-1',
      projectId: 'p1',
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: '  Home  ',
      comment: ' note ',
      manualTxIntervalSec: 120,
      autoTxIntervalSec: null,
      positionSource: 'gps',
      fixedLocation: null,
      channelSlots: [
        {
          channelRef: { kind: 'channel', id: 'ch-1' },
          timeslot: 1,
          targetDmrId: 234999,
          callType: 'group',
        },
      ],
      defaultDmrId: -1,
      defaultCallType: 'group',
    });
    expect(config.name).toBe('Home');
    expect(config.comment).toBe('note');
    expect(config.defaultDmrId).toBeNull();
    expect(config.channelSlots[0]?.targetDmrId).toBe(234999);
  });

  it('accepts extended position sources', () => {
    for (const positionSource of ['beidou', 'galileo', 'allGnss'] as const) {
      const config = normalizeAprsConfiguration({
        id: 'cfg-1',
        projectId: 'p1',
        revision: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        name: 'Test',
        comment: '',
        manualTxIntervalSec: null,
        autoTxIntervalSec: null,
        positionSource,
        fixedLocation: null,
        channelSlots: [],
        defaultDmrId: null,
        defaultCallType: 'group',
      });
      expect(config.positionSource).toBe(positionSource);
    }
  });
});
