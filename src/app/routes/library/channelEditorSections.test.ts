import { describe, expect, it } from 'vitest';
import { channelEditorSections } from './channelEditorSections.ts';

describe('channelEditorSections', () => {
  it('orders panels for a new channel with no modes', () => {
    expect(channelEditorSections({ isNew: true, modeCount: 0 }).map((s) => s.id)).toEqual([
      'identity',
      'mode',
      'transmit',
      'naming',
      'location',
      'scanning',
      'aprs',
    ]);
  });

  it('omits modes nav with a single mode', () => {
    const ids = channelEditorSections({ isNew: true, modeCount: 1 }).map((s) => s.id);
    expect(ids).not.toContain('modes');
  });

  it('adds modes and zones for a saved dual-mode channel', () => {
    const ids = channelEditorSections({ isNew: false, modeCount: 2 }).map((s) => s.id);
    expect(ids).toEqual([
      'identity',
      'mode',
      'modes',
      'transmit',
      'naming',
      'location',
      'zones',
      'scanning',
      'aprs',
    ]);
  });
});
