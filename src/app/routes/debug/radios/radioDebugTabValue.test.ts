import { describe, expect, it } from 'vitest';
import { resolveRadioDebugTabValue } from './radioDebugTabValue.ts';

describe('resolveRadioDebugTabValue', () => {
  it('keeps the active tab when it exists on the descriptor', () => {
    expect(resolveRadioDebugTabValue('memory', ['overview', 'memory', 'hex'])).toBe('memory');
  });

  it('falls back to Overview when the tab is absent after a firmware switch', () => {
    expect(resolveRadioDebugTabValue('calibration', ['overview', 'memory', 'settings'])).toBe(
      'overview',
    );
  });
});
