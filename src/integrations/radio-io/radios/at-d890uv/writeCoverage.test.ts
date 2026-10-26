import { describe, expect, it } from 'vitest';
import { atD890WriteCoverageRows } from './writeCoverage.ts';

const settingsRow = (n?: number) =>
  atD890WriteCoverageRows(false, n).find((r) => r.label === 'Radio settings')!;

describe('What Write updates: the Radio settings row', () => {
  it('is preserved with no note until the user sets fields', () => {
    expect(settingsRow().status).toBe('preserved');
    expect(settingsRow().note).toBeUndefined();
    expect(settingsRow(0).note).toBeUndefined();
  });

  it('says how many fields the session sets', () => {
    expect(settingsRow(1).note).toBe('Preserved, except 1 field you set');
    expect(settingsRow(5).note).toBe('Preserved, except 5 fields you set');
    expect(atD890WriteCoverageRows(true, 2).find((r) => r.label === 'Radio settings')?.note).toBe(
      'Preserved, except 2 fields you set',
    );
  });
});
