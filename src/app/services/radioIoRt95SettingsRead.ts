/**
 * RT95 radio settings page: read a connected radio (#1476).
 */

import type { EgressPath } from '@core/models/egressPath.ts';
import {
  decodeRt95RadioSettings,
  readRt95SettingsSnapshotFromImage,
} from '@integrations/radio-io/radios/rt95/settingsCodec.ts';
import type { Rt95RadioSettingsSnapshot } from '@integrations/radio-io/radios/rt95/settingsFields.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
} from './radioIoSession.ts';
import {
  readRt95SettingsSnapshot,
  rt95SettingsTargetForEgress,
} from './radioIoRt95SettingsWrite.ts';

export interface Rt95RadioSettingsRead {
  readonly readAt: number;
  readonly bandlimit: number;
  readonly decoded: ReturnType<typeof decodeRt95RadioSettings>;
}

export function rt95SettingsReadFromSnapshot(
  snapshot: Rt95RadioSettingsSnapshot,
  egress: EgressPath,
  readAt: number,
): Rt95RadioSettingsRead {
  const target = rt95SettingsTargetForEgress(egress);
  return {
    readAt,
    bandlimit: snapshot.bandlimit,
    decoded: decodeRt95RadioSettings(snapshot, target),
  };
}

export type Rt95SettingsReadStage = 'connecting' | 'reading';

export async function readRt95SettingsFromRadio(
  egress: EgressPath,
  opts?: { signal?: AbortSignal; onStage?: (stage: Rt95SettingsReadStage) => void },
): Promise<Rt95RadioSettingsRead> {
  const grantedPort = await grantRadioSerialPortForEgress({ forcePortSelection: true });
  opts?.onStage?.('connecting');
  const { session } = await openRadioSessionForEgress(egress, {
    grantedPort,
    purpose: 'read',
    signal: opts?.signal,
  });
  try {
    opts?.onStage?.('reading');
    const snapshot = await readRt95SettingsSnapshot(session, { signal: opts?.signal });
    return rt95SettingsReadFromSnapshot(snapshot, egress, Date.now());
  } finally {
    await closeRadioSession(session);
  }
}

export { readRt95SettingsSnapshotFromImage };
