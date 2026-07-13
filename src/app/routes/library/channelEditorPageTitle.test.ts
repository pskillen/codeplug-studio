import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { channelEditorPageTitle } from './channelEditorPageTitle.ts';

describe('channelEditorPageTitle', () => {
  it('uses New channel for new rows', () => {
    const channel = newChannel('p1', '');
    expect(channelEditorPageTitle(true, channel)).toBe('New channel');
  });

  it('prefers callsign in edit title', () => {
    const channel = newChannel('p1', 'Demo repeater', 'GB7DC');
    expect(channelEditorPageTitle(false, channel)).toBe('Edit channel — GB7DC');
  });

  it('falls back to name when callsign is empty', () => {
    const channel = newChannel('p1', 'Simplex 2m');
    expect(channelEditorPageTitle(false, channel)).toBe('Edit channel — Simplex 2m');
  });

  it('uses generic edit title when identity fields are blank', () => {
    const channel = newChannel('p1', '');
    expect(channelEditorPageTitle(false, channel)).toBe('Edit channel');
  });
});
