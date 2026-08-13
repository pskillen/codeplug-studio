import { describe, expect, it, vi } from 'vitest';
import {
  createRadioCloneHydrationBag,
  createRadioCloneHydrationBagFromBlocks,
} from '@core/models/radioCloneHydration.ts';
import { downloadEphemeralRadioCloneHydration } from './radioInfoExport.ts';

describe('downloadEphemeralRadioCloneHydration', () => {
  it('downloads contiguous images as a single binary file', () => {
    const anchor = document.createElement('a');
    const click = vi.fn();
    anchor.click = click;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const bag = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: new Uint8Array([1, 2, 3]),
    });
    downloadEphemeralRadioCloneHydration(bag);

    expect(anchor.download).toMatch(/^radio-clone-UV5R-Mini-.+\.img$/);
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('downloads sparse blocks as a zip archive', () => {
    const anchor = document.createElement('a');
    const click = vi.fn();
    anchor.click = click;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: 'AT-D890UV',
      blocks: [{ address: 0x1000, data: new Uint8Array([0xaa]) }],
    });

    downloadEphemeralRadioCloneHydration(bag);

    expect(anchor.download).toMatch(/^radio-clone-AT-D890UV-.+\.zip$/);
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
