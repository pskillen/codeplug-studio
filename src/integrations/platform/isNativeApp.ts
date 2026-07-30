import { Capacitor } from '@capacitor/core';

/** Returns true when running inside a Capacitor native app shell (Android/iOS). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
