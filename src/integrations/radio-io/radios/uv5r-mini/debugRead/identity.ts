import {
  decodeUv5rMiniRadioReport,
  UV5RMINI_RADIO_REPORT_ADDRESS,
  UV5RMINI_RADIO_REPORT_LENGTH,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';
import {
  genericIdentityRows,
  type DebugIdentityInput,
  type DebugIdentityRows,
} from '../../../debugView/index.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

/** Overview rows for the UV-5R Mini: the generic rows plus the live MM9R report, when validated. */
export function uv5rMiniIdentityRows(input: DebugIdentityInput): DebugIdentityRows {
  const { archive } = input;
  const decoded = archive?.source === 'live-read' ? archive.regions.clone : undefined;
  const report =
    decoded?.length === UV5R_MINI_FULL_READ_SIZE
      ? decodeUv5rMiniRadioReport(
          decoded.subarray(
            UV5RMINI_RADIO_REPORT_ADDRESS,
            UV5RMINI_RADIO_REPORT_ADDRESS + UV5RMINI_RADIO_REPORT_LENGTH,
          ),
        )
      : undefined;
  return report?.kind === 'report'
    ? genericIdentityRows(input, {
        firmwareMod: 'MM9PDY compatible report',
        evidence: 'Validated live format-2 MM9R report',
      })
    : genericIdentityRows(input);
}

/** Hex region note for the Mini: the decoded clone, and packed offsets in the backup MEM entries. */
export function uv5rMiniRegionNote(regionId: string) {
  return {
    ...(regionId === 'clone' ? { representation: 'Decoded clone bytes' } : {}),
    ...(regionId.startsWith('mem-')
      ? { addressNote: 'Addresses shown are packed offsets, not radio addresses.' }
      : {}),
  };
}
