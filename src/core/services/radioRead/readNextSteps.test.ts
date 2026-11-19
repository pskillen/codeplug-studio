import { describe, expect, it } from 'vitest';
import { readNextSteps } from './readNextSteps.ts';

describe('readNextSteps', () => {
  it('leads with zones on a radio running firmware with zones', () => {
    expect(
      readNextSteps({ radioTargetId: 'baofeng-uv5r-mini-mm9pdy', firmwareFlashOffered: true }),
    ).toEqual(['arrange-zones', 'browse-channels', 'open-build']);
  });

  it('offers a firmware update on stock firmware when a mod adds zones and the flasher is offered', () => {
    expect(
      readNextSteps({ radioTargetId: 'baofeng-uv5r-mini', firmwareFlashOffered: true }),
    ).toEqual(['update-firmware', 'browse-channels', 'open-build']);
  });

  it('does not offer a firmware update when the flasher is not offered on this site', () => {
    expect(
      readNextSteps({ radioTargetId: 'baofeng-uv5r-mini', firmwareFlashOffered: false }),
    ).toEqual(['browse-channels', 'open-build']);
  });

  it('leads with zones on stock firmware that already has zones', () => {
    expect(readNextSteps({ radioTargetId: 'baofeng-dm32uv', firmwareFlashOffered: true })[0]).toBe(
      'arrange-zones',
    );
  });

  it('never suggests writing to the radio', () => {
    for (const radioTargetId of ['baofeng-uv5r-mini', 'baofeng-uv5r-mini-mm9pdy', 'unknown']) {
      expect(readNextSteps({ radioTargetId, firmwareFlashOffered: true })).not.toContain('write');
    }
  });

  it('falls back to the generic steps for an unknown target', () => {
    expect(readNextSteps({ radioTargetId: 'unknown', firmwareFlashOffered: true })).toEqual([
      'browse-channels',
      'open-build',
    ]);
  });
});
