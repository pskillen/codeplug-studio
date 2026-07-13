import { describe, expect, it } from 'vitest';
import { emptyLibrary, newAprsConfiguration, newChannel } from '../factories.ts';
import {
  collectAprsValidationWarnings,
  validateAprsConfigurationName,
  validateChannelAprsBinding,
} from './validation.ts';

describe('validateAprsConfigurationName', () => {
  it('rejects empty names', () => {
    const config = { ...newAprsConfiguration('p1', ''), name: '   ' };
    expect(() => validateAprsConfigurationName(config)).toThrow(/must not be empty/);
  });
});

describe('validateChannelAprsBinding', () => {
  it('rejects out-of-range report slot index', () => {
    const config = newAprsConfiguration('p1', 'Home');
    config.channelSlots = [
      {
        channelRef: null,
        timeslot: 1,
        targetDmrId: 1,
        callType: 'group',
      },
    ];
    expect(() =>
      validateChannelAprsBinding(
        {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: 2,
        },
        config,
      ),
    ).toThrow(/out of range/);
  });
});

describe('collectAprsValidationWarnings', () => {
  it('warns when digital report on analog-only channel', () => {
    const channel = {
      ...newChannel('p1', 'FM only'),
      aprs: {
        receiveEnabled: true,
        reportType: 'digital' as const,
        digitalPttMode: 'off' as const,
        reportSlotIndex: null,
      },
    };
    const warnings = collectAprsValidationWarnings({ ...emptyLibrary(), channels: [channel] });
    expect(warnings.some((w) => w.code === 'digital_report_on_analog_channel')).toBe(true);
  });

  it('warns when digital APRS channels exist without a library config', () => {
    const channel = {
      ...newChannel('p1', 'DMR'),
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1,
          dmrMode: null,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
      aprs: {
        receiveEnabled: true,
        reportType: 'digital' as const,
        digitalPttMode: 'on' as const,
        reportSlotIndex: 1,
      },
    };
    const warnings = collectAprsValidationWarnings({ ...emptyLibrary(), channels: [channel] });
    expect(warnings.some((w) => w.code === 'channels_have_digital_aprs_without_config')).toBe(true);
  });
});
