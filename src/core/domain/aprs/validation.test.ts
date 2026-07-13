import { describe, expect, it } from 'vitest';
import { emptyLibrary, newAprsConfiguration, newChannel } from '../factories.ts';
import {
  collectAprsValidationWarnings,
  validateAprsConfigurationName,
  validateChannelAprsRefs,
} from './validation.ts';

describe('validateAprsConfigurationName', () => {
  it('rejects duplicate names', () => {
    const config = newAprsConfiguration('p1', 'Home');
    const library = {
      ...emptyLibrary(),
      aprsConfigurations: [{ ...config, id: 'other' }],
    };
    expect(() => validateAprsConfigurationName(config, library)).toThrow(/Duplicate/);
  });
});

describe('validateChannelAprsRefs', () => {
  it('rejects orphan report channel ref', () => {
    const channel = {
      ...newChannel('p1', 'GB3DA'),
      aprs: {
        receiveEnabled: true,
        reportType: 'digital' as const,
        digitalPttMode: 'on' as const,
        reportChannelRef: { kind: 'channel' as const, id: 'missing' },
      },
    };
    expect(() => validateChannelAprsRefs(channel, emptyLibrary())).toThrow(/not found/);
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
        reportChannelRef: null,
      },
    };
    const warnings = collectAprsValidationWarnings(
      { ...emptyLibrary(), channels: [channel] },
      null,
    );
    expect(warnings.some((w) => w.code === 'digital_report_on_analog_channel')).toBe(true);
  });
});
