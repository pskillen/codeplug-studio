import type { AprsChannelSlot, AprsConfiguration } from '@core/models/aprs.ts';
import type { AprsSlotCallType } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

export const DM32_APRS_GUIDE_FILE_NAME = 'APRS.md' as const;

export const DM32_APRS_GUIDE_TIP =
  'Baofeng DM-32 CPS has no APRS.csv; set global APRS fields in CPS using APRS.md included in this export';

const MAX_REPORT_CHANNELS = 8;

export interface Dm32AprsReportChannelLine {
  index: number;
  wireName: string;
}

export interface Dm32AprsGuideSummary {
  configName: string;
  manualTxIntervalSec: number | null;
  autoTxIntervalSec: number | null;
  /** CPS single Call type — from first contributing slot. */
  callType: AprsSlotCallType | null;
  /** CPS Upload number (DMR ID) — from first contributing slot. */
  uploadNumber: number | null;
  reportChannels: Dm32AprsReportChannelLine[];
  warnings: string[];
  markdown: string;
}

function formatInterval(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '(not set)';
  return `${Math.trunc(seconds)} s`;
}

function formatCallTypeLabel(callType: AprsSlotCallType | null): string {
  if (callType === 'private') return 'Private';
  if (callType === 'group') return 'Group';
  return '(not set)';
}

function formatUploadNumber(id: number | null): string {
  if (id == null || !Number.isFinite(id)) return '(not set)';
  return String(Math.trunc(id));
}

function slotIsContributing(slot: AprsChannelSlot): boolean {
  return slot.channelRef != null || slot.targetDmrId != null || slot.timeslot != null;
}

function resolveSlotWireName(
  slot: AprsChannelSlot,
  wireNameById: Map<string, string>,
  warnings: string[],
  slotIndex: number,
): string {
  if (slot.channelRef == null) return 'Current Channel';
  const wireName = wireNameById.get(slot.channelRef.id);
  if (wireName == null) {
    warnings.push(
      `APRS report channel ${slotIndex} references a channel that is not in this DM32 export; shown as missing in APRS.md`,
    );
    return '(missing from export)';
  }
  return wireName;
}

/**
 * Build operator-facing CPS setup guide for DM32 (no APRS.csv in v1.60).
 * Returns null when there is no library APRS configuration.
 */
export function buildDm32AprsGuide(assembled: AssembledBuild): Dm32AprsGuideSummary | null {
  const config = assembled.aprsConfiguration;
  if (config == null) return null;

  const warnings: string[] = [];
  const wireNameById = new Map(assembled.channels.map((row) => [row.entity.id, row.wireName]));

  const contributing = config.channelSlots
    .map((slot, i) => ({ slot, index: i + 1 }))
    .filter(({ slot }) => slotIsContributing(slot));

  const consensusSource = contributing[0]?.slot ?? config.channelSlots[0] ?? null;
  const callType = consensusSource?.callType ?? null;
  const uploadNumber = consensusSource?.targetDmrId ?? null;

  for (const { slot, index } of contributing.slice(1)) {
    if (slot.callType !== callType) {
      warnings.push(
        `APRS slots disagree on call type (CPS supports one value); APRS.md uses slot 1 — check slot ${index}`,
      );
    }
    if (slot.targetDmrId !== uploadNumber) {
      warnings.push(
        `APRS slots disagree on upload DMR ID (CPS supports one value); APRS.md uses slot 1 — check slot ${index}`,
      );
    }
  }

  const reportChannels: Dm32AprsReportChannelLine[] = [];
  for (let i = 0; i < MAX_REPORT_CHANNELS; i++) {
    const slot = config.channelSlots[i];
    const index = i + 1;
    if (!slot) {
      reportChannels.push({ index, wireName: '(empty)' });
      continue;
    }
    reportChannels.push({
      index,
      wireName: resolveSlotWireName(slot, wireNameById, warnings, index),
    });
  }

  if (config.channelSlots.length > MAX_REPORT_CHANNELS) {
    warnings.push(
      `APRS configuration has ${config.channelSlots.length} channel slots; APRS.md lists the first ${MAX_REPORT_CHANNELS} only`,
    );
  }

  const summary: Omit<Dm32AprsGuideSummary, 'markdown'> = {
    configName: config.name.trim() || 'APRS',
    manualTxIntervalSec: config.manualTxIntervalSec,
    autoTxIntervalSec: config.autoTxIntervalSec,
    callType,
    uploadNumber,
    reportChannels,
    warnings,
  };

  return {
    ...summary,
    markdown: formatDm32AprsGuideMarkdown(summary, config),
  };
}

export function formatDm32AprsGuideMarkdown(
  summary: Omit<Dm32AprsGuideSummary, 'markdown'>,
  config: AprsConfiguration,
): string {
  const lines: string[] = [
    `# DM-32 APRS setup (${summary.configName})`,
    '',
    'Baofeng DM-32UV CPS v1.60 does **not** import or export an `APRS.csv` file.',
    'After importing the CSV bundle from Codeplug Studio, open **APRS** in CPS and set the fields below.',
    '',
    '## Global fields (one set in CPS)',
    '',
    '| CPS field | Suggested value | Notes |',
    '| --- | --- | --- |',
    `| Scheduled send time | Manual: ${formatInterval(summary.manualTxIntervalSec)}; Auto: ${formatInterval(summary.autoTxIntervalSec)} | CPS may map this to one control; Studio stores manual and auto intervals separately. |`,
    `| Call type | ${formatCallTypeLabel(summary.callType)} | CPS has a single call type for all report channels. |`,
    `| Upload number | ${formatUploadNumber(summary.uploadNumber)} | DMR ID / talkgroup target. CPS has a single upload number for all report channels. |`,
    '',
    '## Report channels 1–8',
    '',
    'Enter the **channel name** exactly as exported in `Channels.csv` (or Current Channel).',
    '',
  ];

  for (const row of summary.reportChannels) {
    lines.push(`- **Report channel ${row.index}:** ${row.wireName}`);
  }

  if (summary.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of summary.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    '',
    '## Library reference',
    '',
    `- Configuration id: \`${config.id}\``,
    `- Position source (not in DM-32 CPS CSV): \`${config.positionSource}\``,
    '',
  );

  return lines.join('\n');
}

export function hasDm32AprsGuide(assembled: AssembledBuild): boolean {
  return assembled.aprsConfiguration != null;
}

export function collectDm32AprsGuideWarnings(assembled: AssembledBuild): string[] {
  const guide = buildDm32AprsGuide(assembled);
  if (!guide) return [];
  return [DM32_APRS_GUIDE_TIP, ...guide.warnings];
}
