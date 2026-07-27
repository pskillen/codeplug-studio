/**
 * AT-D890UV config-region alias probe (#792).
 *
 * Read-only pairwise comparison: if address `A` and `A + stride` return identical
 * non-trivial bytes, they share one physical cell. Dual all-`0xff` spans are
 * inconclusive — they could be one erased cell or two.
 */

import { AT_D890_LIMITS, D890_MAP } from './constants.ts';

/** Candidate aliasing period measured in ChannelData; config units use the same stride. */
export const AT_D890_CONFIG_ALIAS_STRIDE = 0x4_0000;

export const AT_D890_CONFIG_ALIAS_PAIRS = [
  {
    id: 'localInfo',
    label: 'LocalInfo',
    base: D890_MAP.LocalInfo,
    aliasCandidate: D890_MAP.LocalInfo + AT_D890_CONFIG_ALIAS_STRIDE,
    length: D890_MAP.LocalInfoLength,
    eraseUnit: 0x4f8_0000,
    note: 'Serial and dates densely populated — unambiguous anchor.',
  },
  {
    id: 'optionalSettingsMain',
    label: 'Optional settings (main)',
    base: D890_MAP.OptionalSettingsMain,
    aliasCandidate: D890_MAP.OptionalSettingsMain + AT_D890_CONFIG_ALIAS_STRIDE,
    length: D890_MAP.OptionalSettingsMainLength,
    eraseUnit: 0x350_0000,
    note: 'Erase unit PR5 sparse RMW must preserve.',
  },
  {
    id: 'channelSet',
    label: 'ChannelSet',
    base: D890_MAP.ChannelSet,
    aliasCandidate: D890_MAP.ChannelSet + AT_D890_CONFIG_ALIAS_STRIDE,
    length: AT_D890_LIMITS.CHANNEL_SET_BYTES,
    eraseUnit: 0x348_0000,
    note: 'Collides with alarm regions inside the same erase unit.',
  },
] as const;

export type AtD890ConfigAliasPairId = (typeof AT_D890_CONFIG_ALIAS_PAIRS)[number]['id'];

export type AtD890ConfigAliasStatus = 'flat' | 'aliased' | 'inconclusive_both_erased';

export interface AtD890ConfigAliasPairResult {
  id: AtD890ConfigAliasPairId;
  label: string;
  base: number;
  aliasCandidate: number;
  length: number;
  eraseUnit: number;
  status: AtD890ConfigAliasStatus;
  nonFfBytesBase: number;
  nonFfBytesAlias: number;
  note: string;
}

export type AtD890SparseRmwGate = 'proceed' | 'replan' | 'partial';

export interface AtD890ConfigAliasReport {
  pairs: AtD890ConfigAliasPairResult[];
  /** Whether sparse erase-unit RMW may proceed as designed. */
  sparseRmwGate: AtD890SparseRmwGate;
  summary: string;
}

function countNonFfBytes(data: Uint8Array): number {
  let count = 0;
  for (const b of data) {
    if (b !== 0xff) count += 1;
  }
  return count;
}

function isAllFf(data: Uint8Array): boolean {
  return data.every((b) => b === 0xff);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
}

export function analyseAtD890ConfigAliasPair(
  baseBytes: Uint8Array,
  aliasBytes: Uint8Array,
): Pick<AtD890ConfigAliasPairResult, 'status' | 'nonFfBytesBase' | 'nonFfBytesAlias'> {
  const nonFfBytesBase = countNonFfBytes(baseBytes);
  const nonFfBytesAlias = countNonFfBytes(aliasBytes);

  if (isAllFf(baseBytes) && isAllFf(aliasBytes)) {
    return { status: 'inconclusive_both_erased', nonFfBytesBase, nonFfBytesAlias };
  }
  if (bytesEqual(baseBytes, aliasBytes) && nonFfBytesBase > 0) {
    return { status: 'aliased', nonFfBytesBase, nonFfBytesAlias };
  }
  return { status: 'flat', nonFfBytesBase, nonFfBytesAlias };
}

export function analyseAtD890ConfigAliasReport(
  readings: readonly {
    id: AtD890ConfigAliasPairId;
    baseBytes: Uint8Array;
    aliasBytes: Uint8Array;
  }[],
): AtD890ConfigAliasReport {
  const pairs = readings.map((reading) => {
    const spec = AT_D890_CONFIG_ALIAS_PAIRS.find((p) => p.id === reading.id);
    if (!spec) {
      throw new RangeError(`Unknown config alias pair id: ${reading.id}`);
    }
    const verdict = analyseAtD890ConfigAliasPair(reading.baseBytes, reading.aliasBytes);
    return {
      id: spec.id,
      label: spec.label,
      base: spec.base,
      aliasCandidate: spec.aliasCandidate,
      length: spec.length,
      eraseUnit: spec.eraseUnit,
      note: spec.note,
      ...verdict,
    };
  });

  const localInfo = pairs.find((p) => p.id === 'localInfo');
  const anyAliased = pairs.some((p) => p.status === 'aliased');
  const allFlat = pairs.every((p) => p.status === 'flat');

  let sparseRmwGate: AtD890SparseRmwGate;
  let summary: string;

  if (anyAliased) {
    sparseRmwGate = 'replan';
    summary =
      'At least one region aliases at +0x40000 — stop and re-plan sparse erase-unit RMW before coding PR5.';
  } else if (allFlat) {
    sparseRmwGate = 'proceed';
    summary = 'All probed regions are flat at +0x40000 — sparse erase-unit RMW may proceed as designed.';
  } else if (localInfo?.status === 'flat') {
    sparseRmwGate = 'partial';
    summary =
      'LocalInfo is flat but other regions are inconclusive (both erased). PR5 may proceed with LocalInfo as anchor; erased optional/alarm spans cannot disprove aliasing.';
  } else if (localInfo?.status === 'aliased') {
    sparseRmwGate = 'replan';
    summary =
      'LocalInfo aliases at +0x40000 — address space mirrors beyond ChannelData; re-plan PR4 and PR5.';
  } else {
    sparseRmwGate = 'partial';
    summary =
      'No decisive verdict — restore with CPS and retry. LocalInfo must not read all 0xff on both sides.';
  }

  return { pairs, sparseRmwGate, summary };
}

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

function statusLabel(status: AtD890ConfigAliasStatus): string {
  switch (status) {
    case 'flat':
      return 'flat';
    case 'aliased':
      return 'aliased';
    case 'inconclusive_both_erased':
      return 'inconclusive — both erased';
  }
}

/** Copy-paste block for tier-3 docs or a GitHub issue comment. */
export function formatAtD890ConfigAliasMarkdown(
  report: AtD890ConfigAliasReport,
  meta: { measuredAt: string; model: string; readBlockSize: number },
): string {
  const lines = [
    '### Config-region alias probe (#792)',
    '',
    `Measured: ${meta.measuredAt} · radio: ${meta.model} · read block: ${meta.readBlockSize} bytes`,
    '',
    `**PR5 gate:** ${report.sparseRmwGate} — ${report.summary}`,
    '',
    '| Region | Base | Alias (+0x40000) | Status | non-0xff (base / alias) |',
    '| --- | --- | --- | --- | --- |',
    ...report.pairs.map(
      (p) =>
        `| ${p.label} | ${hex(p.base)} | ${hex(p.aliasCandidate)} | ${statusLabel(p.status)} | ${p.nonFfBytesBase} / ${p.nonFfBytesAlias} |`,
    ),
    '',
    'Dual all-0xff spans are inconclusive, never flat.',
  ];
  return lines.join('\n');
}
