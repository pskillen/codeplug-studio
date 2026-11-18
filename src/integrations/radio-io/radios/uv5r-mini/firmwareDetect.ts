import {
  decodeUv5rMiniRadioReport,
  UV5RMINI_UNKNOWN_FORMAT_REFUSAL,
  UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
  type Uv5rMiniRadioReport,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';

import { MMZ1_MAGIC, MMZ1_VERSION } from './modData/layout.ts';
import { UV5R_MINI_MM9PDY_PROFILE_ID } from './zoneBackup.ts';

export type Uv5rMiniFirmwareDetection =
  | { kind: 'stock' }
  | {
      kind: 'mm9pdy';
      evidence: 'report' | 'zone-table';
      report?: Extract<Uv5rMiniRadioReport, { kind: 'report' }>;
    }
  | { kind: 'unsupported'; reason: string };

/** Classify the decoded header and report frames without reading or changing the radio. */
export function classifyUv5rMiniFirmware(input: {
  header: Uint8Array;
  report: Uint8Array;
}): Uv5rMiniFirmwareDetection {
  const report = decodeUv5rMiniRadioReport(input.report);
  switch (report.kind) {
    case 'report':
      return { kind: 'mm9pdy', evidence: 'report', report };
    case 'unknownFormat':
      return { kind: 'unsupported', reason: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(report.format) };
    case 'unknownLayout':
      return { kind: 'unsupported', reason: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL };
    case 'invalid':
      return {
        kind: 'unsupported',
        reason: `The radio's firmware report is unreadable: ${report.reason}. Nothing was changed.`,
      };
    case 'stock':
      return [...MMZ1_MAGIC].every((c, i) => input.header[i] === c.charCodeAt(0)) &&
        input.header[4] === MMZ1_VERSION
        ? { kind: 'mm9pdy', evidence: 'zone-table' }
        : { kind: 'stock' };
  }
}

/** The Web Serial profile selected by a supported detection. */
export function uv5rMiniProfileIdForDetection(
  detection: Uv5rMiniFirmwareDetection,
): string | undefined {
  switch (detection.kind) {
    case 'stock':
      return 'radio-io-uv5r-mini';
    case 'mm9pdy':
      return UV5R_MINI_MM9PDY_PROFILE_ID;
    case 'unsupported':
      return undefined;
  }
}
