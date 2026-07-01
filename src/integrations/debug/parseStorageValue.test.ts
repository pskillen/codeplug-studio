import { describe, expect, it } from 'vitest';
import { maskSensitiveToken, parseStorageRaw, redactParsedValue } from './parseStorageValue.ts';

describe('parseStorageRaw', () => {
  it('returns null parsed for missing value', () => {
    expect(parseStorageRaw(null)).toEqual({ parsed: null, parseError: null });
  });

  it('parses JSON objects', () => {
    const result = parseStorageRaw('{"version":1}');
    expect(result.parseError).toBeNull();
    expect(result.parsed).toEqual({ version: 1 });
  });

  it('parses JSON primitives', () => {
    expect(parseStorageRaw('4').parsed).toBe(4);
  });

  it('wraps plain strings as value objects', () => {
    expect(parseStorageRaw('osm')).toEqual({
      parsed: { value: 'osm' },
      parseError: null,
    });
  });

  it('reports invalid JSON for object-like input', () => {
    const result = parseStorageRaw('{broken');
    expect(result.parsed).toBeNull();
    expect(result.parseError).toMatch(/JSON/i);
  });
});

describe('maskSensitiveToken', () => {
  it('masks short tokens fully', () => {
    expect(maskSensitiveToken('abc')).toBe('••••');
  });

  it('shows last four characters', () => {
    expect(maskSensitiveToken('pk.abcdefghijklmnop')).toBe('••••mnop');
  });
});

describe('redactParsedValue', () => {
  it('passes through when redact is false', () => {
    expect(redactParsedValue('secret', false)).toBe('secret');
  });

  it('redacts string values', () => {
    expect(redactParsedValue('pk.secret-token', true)).toBe('••••oken');
  });

  it('redacts wrapped plain-string values', () => {
    expect(redactParsedValue({ value: 'pk.secret-token' }, true)).toEqual({
      value: '••••oken',
    });
  });
});
