import { RadioUnsupportedError } from '../kit/errors.ts';

/** True when `navigator.serial` is present (Chromium-based browsers). */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial != null;
}

/**
 * Human-readable message for app chrome when Web Serial is unavailable.
 * Does not throw — callers decide whether to show UI or throw RadioUnsupportedError.
 */
export function getWebSerialUnsupportedMessage(): string {
  return 'Web Serial is not supported in this browser. Use Chrome or Edge on a desktop or laptop.';
}

/** Throws RadioUnsupportedError when Web Serial is missing. */
export function assertWebSerialSupported(): void {
  if (!isWebSerialSupported()) {
    throw new RadioUnsupportedError(getWebSerialUnsupportedMessage());
  }
}
