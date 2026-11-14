/**
 * Typed errors for radio I/O transport and protocol kit.
 * App / radio modules catch by `name` or `code`.
 */

export type RadioIoErrorCode =
  | 'timeout'
  | 'closed'
  | 'noResponse'
  | 'wrongIdent'
  | 'protocol'
  | 'aborted'
  | 'unsupported'
  | 'interlock'
  | 'alreadyInstalled'
  | 'nothingInstalled'
  | 'needsConfirm';

export class RadioIoError extends Error {
  readonly code: RadioIoErrorCode;
  /**
   * Copyable debug text a protocol attaches when it fails (for example the last radio frames).
   * The UI shows it next to the message; it is never part of `message`.
   */
  debugText?: string;

  constructor(code: RadioIoErrorCode, message: string) {
    super(message);
    this.name = 'RadioIoError';
    this.code = code;
  }
}

export class RadioTimeoutError extends RadioIoError {
  constructor(message = 'Radio I/O timed out waiting for bytes.') {
    super('timeout', message);
    this.name = 'RadioTimeoutError';
  }
}

export class RadioClosedError extends RadioIoError {
  constructor(message = 'Serial pipe closed unexpectedly.') {
    super('closed', message);
    this.name = 'RadioClosedError';
  }
}

export class RadioNoResponseError extends RadioIoError {
  constructor(message = 'Radio did not respond.') {
    super('noResponse', message);
    this.name = 'RadioNoResponseError';
  }
}

export class RadioWrongIdentError extends RadioIoError {
  constructor(message = 'Radio identity did not match the selected model.') {
    super('wrongIdent', message);
    this.name = 'RadioWrongIdentError';
  }
}

export class RadioProtocolError extends RadioIoError {
  constructor(message = 'Unexpected radio protocol response.') {
    super('protocol', message);
    this.name = 'RadioProtocolError';
  }
}

export class RadioAbortedError extends RadioIoError {
  constructor(message = 'Radio I/O operation was aborted.') {
    super('aborted', message);
    this.name = 'RadioAbortedError';
  }
}

export class RadioUnsupportedError extends RadioIoError {
  constructor(message = 'Web Serial is not available in this browser.') {
    super('unsupported', message);
    this.name = 'RadioUnsupportedError';
  }
}

/**
 * A hard safety interlock refused the operation (firmware flashing). Never retried, never swallowed.
 * See DESIGN.md — Firmware flashing.
 */
/**
 * The radio's loader asked for bytes past the image before it announced any erase: its installed app already matches
 * this image, so it plans nothing to write. Nothing was erased or written; the radio boots the installed app.
 */
export class RadioAlreadyInstalledError extends RadioIoError {
  constructor(message: string) {
    super('alreadyInstalled', message);
    this.name = 'RadioAlreadyInstalledError';
  }
}

/**
 * The radio refused the image before installing anything, in a way that says the file is for the other flash layout
 * (UV-5R Mini: the loader's `0x8F`, or the app's `0x83` with no erase announced). Nothing was erased or written; the
 * radio boots its installed app. The radio's update stage may already have reset some settings. Not a "recover the
 * radio" failure, even though the loader ran; the caller may offer the release's other layout's file, once, with the
 * operator re-entering update mode.
 */
export class RadioNothingInstalledError extends RadioIoError {
  constructor(message: string) {
    super('nothingInstalled', message);
    this.name = 'RadioNothingInstalledError';
  }
}

/**
 * Not a refusal: the operation is allowed, but only after the operator has read this warning and confirmed it
 * (firmware flashing: rewriting the build the radio already runs). Nothing has been sent. The caller shows the message
 * with an explicit confirm and runs the check again with the confirmation set.
 */
export class RadioConfirmRequiredError extends RadioIoError {
  constructor(message: string) {
    super('needsConfirm', message);
    this.name = 'RadioConfirmRequiredError';
  }
}

export class RadioInterlockError extends RadioIoError {
  constructor(message: string) {
    super('interlock', message);
    this.name = 'RadioInterlockError';
  }
}
