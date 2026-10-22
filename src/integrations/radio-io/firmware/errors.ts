import { RadioIoError } from '../kit/errors.ts';

function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === 'string' && cause) return cause;
  return 'The firmware update failed.';
}

/**
 * Every failure out of `FirmwareUpdater.flash()` is wrapped in this, after the updater has stopped sending, so the
 * app always knows whether the radio was touched. Interlock refusals are wrapped too: never recovered or retried.
 */
export class FirmwareFlashError extends RadioIoError {
  /** True once an erase-capable frame was sent: the radio needs a re-flash. */
  readonly radioTouched: boolean;
  /** Where the session stopped, e.g. a step name such as `block#57`. */
  readonly position: string;
  override readonly cause: unknown;

  constructor(init: { cause: unknown; radioTouched: boolean; position: string; message?: string }) {
    super(
      init.cause instanceof RadioIoError ? init.cause.code : 'protocol',
      init.message ?? describeCause(init.cause),
    );
    this.name = 'FirmwareFlashError';
    this.radioTouched = init.radioTouched;
    this.position = init.position;
    this.cause = init.cause;
  }
}
