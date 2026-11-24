/**
 * Opens and closes one radio session for a Brandmeister AirSecurity check, write, or clear.
 *
 * The port grant is the first await so the browser still has the click. A write or a clear does
 * not read the record back: the caller shows what it just sent. The encoded record is zeroed
 * inside the write; this module does not keep the seed.
 */

import type { EgressPath } from '@core/models/egressPath.ts';
import {
  readAtD890AirSecuritySeedSet,
  writeAtD890AirSecuritySeed,
} from './radioIoAtD890AirSecurity.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
} from './radioIoSession.ts';

/** Read whether a seed is set, then close the session. */
export async function checkAtD890AirSecuritySeed(
  egress: EgressPath,
  opts?: { signal?: AbortSignal },
): Promise<boolean> {
  const grantedPort = await grantRadioSerialPortForEgress({ forcePortSelection: true });
  const { session } = await openRadioSessionForEgress(egress, {
    grantedPort,
    purpose: 'read',
    signal: opts?.signal,
  });
  try {
    return await readAtD890AirSecuritySeedSet(session, opts);
  } finally {
    await closeRadioSession(session);
  }
}

/**
 * Write `seed`, or clear the record when `seed` is null, then close the session.
 * Does not read the radio afterwards. The write's return value is ignored.
 */
export async function writeAtD890AirSecuritySeedOnRadio(
  egress: EgressPath,
  seed: Uint8Array | null,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const grantedPort = await grantRadioSerialPortForEgress({ forcePortSelection: true });
  const { session } = await openRadioSessionForEgress(egress, {
    grantedPort,
    purpose: 'write',
    signal: opts?.signal,
  });
  try {
    await writeAtD890AirSecuritySeed(session, egress, seed, opts);
  } finally {
    await closeRadioSession(session);
  }
}
