import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { rt95Mm9pdyChannelDescription, toRt95Ascii } from './rt95Mm9pdyText.ts';

describe('toRt95Ascii', () => {
  it('leaves printable ASCII alone', () => {
    expect(toRt95Ascii('GB3 GL-1', { forbidUnderscore: true })).toEqual({
      text: 'GB3 GL-1',
      replaced: false,
    });
  });
  it('folds accents and flags the replacement', () => {
    expect(toRt95Ascii('Café Ünion', { forbidUnderscore: true })).toEqual({
      text: 'Cafe Union',
      replaced: true,
    });
  });
  it('replaces characters with no fold by a hyphen', () => {
    expect(toRt95Ascii('a€b', { forbidUnderscore: false }).text).toBe('a-b');
  });
  it('replaces underscore only when forbidden', () => {
    expect(toRt95Ascii('Rock_Ch', { forbidUnderscore: true })).toEqual({
      text: 'Rock-Ch',
      replaced: true,
    });
    expect(toRt95Ascii('Rock_Ch', { forbidUnderscore: false }).text).toBe('Rock_Ch');
  });
});

describe('rt95Mm9pdyChannelDescription', () => {
  const ch = (name: string, abbreviation = '') => ({ ...newChannel('p', name), abbreviation });

  it('uses the channel Name', () => {
    expect(rt95Mm9pdyChannelDescription(ch('Calling ch'), 'TEST01')).toEqual({
      text: 'Calling ch',
      shortened: false,
      replaced: false,
    });
  });
  it('is empty when it equals the radio name', () => {
    expect(rt95Mm9pdyChannelDescription(ch('TEST01'), 'TEST01').text).toBe('');
  });
  it('lets the override win, and an empty override means none', () => {
    expect(rt95Mm9pdyChannelDescription(ch('Calling ch'), 'TEST01', 'Mine').text).toBe('Mine');
    expect(rt95Mm9pdyChannelDescription(ch('Calling ch'), 'TEST01', '').text).toBe('');
  });
  it('replaces underscore and reports it', () => {
    expect(rt95Mm9pdyChannelDescription(ch('Rock_Ch'), 'X')).toMatchObject({
      text: 'Rock-Ch',
      replaced: true,
    });
  });
  it('folds accents and reports it', () => {
    expect(rt95Mm9pdyChannelDescription(ch('Café Ünion'), 'X')).toMatchObject({
      text: 'Cafe Union',
      replaced: true,
    });
  });
  it('shortens a long name to 12 characters and reports it', () => {
    const r = rt95Mm9pdyChannelDescription(ch('Fifteen chars ab'), 'X');
    expect(r.text.length).toBeLessThanOrEqual(12);
    expect(r.shortened).toBe(true);
  });
});
