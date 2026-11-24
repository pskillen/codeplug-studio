import { describe, expect, it } from 'vitest';
import { adviseRadioError, RadioTimeoutError } from './errors.ts';

describe('adviseRadioError', () => {
  it('adviseRadioError sets retry and sent and returns the same error', () => {
    const err = new RadioTimeoutError();
    const out = adviseRadioError(err, { retry: 'rewrite', sent: 'may-hold-part' });
    expect(out).toBe(err);
    expect(err.retry).toBe('rewrite');
    expect(err.sent).toBe('may-hold-part');
  });
});
