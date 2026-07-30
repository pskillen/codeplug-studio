import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Browser } from '@capacitor/browser';
import * as platform from '../../integrations/platform/isNativeApp.ts';
import { handleExternalLinkClick, openExternalUrl } from './openExternalUrl.ts';

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openExternalUrl', () => {
  it('calls Browser.open when on native app', async () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    await openExternalUrl('https://example.com');
    expect(Browser.open).toHaveBeenCalledWith({ url: 'https://example.com' });
  });

  it('calls window.open when on web', async () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
    const winOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await openExternalUrl('https://example.com');
    expect(winOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });
});

describe('handleExternalLinkClick', () => {
  it('intercepts external link click and delegates to Browser.open when on native', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    const anchor = document.createElement('a');
    anchor.href = 'https://github.com/';
    anchor.target = '_blank';
    document.body.appendChild(anchor);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    handleExternalLinkClick(event);

    expect(Browser.open).toHaveBeenCalledWith({ url: 'https://github.com/' });
    document.body.removeChild(anchor);
  });

  it('does nothing when on web', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
    const event = new MouseEvent('click');
    handleExternalLinkClick(event);
    expect(Browser.open).not.toHaveBeenCalled();
  });
});
