import { describe, expect, it } from 'vitest';
import { isFullBleedPath, isWideDesktopPath } from './fullBleedRoutes.ts';

describe('isFullBleedPath', () => {
  it('is true for the Field tools only', () => {
    expect(isFullBleedPath('/tools/nearby')).toBe(true);
    expect(isFullBleedPath('/tools/locator')).toBe(true);
    expect(isFullBleedPath('/reference')).toBe(false);
    expect(isFullBleedPath('/toolsmith')).toBe(false);
  });

  it('is true for the repeater directory searches with a map on mobile only', () => {
    expect(isFullBleedPath('/library/channels/add-from-ukrepeater', true)).toBe(true);
    expect(isFullBleedPath('/library/channels/add-from-irts/', true)).toBe(true);
    expect(isFullBleedPath('/library/channels/add-from-repeaterbook', true)).toBe(true);
    expect(isFullBleedPath('/library/channels/add-from-brandmeister', true)).toBe(false);
    expect(isFullBleedPath('/library/channels/add-from-ukrepeater')).toBe(false);
  });

  it('is true for the Channels and Zones lists on mobile only', () => {
    expect(isFullBleedPath('/library/channels', true)).toBe(true);
    expect(isFullBleedPath('/library/zones/', true)).toBe(true);
    expect(isFullBleedPath('/library/channels')).toBe(false);
    expect(isFullBleedPath('/library/channels/new', true)).toBe(false);
    expect(isFullBleedPath('/library/zones/abc', true)).toBe(false);
  });
});

describe('isWideDesktopPath', () => {
  it('is true for the list + map pages only', () => {
    expect(isWideDesktopPath('/library/channels')).toBe(true);
    expect(isWideDesktopPath('/library/zones/')).toBe(true);
    expect(isWideDesktopPath('/library/channels/add-from-repeaterbook')).toBe(true);
    expect(isWideDesktopPath('/library/channels/new')).toBe(false);
    expect(isWideDesktopPath('/library/talk-groups')).toBe(false);
    expect(isWideDesktopPath('/tools/nearby')).toBe(false);
  });

  it('is true for the zone editor main page only', () => {
    expect(isWideDesktopPath('/library/zones/c93dc48c-5207-4f01-b94b-e56f46e0bf3d')).toBe(true);
    expect(isWideDesktopPath('/library/zones/c93dc48c/')).toBe(true);
    expect(isWideDesktopPath('/library/zones/c93dc48c/add-from-map')).toBe(false);
    expect(isWideDesktopPath('/library/zones/new')).toBe(false);
    expect(isWideDesktopPath('/library/zones/new-from-location')).toBe(false);
    expect(isWideDesktopPath('/library/zones/defaults')).toBe(false);
  });
});
