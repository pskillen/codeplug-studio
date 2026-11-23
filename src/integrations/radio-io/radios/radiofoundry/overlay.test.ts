import { describe, expect, it } from 'vitest';
import { overlayRadioFoundryOwned } from './overlay.ts';

describe('overlayRadioFoundryOwned', () => {
  it('keeps a 0xFF hole the serialiser does not own', () => {
    const radio = Uint8Array.of(0x5a, 0x5a, 0x5a, 0x5a);
    const serialised = Uint8Array.of(0xff, 0x41, 0xff, 0xff);
    const owned = Uint8Array.of(0, 1, 1, 0);
    expect([...overlayRadioFoundryOwned(radio, serialised, owned)]).toEqual([
      0x5a, 0x41, 0xff, 0x5a,
    ]);
  });
});
