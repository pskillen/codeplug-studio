import { isNativeApp } from '../platform/isNativeApp.ts';
import { getGoogleClientId } from './loadGoogleIdentity.ts';
import { getGoogleAndroidClientId } from './nativeGoogleAuth.ts';

export function getActiveGoogleClientId(): string {
  return isNativeApp() ? getGoogleAndroidClientId() : getGoogleClientId();
}
