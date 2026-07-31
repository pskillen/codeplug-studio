import { Capacitor } from '@capacitor/core';
import { RadioUnsupportedError } from '../kit/errors.ts';

/** True when running on a Capacitor native platform (e.g. Android OTG). */
export function isCapacitorSerialSupported(): boolean {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
}

/** True when `navigator.serial` is present (Chromium-based browsers). */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial != null;
}

/** True when either Web Serial (desktop) or Capacitor native USB serial (mobile) is available. */
export function isRadioSerialSupported(): boolean {
  return isWebSerialSupported() || isCapacitorSerialSupported();
}

/**
 * Human-readable message for app chrome when radio serial is unavailable.
 * Does not throw — callers decide whether to show UI or throw RadioUnsupportedError.
 */
export function getRadioSerialUnsupportedMessage(): string {
  if (isCapacitorSerialSupported()) {
    return 'USB serial is unavailable or unsupported on this native device.';
  }
  return 'Radio serial connection is not supported in this browser. On desktop, use Chrome or Edge. On Android, use the Codeplug Studio companion app with a USB-OTG adapter.';
}

/** Human-readable message for app chrome when Web Serial is unavailable. */
export function getWebSerialUnsupportedMessage(): string {
  return getRadioSerialUnsupportedMessage();
}

/** Throws RadioUnsupportedError when radio serial is missing. */
export function assertRadioSerialSupported(): void {
  if (!isRadioSerialSupported()) {
    throw new RadioUnsupportedError(getRadioSerialUnsupportedMessage());
  }
}

/** Throws RadioUnsupportedError when Web Serial is missing. */
export function assertWebSerialSupported(): void {
  assertRadioSerialSupported();
}
