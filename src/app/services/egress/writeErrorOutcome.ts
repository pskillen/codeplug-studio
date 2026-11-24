import {
  RadioInterlockError,
  type RadioRetryAdvice,
  type RadioSentState,
} from '@integrations/radio-io/kit/errors.ts';

export type WriteErrorPhase =
  'connect' | 'preflight' | 'read' | 'review' | 'write' | 'keps' | 'check' | 'restore';

export interface WriteErrorContext {
  phase: WriteErrorPhase;
  /** A write-class frame may have gone out (the stepper's transmitStarted). */
  transmitStarted: boolean;
  /** The user's own Cancel fired the abort signal. */
  userCancelled: boolean;
  radioLabel: string;
  profileId: string;
  /** Last stage label seen, when there was one. */
  stage?: string;
  /** Studio build, for the debug text: pass __BUILD_VERSION__ and __BUILD_ENV__. */
  build?: { version: string; env: string };
}

export interface WriteErrorOutcome {
  kind: 'cancelled' | 'error';
  retry: RadioRetryAdvice;
  sent: RadioSentState;
  message: string;
  /** Never empty: the module's debugText, or Studio's fallback. */
  debugText: string;
  /** RadioIoError.code, else the error's name, else 'unknown'. */
  code: string;
  /** When the refusal is a known interlock (e.g. foreign storage). */
  interlockKey?: string;
}

type ErrShape = Error & {
  retry?: RadioRetryAdvice;
  sent?: RadioSentState;
  debugText?: string;
  code?: string;
};

function errShape(err: unknown): ErrShape | null {
  if (err instanceof Error) return err as ErrShape;
  // Browser port-picker cancel is a DOMException; some test DOMs do not subclass Error.
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err as unknown as ErrShape;
  }
  return null;
}

function cancelledMessage(ctx: WriteErrorContext, err: ErrShape | null): string {
  if (ctx.phase === 'connect' && err?.name === 'NotFoundError') {
    return 'No port chosen, so nothing happened. Press Read & write to choose again.';
  }
  if (ctx.phase === 'review') {
    return err?.name === 'RestoreCancelledError'
      ? 'Restore cancelled. Nothing was written.'
      : 'Write cancelled. Nothing was written.';
  }
  return 'Read cancelled. Nothing was written.';
}

function fallbackDebugText(err: unknown, ctx: WriteErrorContext, message: string): string {
  const e = errShape(err);
  const name = e?.name ?? (err != null ? typeof err : 'unknown');
  const code = e?.code ?? 'none';
  const studioLine =
    ctx.build !== undefined ? `studio: ${ctx.build.version} (${ctx.build.env})` : undefined;
  const lines = [
    `error: ${name}`,
    `code: ${code}`,
    `message: ${message}`,
    `phase: ${ctx.phase}`,
    `stage: ${ctx.stage ?? 'none'}`,
    `radio: ${ctx.radioLabel}`,
    `profile: ${ctx.profileId}`,
    ...(studioLine ? [studioLine] : []),
    'stack:',
    e?.stack?.trim() ? e.stack.trim() : 'none',
  ];
  return lines.join('\n');
}

export function classifyWriteError(err: unknown, ctx: WriteErrorContext): WriteErrorOutcome {
  const e = errShape(err);
  const message = e?.message ?? String(err);

  if (ctx.userCancelled && ctx.transmitStarted) {
    return {
      kind: 'error',
      retry: 'rewrite',
      sent: 'may-hold-part',
      message: 'Write stopped by Cancel after data was sent. The radio may hold part of the write.',
      debugText: e?.debugText?.trim() ? e.debugText : fallbackDebugText(err, ctx, message),
      code: e?.code ?? e?.name ?? 'unknown',
    };
  }

  const isCancelledName =
    e?.name === 'WriteCancelledError' ||
    e?.name === 'RadioWriteCancelledError' ||
    e?.name === 'RestoreCancelledError';
  const isPickerCancelled = ctx.phase === 'connect' && e?.name === 'NotFoundError';
  if ((!ctx.transmitStarted && (isCancelledName || ctx.userCancelled)) || isPickerCancelled) {
    return {
      kind: 'cancelled',
      retry: 'none',
      sent: 'nothing-sent',
      message: cancelledMessage(ctx, e),
      debugText: e?.debugText?.trim() ? e.debugText : fallbackDebugText(err, ctx, message),
      code: e?.code ?? e?.name ?? 'unknown',
    };
  }

  let retry = e?.retry;
  let sent = e?.sent;
  if (
    retry === undefined &&
    (e?.name === 'RadioInterlockError' || err instanceof RadioInterlockError)
  ) {
    retry = 'none';
  }
  if (sent === undefined) {
    sent = ctx.transmitStarted ? 'may-hold-part' : 'nothing-sent';
  }
  if (retry === undefined) {
    retry = ctx.transmitStarted ? 'rewrite' : 'reconnect';
  }

  const debugText = e?.debugText?.trim() ? e.debugText : fallbackDebugText(err, ctx, message);
  const code = e?.code ?? e?.name ?? 'unknown';

  const interlockKey =
    err instanceof RadioInterlockError && err.interlockKey ? err.interlockKey : undefined;

  return {
    kind: 'error',
    retry,
    sent,
    message,
    debugText,
    code,
    interlockKey,
  };
}

export function reportWriteError(outcome: WriteErrorOutcome): void {
  if (outcome.kind === 'error') {
    console.error('[radio-write]', outcome.message, outcome.debugText);
  }
}

export function retryLabelFor(outcome: WriteErrorOutcome, phase: WriteErrorPhase): string | null {
  if (outcome.retry === 'none') return null;
  if (phase === 'check') return 'Check again';
  if (phase === 'keps') return 'Write keps again';
  if (outcome.code === 'wrongIdent') return 'Connect again';
  if (outcome.retry === 'reconnect') return 'Reconnect and try again';
  if (outcome.retry === 'rewrite') return 'Write again';
  return null;
}

export function sentStateLabel(sent: RadioSentState): string {
  if (sent === 'nothing-sent') return 'Nothing sent';
  if (sent === 'nothing-saved') return 'Nothing saved';
  return 'May hold part of the write';
}
