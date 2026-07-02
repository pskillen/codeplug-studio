import { describe, expect, it } from 'vitest';
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
