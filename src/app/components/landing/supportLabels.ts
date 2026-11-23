import type { SupportEvidence, SupportPath, SupportState } from '@core/radio-targets/index.ts';

export const SUPPORT_STATE_LABEL: Record<SupportState, string> = {
  supported: 'Supported',
  partial: 'Partly supported',
  unsupported: 'Not supported',
  na: 'Not applicable',
};

export const SUPPORT_EVIDENCE_SHORT: Record<SupportEvidence, string> = {
  'on-air': 'on air',
  bench: 'bench',
  unverified: 'unverified',
};

export const SUPPORT_EVIDENCE_LABEL: Record<SupportEvidence, string> = {
  'on-air': 'Checked on the air',
  bench: 'Checked on the bench',
  unverified: 'Built in, not checked on this radio',
};

export const SUPPORT_PATH_LABEL: Record<SupportPath, string> = {
  cable: 'cable write',
  file: 'CPS file',
};

/** Tooltip: "DMR · Supported · cable write and CPS file · Checked on the bench: <source> · <note>". */
export function supportCellTitle(
  label: string,
  state: SupportState,
  extra?: {
    paths?: readonly SupportPath[];
    evidence?: SupportEvidence;
    evidenceSource?: string;
    note?: string;
  },
): string {
  const parts = [label, SUPPORT_STATE_LABEL[state]];
  if (extra?.paths?.length) {
    parts.push(extra.paths.map((p) => SUPPORT_PATH_LABEL[p]).join(' and '));
  }
  if (extra?.evidence) {
    parts.push(
      extra.evidenceSource
        ? `${SUPPORT_EVIDENCE_LABEL[extra.evidence]}: ${extra.evidenceSource}`
        : SUPPORT_EVIDENCE_LABEL[extra.evidence],
    );
  }
  if (extra?.note) parts.push(extra.note);
  return parts.join(' · ');
}