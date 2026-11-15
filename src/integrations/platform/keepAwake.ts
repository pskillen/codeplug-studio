import { registerPlugin } from '@capacitor/core';

/** The in-repo Android plugin (`KeepAwakePlugin.java`): sets or clears FLAG_KEEP_SCREEN_ON on the app window. */
export interface KeepAwakePlugin {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

export const KeepAwake = registerPlugin<KeepAwakePlugin>('KeepAwake');
