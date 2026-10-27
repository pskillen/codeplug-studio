/** The new-range list (step 2): every range, with what changes against the current one. Pure. */

import {
  atD890RangeChangeTargets,
  atD890ReceiveNarrower,
  atD890TxChangeSummary,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { COPY, rxText, txText } from './rangeChangeCopy.ts';
import type { RangeChangeTargetRow } from './types.ts';

export function buildRangeRows(
  currentCode: number,
  maintenanceUnlocked: boolean,
): RangeChangeTargetRow[] {
  return atD890RangeChangeTargets(currentCode, { maintenanceUnlocked }).map((t) => {
    const sum = atD890TxChangeSummary(currentCode, t.code);
    const same = rxText(t.code) === rxText(currentCode);
    return {
      code: t.code,
      caption: t.caption,
      current: t.isCurrent,
      selectable: !t.isCurrent && t.available,
      ...(!t.available ? { disabledReason: COPY.newRange.code14Reason } : {}),
      unlisted: t.unlisted,
      transmitLine: t.isCurrent
        ? `Transmit ${txText(t.code)}`
        : `Transmit ${sum.to} (was ${sum.from})`,
      receiveLine: same ? COPY.newRange.receiveSame : `Receive ${rxText(t.code)}`,
      ...(t.isCurrent ? {} : { direction: t.txChange }),
      uhfOff: t.uhfTxInhibited,
      narrowReceive: !t.isCurrent && atD890ReceiveNarrower(currentCode, t.code),
      raw: t,
    };
  });
}
