import { describe, expect, it, vi } from 'vitest';
import {
  RadioInterlockError,
  RadioWrongIdentError,
  adviseRadioError,
} from '@integrations/radio-io/kit/errors.ts';
import { OpenGd77WriteNackError } from '@integrations/radio-io/radios/opengd77/writeErrors.ts';
import {
  classifyWriteError,
  reportWriteError,
  retryLabelFor,
  sentStateLabel,
  type WriteErrorContext,
} from './writeErrorOutcome.ts';

function ctx(partial: Partial<WriteErrorContext> = {}): WriteErrorContext {
  return {
    phase: 'read',
    transmitStarted: false,
    userCancelled: false,
    radioLabel: 'Test Radio',
    profileId: 'radio-io-test',
    ...partial,
  };
}

describe('classifyWriteError', () => {
  it('picker NotFoundError while connecting is cancelled with the no-port wording', () => {
    const err = new Error('cancelled');
    err.name = 'NotFoundError';
    const outcome = classifyWriteError(err, ctx({ phase: 'connect' }));
    expect(outcome.kind).toBe('cancelled');
    expect(outcome.message).toBe(
      'No port chosen, so nothing happened. Press Read & write to choose again.',
    );
  });

  it('NotFoundError after connect is an error', () => {
    const err = new Error('gone');
    err.name = 'NotFoundError';
    const outcome = classifyWriteError(err, ctx({ phase: 'read' }));
    expect(outcome.kind).toBe('error');
  });

  it('WriteCancelledError on Review is cancelled with the Review wording', () => {
    const err = new Error('n/a');
    err.name = 'WriteCancelledError';
    const outcome = classifyWriteError(err, ctx({ phase: 'review' }));
    expect(outcome.kind).toBe('cancelled');
    expect(outcome.message).toBe('Write cancelled. Nothing was written.');
  });

  it('user abort during the read is cancelled', () => {
    const err = new Error('aborted');
    const outcome = classifyWriteError(err, ctx({ userCancelled: true, phase: 'read' }));
    expect(outcome.kind).toBe('cancelled');
    expect(outcome.message).toBe('Read cancelled. Nothing was written.');
  });

  it('user abort after transmit is an error that may hold part', () => {
    const err = new Error('aborted');
    const outcome = classifyWriteError(
      err,
      ctx({ userCancelled: true, transmitStarted: true, phase: 'write' }),
    );
    expect(outcome.kind).toBe('error');
    expect(outcome.retry).toBe('rewrite');
    expect(outcome.sent).toBe('may-hold-part');
  });

  it('explicit retry and sent win', () => {
    const err = adviseRadioError(new RadioInterlockError('nope'), {
      retry: 'none',
      sent: 'nothing-saved',
    });
    const outcome = classifyWriteError(err, ctx({ transmitStarted: true }));
    expect(outcome.retry).toBe('none');
    expect(outcome.sent).toBe('nothing-saved');
  });

  it('RadioInterlockError without retry is none', () => {
    const err = new RadioInterlockError('blocked');
    const outcome = classifyWriteError(err, ctx({ transmitStarted: true }));
    expect(outcome.retry).toBe('none');
  });

  it('before transmit defaults to reconnect and nothing sent', () => {
    const err = new Error('timeout');
    const outcome = classifyWriteError(err, ctx({ transmitStarted: false }));
    expect(outcome.retry).toBe('reconnect');
    expect(outcome.sent).toBe('nothing-sent');
  });

  it('after transmit defaults to rewrite and may hold part', () => {
    const err = new Error('closed');
    const outcome = classifyWriteError(err, ctx({ transmitStarted: true }));
    expect(outcome.retry).toBe('rewrite');
    expect(outcome.sent).toBe('may-hold-part');
  });

  it('module debug text is kept', () => {
    const err = new RadioInterlockError('x');
    err.debugText = 'module trace';
    const outcome = classifyWriteError(err, ctx());
    expect(outcome.debugText).toBe('module trace');
  });

  it('OpenGd77WriteNackError debug text is kept', () => {
    const err = new OpenGd77WriteNackError({
      phase: 'codeplug',
      command: 'set-sector',
      sectorAbs: 0,
      offset: 0,
      sectorIndex: 1,
      sectorsTotal: 1,
    });
    err.debugText = 'trace';
    const outcome = classifyWriteError(err, ctx());
    expect(outcome.debugText).toBe('trace');
  });

  it('fallback debug text is never empty and names phase, radio and profile', () => {
    const err = new Error('oops');
    const outcome = classifyWriteError(
      err,
      ctx({ phase: 'write', stage: 'Upload', build: { version: 'v0', env: 'test' } }),
    );
    expect(outcome.debugText.length).toBeGreaterThan(0);
    expect(outcome.debugText).toContain('phase: write');
    expect(outcome.debugText).toContain('radio: Test Radio');
    expect(outcome.debugText).toContain('profile: radio-io-test');
    expect(outcome.debugText).toContain('studio: v0 (test)');
  });
});

describe('reportWriteError', () => {
  it('reportWriteError logs every error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const outcome = classifyWriteError(new Error('fail'), ctx());
    reportWriteError(outcome);
    expect(spy).toHaveBeenCalledWith('[radio-write]', outcome.message, outcome.debugText);
    spy.mockRestore();
  });

  it('reportWriteError is silent for cancelled', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('n/a');
    err.name = 'WriteCancelledError';
    reportWriteError(classifyWriteError(err, ctx({ phase: 'review' })));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('retryLabelFor', () => {
  it('retry labels', () => {
    const base = classifyWriteError(new Error('x'), ctx());
    expect(retryLabelFor({ ...base, retry: 'none' }, 'write')).toBeNull();
    expect(retryLabelFor({ ...base, retry: 'reconnect' }, 'write')).toBe('Reconnect and try again');
    expect(retryLabelFor({ ...base, retry: 'rewrite' }, 'write')).toBe('Write again');
    expect(retryLabelFor({ ...base, retry: 'rewrite' }, 'check')).toBe('Check again');
    expect(retryLabelFor({ ...base, retry: 'rewrite' }, 'keps')).toBe('Write keps again');
    const ident = classifyWriteError(new RadioWrongIdentError(), ctx());
    expect(retryLabelFor(ident, 'connect')).toBe('Connect again');
  });
});

describe('sentStateLabel', () => {
  it('sent state labels', () => {
    expect(sentStateLabel('nothing-sent')).toBe('Nothing sent');
    expect(sentStateLabel('nothing-saved')).toBe('Nothing saved');
    expect(sentStateLabel('may-hold-part')).toBe('May hold part of the write');
  });
});
