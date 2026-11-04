import { describe, expect, it } from 'vitest';
import { channelEditPath, channelViewPath } from './channelPaths.ts';

describe('channelPaths', () => {
  it('points view at the channel id and edit under it', () => {
    expect(channelViewPath('ch-1')).toBe('/library/channels/ch-1');
    expect(channelEditPath('ch-1')).toBe('/library/channels/ch-1/edit');
  });
});
