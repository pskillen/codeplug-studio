import type { WriteVerifyResult } from '@integrations/radio-io/writeVerify.ts';
import type {
  WriteVerifyReportProps as V2WriteVerifyReportProps,
  WriteVerifyReportRow,
  WriteVerifyReportSummaryItem,
} from '../v2/WriteVerifyReport.tsx';

function regionTone(status: string): WriteVerifyReportRow['tone'] {
  if (status === 'match') return 'success';
  if (status === 'mismatch') return 'warning';
  if (status === 'not_read') return 'warning';
  return 'neutral';
}

/**
 * Maps domain {@link WriteVerifyResult} into v2 {@link WriteVerifyReport} props (R1).
 */
export function mapWriteVerifyResultToV2Report(
  result: WriteVerifyResult,
): Pick<V2WriteVerifyReportProps, 'summary' | 'rows' | 'caption'> {
  const summary: WriteVerifyReportSummaryItem[] = [
    {
      value: result.staging.totalChunks,
      label: 'Staged chunks',
    },
    {
      value: result.staging.mismatchedChunks,
      label: 'Mismatches',
      tone: result.staging.mismatchedChunks > 0 ? 'warning' : 'default',
    },
    {
      value: result.regions.filter((r) => r.status === 'match').length,
      label: 'Regions match',
    },
  ];

  const rows: WriteVerifyReportRow[] = result.regions.slice(0, 80).map((region) => ({
    id: region.id,
    tone: regionTone(region.status),
    label: region.label,
    detail: region.status,
  }));

  const caption =
    result.regions.length > rows.length
      ? `${result.regions.length - rows.length} more regions not shown — open full report for detail.`
      : undefined;

  return { summary, rows, caption };
}
