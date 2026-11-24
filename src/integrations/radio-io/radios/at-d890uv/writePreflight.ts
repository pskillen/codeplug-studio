/**
 * AT-D890UV Connect pre-flight: serial, firmware, interrupted-write state. Sends no frames.
 */

import { pushGeneralWarning } from '@core/import-export/exportWarning.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { RadioPreflightResult, RadioSession } from '../../types.ts';
import { getAtD890SessionSerial } from './programSession.ts';
import {
  AtD890PendingUnitsError,
  describeAtD890PendingUnits,
  findAtD890PendingBlock,
} from './pendingUnits.ts';
import { AtD890uvProtocol } from './protocol.ts';

export async function atD890WritePreflight(session: RadioSession): Promise<RadioPreflightResult> {
  const radio = session.radio;
  if (!(radio instanceof AtD890uvProtocol)) {
    return { identity: { model: session.descriptor.label }, rows: [] };
  }
  const band = radio.getIdentBandCode();
  const modelValue = band ? `${session.descriptor.label} (band ${band})` : session.descriptor.label;
  const serial = getAtD890SessionSerial(session.pipe);
  const firmware = radio.getDownloadCache()?.firmware;
  const identity = {
    model: session.descriptor.label,
    ...(serial ? { serial } : {}),
    ...(firmware ? { firmware } : {}),
  };
  const rows = [
    { label: 'Model', value: modelValue, status: 'ok' as const },
    {
      label: 'Serial',
      value: serial || 'not read',
      status: serial ? ('ok' as const) : ('warn' as const),
    },
    {
      label: 'Firmware',
      value: firmware ?? 'not reported',
      status: firmware ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Stun/kill', value: 'clear', status: 'ok' as const },
  ];
  const block = serial ? findAtD890PendingBlock(serial) : null;
  if (!block) {
    return {
      identity,
      rows: [...rows, { label: 'Interrupted write', value: 'none', status: 'ok' as const }],
    };
  }
  const unitsLine = `${block.units.length} erase unit${block.units.length === 1 ? '' : 's'}`;
  if (block.hard) {
    const refusal = new AtD890PendingUnitsError(block);
    return {
      identity,
      rows: [...rows, { label: 'Interrupted write', value: unitsLine, status: 'bad' as const }],
      refusal,
    };
  }
  const findings: ExportWarning[] = [];
  pushGeneralWarning(findings, describeAtD890PendingUnits(block));
  return {
    identity,
    rows: [...rows, { label: 'Interrupted write', value: unitsLine, status: 'warn' as const }],
    findings,
  };
}
