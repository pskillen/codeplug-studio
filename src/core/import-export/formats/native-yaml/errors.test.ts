import { describe, expect, it } from 'vitest';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import { FIXTURE_PROJECT_ID, fullLibraryAggregate } from './testFixtures.ts';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import {
  NativeYamlImportError,
  expectNullableNumber,
  expectNullableString,
  expectOptionalString,
} from './errors.ts';

describe('native-yaml expect helpers', () => {
  it('treats omitted optional strings as the default', () => {
    expect(expectOptionalString(undefined, 'field')).toBe('');
    expect(expectOptionalString(undefined, 'field', 'CQCQCQ')).toBe('CQCQCQ');
    expect(expectOptionalString('WIRES', 'field')).toBe('WIRES');
  });
  it('treats omitted nullable strings as null', () => {
    expect(expectNullableString(undefined, 'field')).toBeNull();
    expect(expectNullableString(null, 'field')).toBeNull();
    expect(expectNullableString('IO85vs', 'field')).toBe('IO85vs');
  });

  it('treats omitted nullable numbers as null', () => {
    expect(expectNullableNumber(undefined, 'field')).toBeNull();
    expect(expectNullableNumber(null, 'field')).toBeNull();
    expect(expectNullableNumber(25, 'field')).toBe(25);
  });

  it('rejects invalid nullable string types', () => {
    expect(() => expectNullableString(42, 'field')).toThrow(NativeYamlImportError);
    expect(() => expectNullableString(42, 'field')).toThrow(/must be a string/);
  });
});

describe('native-yaml NXDN rate', () => {
  it('rejects an unknown nxdnRate', () => {
    const aggregate = fullLibraryAggregate();
    const channel: Channel = {
      ...newChannel(FIXTURE_PROJECT_ID, 'NXDN ch'),
      modeProfiles: [
        {
          mode: 'nxdn',
          rxRan: null,
          txRan: null,
          ownDigitalIdId: null,
          contactRef: null,
          nxdnRate: 'nxdn48',
        },
      ],
    };
    const yaml = serialiseProject({ ...aggregate, channels: [channel] }).replace(
      'nxdnRate: nxdn48',
      'nxdnRate: nxdn192',
    );
    expect(yaml).toContain('nxdn192');
    expect(() => parseProjectDocument(yaml)).toThrow(/nxdnRate/);
  });
});
