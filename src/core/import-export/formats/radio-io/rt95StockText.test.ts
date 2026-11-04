import { describe, expect, it } from 'vitest';
import { rt95StockCpsNameNote } from './rt95StockText.ts';

describe('rt95StockCpsNameNote', () => {
  it('is quiet for names the stock CPS keeps', () => {
    expect(rt95StockCpsNameNote('GB3GL-1')).toBeUndefined();
    expect(rt95StockCpsNameNote('GB3 GL')).toBeUndefined();
    expect(rt95StockCpsNameNote('')).toBeUndefined();
  });

  it('notes lower case and symbols', () => {
    expect(rt95StockCpsNameNote('Gb3')).toMatch(/show as spaces/);
    expect(rt95StockCpsNameNote('A/B')).toBeDefined();
    expect(rt95StockCpsNameNote('A_B')).toBeDefined();
  });
});
