import { describe, expect, it } from 'vitest';
import { classifyChirpTone, formatChirpToneColumns, formatChirpToneFreq } from './channelWire.ts';

describe('classifyChirpTone', () => {
  it('classifies none, CTCSS, and DCS with polarity', () => {
    expect(classifyChirpTone('none')).toMatchObject({ kind: 'none' });
    expect(classifyChirpTone('88.5')).toEqual({
      kind: 'Tone',
      ctcssFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'N',
    });
    expect(classifyChirpTone('D023N')).toEqual({
      kind: 'DTCS',
      ctcssFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'N',
    });
    expect(classifyChirpTone('D047P')).toEqual({
      kind: 'DTCS',
      ctcssFreq: '88.5',
      dtcsCode: '047',
      dtcsPolarity: 'R',
    });
  });
});

describe('formatChirpToneColumns', () => {
  it('exports both none as empty Tone with CHIRP DTCS defaults', () => {
    expect(formatChirpToneColumns('none', 'none')).toEqual({
      tone: '',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'Tone->Tone',
    });
  });

  it('exports TX CTCSS only as Tone', () => {
    expect(formatChirpToneColumns('none', '103.5')).toEqual({
      tone: 'Tone',
      rToneFreq: '103.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'Tone->Tone',
    });
  });

  it('exports equal CTCSS both as TSQL', () => {
    expect(formatChirpToneColumns('88.5', '88.5')).toEqual({
      tone: 'TSQL',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'Tone->Tone',
    });
  });

  it('exports equal DCS both as DTCS', () => {
    expect(formatChirpToneColumns('D023N', 'D023N')).toEqual({
      tone: 'DTCS',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'Tone->Tone',
    });
  });

  it('exports TX DCS only as Cross / DTCS-> with reverse polarity', () => {
    expect(formatChirpToneColumns('none', 'D047P')).toEqual({
      tone: 'Cross',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '047',
      dtcsPolarity: 'RN',
      rxDtcsCode: '023',
      crossMode: 'DTCS->',
    });
  });

  it('exports RX DCS only as Cross / ->DTCS', () => {
    expect(formatChirpToneColumns('D023N', 'none')).toEqual({
      tone: 'Cross',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: '->DTCS',
    });
  });

  it('exports CTCSS TX + DCS RX as Cross / Tone->DTCS', () => {
    expect(formatChirpToneColumns('D047N', '100.0')).toEqual({
      tone: 'Cross',
      rToneFreq: '100.0',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '047',
      crossMode: 'Tone->DTCS',
    });
  });

  it('exports DCS TX + CTCSS RX as Cross / DTCS->Tone', () => {
    expect(formatChirpToneColumns('88.5', 'D023N')).toEqual({
      tone: 'Cross',
      rToneFreq: '88.5',
      cToneFreq: '88.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'DTCS->Tone',
    });
  });

  it('exports unequal CTCSS both as Cross / Tone->Tone', () => {
    expect(formatChirpToneColumns('100.0', '88.5')).toEqual({
      tone: 'Cross',
      rToneFreq: '88.5',
      cToneFreq: '100.0',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: 'Tone->Tone',
    });
  });

  it('exports RX CTCSS only as Cross / ->Tone', () => {
    expect(formatChirpToneColumns('103.5', 'none')).toEqual({
      tone: 'Cross',
      rToneFreq: '88.5',
      cToneFreq: '103.5',
      dtcsCode: '023',
      dtcsPolarity: 'NN',
      rxDtcsCode: '023',
      crossMode: '->Tone',
    });
  });

  it('does not put DCS into CTCSS frequency columns', () => {
    expect(formatChirpToneFreq('D023N')).toBe('88.5');
    expect(formatChirpToneColumns('D023N', 'D047P').rToneFreq).toBe('88.5');
    expect(formatChirpToneColumns('D023N', 'D047P').cToneFreq).toBe('88.5');
    expect(formatChirpToneColumns('D023N', 'D047P')).toMatchObject({
      tone: 'Cross',
      dtcsCode: '047',
      rxDtcsCode: '023',
      dtcsPolarity: 'RN',
      crossMode: 'DTCS->DTCS',
    });
  });
});
