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
  /** `info` for benign notes (e.g. MM9PDY channel position counts); shown apart from problems. */
  severity: ExportWarningSeverity;
  message: string;
}

/**
 * Zone scan sets ("Scan in this zone") on radios with the zone scan set trait. Each warns and
 * never refuses. The radio supplies `reason` (how it knows its firmware is too old) and the room
 * figures; see `@core/import-export/zoneScanSets`.
 */
export type ZoneScanSetWarningDetail =
  | {
      /** A zone's scan set has fewer than two channels on the radio: the zone won't scan. */
      issue: 'too-few';
      zoneName: string;
      count: number;
    }
  | {
      /** Firmware compatibility warning, with radio-specific wording when sets are still written. */
      issue: 'firmware-too-old';
      reason: string;
      /** Radio-specific wording when the sets are still written or the version is unknown. */
      message?: string;
    }
  | {
      /** The radio's room for scan sets is exceeded. */
      issue: 'room-exceeded';
      limit: number;
      needed: number;
      unit: string;
      consequence: string;
    };

export type ZoneScanSetExportWarning = {
  kind: 'zone_scan_set';
  severity: 'problem';
} & ZoneScanSetWarningDetail;

/** Structured export/write warning — replaces the old free-text `warnings: string[]` channel. */
export type ExportWarning =
  | WireNameExportWarning
  | MemberCapExportWarning
  | UnlinkedExportWarning
  | GeneralExportWarning
  | ZoneScanSetExportWarning;

/** Push a plain informational/problem note with no further structure. */
export function pushGeneralWarning(warnings: ExportWarning[], message: string): void {
  warnings.push({ kind: 'general', severity: 'problem', message });
}

/** Push a benign informational note — rendered apart from the problem list. */
export function pushGeneralInfoWarning(warnings: ExportWarning[], message: string): void {
  warnings.push({ kind: 'general', severity: 'info', message });
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

/** Push a zone scan set warning (too few channels, firmware too old, room exceeded). */
export function pushZoneScanSetWarning(
  warnings: ExportWarning[],
  detail: ZoneScanSetWarningDetail,
): void {
  warnings.push({ kind: 'zone_scan_set', severity: 'problem', ...detail });
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
    case 'zone_scan_set':
      return formatZoneScanSetWarning(warning);
  }
}

function formatZoneScanSetWarning(warning: ZoneScanSetExportWarning): string {
  switch (warning.issue) {
    case 'too-few': {
      const channels = warning.count === 1 ? 'channel' : 'channels';
      return `Zone "${warning.zoneName}" has ${warning.count} ${channels} set to Scan in this zone, so this zone won't scan on the radio. Set at least two of its channels to Scan in this zone.`;
    }
    case 'firmware-too-old':
      return (
        warning.message ??
        `The radio's firmware is too old for zone scan sets (${warning.reason}). They were not written, and its zones scan as before.`
      );
    case 'room-exceeded':
      return `The zone scan sets need ${warning.needed} ${warning.unit}, but the radio holds ${warning.limit}. ${warning.consequence}`;
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
    case 'zone_scan_set':
      return `zone_scan_set\0${formatZoneScanSetWarning(warning)}`;
  }
}
