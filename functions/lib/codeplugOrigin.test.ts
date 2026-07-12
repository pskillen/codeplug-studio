import { describe, expect, it } from 'vitest';
import {
  ALLOWED_LOCAL_DEV_ORIGIN,
  isAllowedCodeplugOrigin,
  resolveAllowedRequestOrigin,
} from './codeplugOrigin.ts';

describe('isAllowedCodeplugOrigin', () => {
  it('accepts deploy apex and subdomains over https', () => {
    expect(isAllowedCodeplugOrigin('https://codeplug.mm9pdy.net')).toBe(true);
    expect(isAllowedCodeplugOrigin('https://dev.codeplug.mm9pdy.net')).toBe(true);
    expect(isAllowedCodeplugOrigin('https://next.codeplug.mm9pdy.net/library')).toBe(true);
    expect(isAllowedCodeplugOrigin('https://staging.codeplug.mm9pdy.net/')).toBe(true);
  });

  it('accepts local Vite dev origin', () => {
    expect(isAllowedCodeplugOrigin(ALLOWED_LOCAL_DEV_ORIGIN)).toBe(true);
    expect(isAllowedCodeplugOrigin('http://localhost:5173/library/channels')).toBe(true);
  });

  it('rejects unknown, typosquat, and wrong local ports', () => {
    expect(isAllowedCodeplugOrigin('https://evil.com')).toBe(false);
    expect(isAllowedCodeplugOrigin('https://codeplug.mm9pdy.net.evil.com')).toBe(false);
    expect(isAllowedCodeplugOrigin('http://localhost:3000')).toBe(false);
    expect(isAllowedCodeplugOrigin('https://localhost:5173')).toBe(false);
    expect(isAllowedCodeplugOrigin('http://127.0.0.1:5173')).toBe(false);
    expect(isAllowedCodeplugOrigin(null)).toBe(false);
  });
});

describe('resolveAllowedRequestOrigin', () => {
  it('prefers Origin over Referer', () => {
    const request = new Request('https://codeplug.mm9pdy.net/api/test', {
      headers: {
        Origin: ALLOWED_LOCAL_DEV_ORIGIN,
        Referer: 'https://next.codeplug.mm9pdy.net/library',
      },
    });
    expect(resolveAllowedRequestOrigin(request)).toBe(ALLOWED_LOCAL_DEV_ORIGIN);
  });

  it('falls back to Referer origin', () => {
    const request = new Request('https://codeplug.mm9pdy.net/api/test', {
      headers: {
        Referer: 'https://dev.codeplug.mm9pdy.net/library/channels',
      },
    });
    expect(resolveAllowedRequestOrigin(request)).toBe('https://dev.codeplug.mm9pdy.net');
  });
});
