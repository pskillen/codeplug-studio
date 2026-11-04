import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '@integrations/radio-io/kit/errors.ts';
import { OpenGd77WriteNackError } from '@integrations/radio-io/radios/opengd77/writeErrors.ts';
import { errorDebugText } from './useRadioWriteFlow.tsx';

describe('errorDebugText (what the write flow shows under an error)', () => {
  it('returns the trace a radio module attached to its error', () => {
    const err = new RadioProtocolError('boom');
    err.debugText = 'Last 2 radio frames (oldest first):\nTX 58 01';
    expect(errorDebugText(err)).toBe(err.debugText);
  });

  it('returns the trace on a typed OpenGD77 write error', () => {
    const err = new OpenGd77WriteNackError({
      phase: 'codeplug',
      command: 'set-sector',
      sectorAbs: 0,
      offset: 0,
      sectorIndex: 1,
      sectorsTotal: 1,
    });
    err.debugText = 'trace';
    expect(errorDebugText(err)).toBe('trace');
  });

  it('is null for an error without a trace and for a non-radio error', () => {
    expect(errorDebugText(new RadioProtocolError('boom'))).toBeNull();
    expect(errorDebugText(new Error('plain'))).toBeNull();
    expect(errorDebugText('string')).toBeNull();
  });
});
