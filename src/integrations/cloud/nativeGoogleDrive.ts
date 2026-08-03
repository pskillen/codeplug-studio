import { createGoogleDrivePort } from './googleDrive.ts';
import { createNativeAuthProvider, getGoogleAndroidClientId } from './nativeGoogleAuth.ts';
import {
  closeNativeAuthorizationBrowser,
  openNativeAuthorizationUrl,
  waitForAuthorizationCode,
} from './nativeAuthRedirect.ts';

export function createNativeGoogleDrivePort() {
  return createGoogleDrivePort({
    authProvider: createNativeAuthProvider({
      openAuthorizationUrl: openNativeAuthorizationUrl,
      waitForAuthorizationCode,
      closeBrowser: closeNativeAuthorizationBrowser,
    }),
    getClientId: getGoogleAndroidClientId,
  });
}
