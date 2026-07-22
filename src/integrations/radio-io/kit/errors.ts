/**
 * Typed errors for radio I/O transport and protocol kit.
 * App / radio modules catch by `name` or `code`.
 */

export type RadioIoErrorCode =
  'timeout' | 'closed' | 'noResponse' | 'wrongIdent' | 'protocol' | 'aborted' | 'unsupported';

export class RadioIoError extends Error {
  readonly code: RadioIoErrorCode;

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
