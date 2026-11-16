/**
 * The DM-32UV Settings tab as a radio-neutral `SettingsView`, built from `debugMemorySettings.ts`.
 * Every sentence that is specific to this radio (summary, intro, evidence, group blurbs) is here;
 * the shared `SettingsTable` only draws it. Read-only: nothing here edits the radio.
 */
import type { Confidence, SettingRow, SettingsView } from '../../debugView/index.ts';
import { DM32_METADATA, DM32_MODEL_IDS } from './constants.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { buildDm32SparseCapture } from './debugMemory.ts';
import { dm32TagHex } from './debugMemoryLists.ts';
import {
  DM32_SETTINGS_GROUPS,
  DM32_SETTINGS_LAYOUT_BASIS,
  DM32_SETTINGS_LAYOUT_LENGTH,
  projectDm32Settings,
  type Dm32SettingConfidence,
  type Dm32SettingFieldView,
  type Dm32SettingsInventory,
  type Dm32UnusedKind,
} from './debugMemorySettings.ts';

const count = (n: number) => n.toLocaleString('en-GB');
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const NOT_DECODED = 'Not decoded';

const UNUSED_KIND_LABEL: Record<Dm32UnusedKind, string> = {
  free: 'Free',
  unread: 'Unused (no reader)',
  'mm9pdy-reserved': 'MM9PDY reserved',
};

const CONFIDENCE: Record<Dm32SettingConfidence, Confidence> = {
  traced: 'traced',
  'partially-traced': 'partially-traced',
  unknown: 'unknown',
};

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

function fieldValue(f: Dm32SettingFieldView): string | undefined {
  if (f.status === 'not-captured') return undefined;
  if (f.value !== undefined) return f.value;
  // Captured but the bytes are not interpreted: say so, and show them unless they are a password.
  return f.sensitive || !f.raw
    ? 'Not interpreted (see raw bytes)'
    : `Not interpreted (raw ${f.raw.map(hexByte).join(' ')})`;
}

function fieldRow(f: Dm32SettingFieldView): SettingRow {
  return {
    id: f.id,
    label: f.label,
    help: f.help,
    value: fieldValue(f),
    confidence: CONFIDENCE[f.confidence],
    evidence: f.source,
    address: addressText(f),
    raw: f.raw,
    sensitive: f.sensitive,
  };
}

function summaryOf(settings: Extract<Dm32SettingsInventory, { status: 'captured' }>): string {
  const { counts } = settings;
  return (
    `${count(counts.captured)} of ${count(counts.registered)} known setting fields captured · ` +
    `${count(counts.decoded)} decoded to a value · ${count(counts.traced)} traced, ` +
    `${count(counts.partiallyTraced)} partly traced, ${count(counts.unknownConfidence)} unknown · ` +
    `${count(counts.documentedRangesCaptured)} of ${count(counts.documentedRanges)} ` +
    `documented-not-decoded ranges captured · ${count(counts.unusedBytes)} unused bytes in ` +
    `${count(counts.unusedRanges)} ranges · ${count(counts.unknownBytes)} unknown bytes`
  );
}

function introOf(address: number): string {
  return (
    `Read-only view of the settings page at ${hexAddress(address)} (tag ${dm32TagHex(DM32_METADATA.VFO_SETTINGS)}). ` +
    `Layout basis: ${DM32_SETTINGS_LAYOUT_BASIS}. Each field is shown only when every byte of its ` +
    `own span was captured; missing bytes stay missing and are never filled with defaults. Only the ` +
    `first 0x${DM32_SETTINGS_LAYOUT_LENGTH.toString(16)} bytes carry layout. The bytes alone do not ` +
    `show which firmware is installed. Nothing here edits the radio or reads it again. Emergency ` +
    `systems and encryption keys are outside this view and are not shown; they remain only in the Hex tab.`
  );
}

/** Settings view for a DM-32UV archive; "not captured" for anything else. */
export function dm32SettingsView(archive: Dm32CompareArchive): SettingsView {
  const modelId = archive.manifest.radioModelId;
  if (!(DM32_MODEL_IDS as readonly string[]).includes(modelId))
    return {
      status: {
        kind: 'not-captured',
        reason: `This archive is for ${modelId}, not a DM-32UV capture; nothing is decoded.`,
      },
      summary: '',
      intro: '',
      groups: [],
    };
  const settings = projectDm32Settings(buildDm32SparseCapture(archive));
  if (settings.status === 'not-captured')
    return {
      status: { kind: 'not-captured', reason: settings.reason },
      summary: '',
      intro: '',
      groups: [],
    };
  if (settings.status === 'ambiguous')
    return {
      status: {
        kind: 'ambiguous',
        reason: `${settings.reason} Addresses: ${settings.addresses.map(hexAddress).join(', ')}.`,
      },
      summary: '',
      intro: '',
      groups: [],
    };
  return {
    status: { kind: 'ok' },
    summary: summaryOf(settings),
    intro: introOf(settings.address),
    groups: DM32_SETTINGS_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      emptyText: 'No documented setting is decoded in this group.',
      rows: settings.fields.filter((f) => f.group === g.id).map(fieldRow),
    })),
    trailing: [
      {
        id: 'documented',
        title: 'Documented, not decoded',
        description:
          'The firmware reads these areas, but their record contents are not decoded here. Their bytes show with the raw-bytes switch on.',
        rows: settings.documented.map((r) => ({
          id: r.id,
          label: r.label,
          value: r.status === 'captured' ? NOT_DECODED : undefined,
          confidence: CONFIDENCE[r.confidence],
          evidence: r.source,
          address: addressText(r),
          raw: r.raw,
        })),
      },
      {
        id: 'unused',
        title: 'Unused bytes',
        description:
          'Bytes the stock firmware never reads: free, not read by 048 (the vendor CPS may still write them), or reserved for MM9PDY. Their contents show with the raw-bytes switch on.',
        rows: settings.unused.map((u) => ({
          id: u.id,
          label: `${UNUSED_KIND_LABEL[u.kind]} · ${u.label}`,
          value: u.status === 'captured' ? NOT_DECODED : undefined,
          confidence: 'unused' as const,
          evidence: u.source,
          address: addressText(u),
          raw: u.raw,
        })),
      },
      {
        id: 'unknown',
        title: 'Unknown bytes',
        description: `Captured bytes in the first 0x${DM32_SETTINGS_LAYOUT_LENGTH.toString(16)} bytes that no known field, documented area or unused range covers. They are unexplained, not zero. ${count(settings.counts.unknownBytes)} bytes in ${count(settings.unknown.length)} runs.`,
        emptyText: 'No unexplained captured bytes.',
        rows: settings.unknown.map((u) => ({
          id: `unknown-${hexAddress(u.address)}`,
          label: `Unknown bytes at ${hexAddress(u.address)}`,
          value: NOT_DECODED,
          confidence: 'unknown' as const,
          address: `${hexAddress(u.address)} +${u.raw.length}`,
          raw: u.raw,
        })),
      },
    ],
  };
}
