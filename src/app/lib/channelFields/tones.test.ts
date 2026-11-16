import { describe, expect, it } from 'vitest';
import { ctcssToneSelectOptions, dcsCodeSelectOptions } from './tones.ts';

describe('ctcssToneSelectOptions', () => {
  it('labels catalog tones in Hz and keeps a stored value that is not listed', () => {
    const options = ctcssToneSelectOptions('100');
    expect(options.find((option) => option.value === '88.5')).toEqual({
      value: '88.5',
      label: '88.5 Hz',
    });
    expect(options.at(-1)).toEqual({ value: '100', label: '100 Hz' });
    expect(ctcssToneSelectOptions('88.5').some((option) => option.value === '88.5')).toBe(true);
    expect(ctcssToneSelectOptions('88.5').filter((option) => option.value === '88.5')).toHaveLength(
      1,
    );
  });
});

describe('dcsCodeSelectOptions', () => {
  it('strips the normal suffix and inserts a code that is not listed', () => {
    const options = dcsCodeSelectOptions('012');
    expect(options.find((option) => option.value === '023')).toEqual({
      value: '023',
      label: 'D023',
    });
    expect(options[0]).toEqual({ value: '012', label: 'D012' });
    expect(dcsCodeSelectOptions('023').filter((option) => option.value === '023')).toHaveLength(1);
  });
});
