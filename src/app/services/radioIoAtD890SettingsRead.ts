/**
 * AT-D890UV radio settings page: "Read a radio" (#1393).
 *
 * Opens a session, reads only what the page needs (LocalInfo, the settings spans, master ID, the
 * ident's band code), decodes it and closes the session. It writes nothing and offers no backup.
 *
 * ## Closing
 *
 * The session closes the orderly way, which sends `END`: the radio restarts (about 20 s) and, with
 * no write frame sent, changes nothing. Without `END` the radio would stay in PC mode until it is
 * power-cycled. Never log the serial, the master ID name or the power-on text.
 */

import { isMm9pdyAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  decodeAtD890RadioSettings,
  languageLockFromLocalInfo,
  type AtD890RadioSettingsSnapshot,
  type AtD890SettingsTarget,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import { decodeWideCharName } from '@integrations/radio-io/radios/at-d890uv/wideChar.ts';
import type { AtD890RadioSettingsRead } from '../state/atD890RadioSettingsSession.ts';
import { readAtD890RadioSettings } from './radioIoAtD890SettingsWrite.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
} from './radioIoSession.ts';

/** Shown after a settings Read: the radio has just been sent `END`. */
export const AT_D890_SETTINGS_READ_RESTART_NOTE =
  'The radio restarts after a read. Wait about 20 seconds before the next read or a Write.';

export function atD890SettingsTargetForEgress(egress: EgressPath): AtD890SettingsTarget {
  return isMm9pdyAtD890RadioIoProfileId(egress.profileId) ? 'mm9pdy' : 'stock';
}

/** Decode a snapshot into what the page stores. Pure. */
export function atD890SettingsReadFromSnapshot(
  snapshot: AtD890RadioSettingsSnapshot,
  target: AtD890SettingsTarget,
  readAt: number,
): AtD890RadioSettingsRead {
  return {
    serial: formatAtD890LocalInfoSerial(snapshot.localInfo),
    masterIdName: decodeWideCharName(snapshot.masterId.subarray(4, 0x24)),
    readAt,
    bandCode: snapshot.bandCode,
    languageLock: languageLockFromLocalInfo(snapshot.localInfo),
    decoded: decodeAtD890RadioSettings(snapshot, target),
  };
}

export type AtD890SettingsReadStage = 'connecting' | 'reading';

/**
 * Read the settings of a radio the user picks. Call it from the click handler: the port prompt
 * needs the user's activation, so nothing may be awaited before it.
 */
export async function readAtD890SettingsFromRadio(
  egress: EgressPath,
  opts?: { signal?: AbortSignal; onStage?: (stage: AtD890SettingsReadStage) => void },
): Promise<AtD890RadioSettingsRead> {
  const grantedPort = await grantRadioSerialPortForEgress({ forcePortSelection: true });
  opts?.onStage?.('connecting');
  const { session } = await openRadioSessionForEgress(egress, {
    grantedPort,
    purpose: 'read',
    signal: opts?.signal,
  });
  try {
    opts?.onStage?.('reading');
    const snapshot = await readAtD890RadioSettings(session, { signal: opts?.signal });
    return atD890SettingsReadFromSnapshot(
      snapshot,
      atD890SettingsTargetForEgress(egress),
      Date.now(),
    );
  } finally {
    await closeRadioSession(session);
  }
}
