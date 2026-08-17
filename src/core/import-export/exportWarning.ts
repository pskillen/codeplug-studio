import type { WireNameRemediation } from '@core/services/resolveWireNames.ts';

/** Whether an export warning blocks a clean export (`problem`) or is a benign, collapsed note (`info`). */
export type ExportWarningSeverity = 'problem' | 'info';

/**
 * Grouping keys mirrored from the UI's member-cap presentation
 * (`src/app/components/builds/formatExportWarnings.ts`). Kept here — not in `src/app/` —
 * because `ExportWarning` itself lives in core; the UI module re-exports this type.
 */
export type MemberCapWarningKind =
  | 'zone-expanded-scan-cap'
  | 'zone-expanded-cap'
  | 'zone-members-export'
  | 'zone-scan-list-truncated'
  | 'scan-list-expanded-cap'
  | 'rx-group-list-members';

export interface WireNameExportWarning {
  kind: 'wire_name';
  severity: ExportWarningSeverity;
  remediation: WireNameRemediation;
  entityKind: string;
  original: string;
  exported: string;
  limit: number;
  profileLabel?: string;
}

export interface MemberCapExportWarning {
  kind: 'member_cap';
  severity: 'problem';
  capKind: MemberCapWarningKind;
  label: string;
  count: number;
  cap: number;
  truncatedFrom?: number;
  profileLabel?: string;
}

export interface UnlinkedExportWarning {
  kind: 'unlinked';
  severity: 'problem';
  message: string;
}

export interface GeneralExportWarning {
  kind: 'general';
  severity: 'problem';
  message: string;
}

/** Structured export/write warning — replaces the old free-text `warnings: string[]` channel. */
export type ExportWarning =
  WireNameExportWarning | MemberCapExportWarning | UnlinkedExportWarning | GeneralExportWarning;

/** Push a plain informational/problem note with no further structure. */
export function pushGeneralWarning(warnings: ExportWarning[], message: string): void {
  warnings.push({ kind: 'general', severity: 'problem', message });
}

/** Push a member/element cardinality-cap warning (zone/scan-list/RX-group-list caps and truncation). */
export function pushMemberCapWarning(
  warnings: ExportWarning[],
  params: {
    capKind: MemberCapWarningKind;
    label: string;
    count: number;
    cap: number;
    truncatedFrom?: number;
    profileLabel?: string;
  },
): void {
  warnings.push({ kind: 'member_cap', severity: 'problem', ...params });
}

/** Push an "orphan entities included at export" note (assemble-time). */
export function pushUnlinkedWarning(warnings: ExportWarning[], message: string): void {
  warnings.push({ kind: 'unlinked', severity: 'problem', message });
}

/** Render a warning back to a single sentence — for logs and test assertions. UI must not parse this. */
export function formatExportWarning(warning: ExportWarning): string {
  switch (warning.kind) {
    case 'wire_name': {
      const profileSuffix = warning.profileLabel ? ` for ${warning.profileLabel}` : '';
      switch (warning.remediation) {
        case 'disambiguated':
          return `${warning.entityKind} wire name "${warning.original}" collided with another exported name; disambiguated as "${warning.exported}"`;
        case 'shortened':
          return `${warning.entityKind} wire name "${warning.original}" exceeds ${warning.limit} characters${profileSuffix}; exported as "${warning.exported}"`;
        case 'truncated':
          return `${warning.entityKind} wire name "${warning.original}" exceeds ${warning.limit} characters${profileSuffix}; shortened to "${warning.exported}" still exceeds limit`;
        case 'over_limit':
        case 'none':
        default:
          return `${warning.entityKind} wire name "${warning.original}" exceeds ${warning.limit} characters${profileSuffix}`;
      }
    }
    case 'member_cap': {
      if (warning.capKind === 'zone-scan-list-truncated' && warning.truncatedFrom != null) {
        return `Zone "${warning.label}" scan list truncated from ${warning.truncatedFrom} to ${warning.cap} members`;
      }
      return `"${warning.label}" — ${warning.count} members (cap ${warning.cap})`;
    }
    case 'unlinked':
    case 'general':
      return warning.message;
  }
}

/** Stable identity key for deduping — same shape regardless of message phrasing. */
export function exportWarningIdentity(warning: ExportWarning): string {
  switch (warning.kind) {
    case 'wire_name':
      return [
        'wire_name',
        warning.remediation,
        warning.entityKind,
        warning.original,
        warning.exported,
        warning.limit,
        warning.profileLabel ?? '',
      ].join('\0');
    case 'member_cap':
      return [
        'member_cap',
        warning.capKind,
        warning.label,
        warning.count,
        warning.cap,
        warning.truncatedFrom ?? '',
        warning.profileLabel ?? '',
      ].join('\0');
    case 'unlinked':
      return `unlinked\0${warning.message}`;
    case 'general':
      return `general\0${warning.message}`;
  }
}
