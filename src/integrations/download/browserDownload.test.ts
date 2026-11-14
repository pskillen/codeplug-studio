import { afterEach, describe, expect, it, vi } from 'vitest';

import * as platform from '@integrations/platform/isNativeApp.ts';

import { downloadBlob, downloadZip, isoTimestampForFilename } from './browserDownload.ts';
import * as nativeSave from './nativeSave.ts';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('in a browser clicks an <a download> with the same file name and saves nothing on a device', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
    const save = vi.spyOn(nativeSave, 'saveBlobOnDevice');
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
    const blob = new Blob(['x']);

    downloadBlob(blob, 'flash-log.txt');
    vi.unstubAllGlobals();

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'flash-log.txt' }]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(save).not.toHaveBeenCalled();
  });

  it('in the Android app saves on the device instead of clicking a link', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    const save = vi.spyOn(nativeSave, 'saveBlobOnDevice').mockResolvedValue({
      status: 'failed',
      fileName: 'reads.zip',
      message: 'test',
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    downloadZip(new Uint8Array([1, 2, 3]), 'reads.zip');

    expect(save).toHaveBeenCalledTimes(1);
    const [blob, name] = save.mock.calls[0];
    expect(name).toBe('reads.zip');
    expect(blob.type).toBe('application/zip');
    expect(click).not.toHaveBeenCalled();
  });
});

describe('isoTimestampForFilename', () => {
  it('replaces colons and periods so the stamp is filesystem-safe', () => {
    const date = new Date('2026-07-28T14:32:05.123Z');
    expect(isoTimestampForFilename(date)).toBe('2026-07-28T14-32-05-123Z');
  });

  it('contains no colon or period', () => {
    const stamp = isoTimestampForFilename(new Date());
    expect(stamp).not.toMatch(/[:.]/);
  });
});
