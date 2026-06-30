import { IndexedDbProjectPersistence } from '@integrations/persistence/index.ts';

/**
 * Single shared persistence instance for the app. One instance means one
 * IndexedDB connection and one local change-listener set, so writes from any
 * component notify every subscriber in this tab; BroadcastChannel handles other
 * tabs. Swap the implementation here to change the whole app's storage.
 */
export const persistence = new IndexedDbProjectPersistence();
