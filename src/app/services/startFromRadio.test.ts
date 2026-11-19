import { describe, expect, it } from 'vitest';
import {
  firmwareFlashOfferedForTarget,
  listReadableRadios,
  modFirmwareLabelForTarget,
  suggestedProjectName,
} from './startFromRadio.ts';

describe('startFromRadio', () => {
  it('lists each readable radio model once, with every firmware the read understands', () => {
    const radios = listReadableRadios();
    expect(radios.map((r) => r.modelId)).toEqual(['baofeng-uv5r-mini']);
    expect(radios[0]).toMatchObject({
      label: 'Baofeng UV-5R Mini',
      firmwareLabels: ['Stock', 'MM9PDY'],
      egress: { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' },
    });
  });

  it('suggests a project name from the model', () => {
    expect(suggestedProjectName(listReadableRadios()[0]!)).toBe('My UV-5R Mini');
  });

  it('knows the modded firmware label and whether the flasher is offered', () => {
    expect(modFirmwareLabelForTarget('baofeng-uv5r-mini')).toBe('MM9PDY');
    expect(firmwareFlashOfferedForTarget('baofeng-uv5r-mini', 'dev')).toBe(true);
    expect(firmwareFlashOfferedForTarget('unknown', 'dev')).toBe(false);
  });
});
