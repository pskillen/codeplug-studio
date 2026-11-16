/**
 * The RT95 Settings tab as a radio-neutral `SettingsView`, built from `debugMemorySettings.ts`.
 * Every sentence that is specific to this radio (summary, intro, evidence, group blurbs) is here;
 * the shared `SettingsTable` only draws it. Read-only: nothing here edits the radio.
 */
import type { Confidence, SettingRow, SettingsView } from '../../debugView/index.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { RT95_MODEL_ID } from './constants.ts';
import {
  RT95_SETTINGS_GROUPS,
  projectRt95Settings,
  type Rt95RunConfidence,
  type Rt95SettingFieldView,
  type Rt95SettingsInventory,
  type Rt95UnclaimedRun,
} from './debugMemorySettings.ts';

/** What the view needs of an archive: the manifest and the stored region bytes. */
export interface Rt95SettingsArchive {
  manifest: Pick<RadioBackupManifestV1, 'radioModelId' | 'regions'>;
  regions: Readonly<Record<string, Uint8Array>>;
}

const count = (n: number) => n.toLocaleString('en-GB');
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const NOT_DECODED = 'Not decoded';

const RUN_CONFIDENCE: Record<Rt95RunConfidence, Confidence> = {
  traced: 'traced',
  partly: 'partially-traced',
  unused: 'unused',
  unknown: 'unknown',
};

/**
 * Registry fields come from the CPS and/or CHIRP layouts, not from a firmware trace: both agreeing
 * is "partly traced", one source alone is "inferred".
 */
function trustConfidence(trust: string): Confidence {
  return trust.includes('CPS') && trust.includes('CHIRP') ? 'partially-traced' : 'inferred';
}

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

function fieldValue(f: Rt95SettingFieldView): string | undefined {
  if (f.status === 'not-captured') return undefined;
  if (f.value !== undefined) return f.value;
  // Captured but the bytes are not interpreted: say so, and show them unless they are a password.
  return f.sensitive || !f.raw
    ? 'Not interpreted (see raw bytes)'
    : `Not interpreted (raw ${f.raw.map(hexByte).join(' ')})`;
}

function fieldRow(f: Rt95SettingFieldView): SettingRow {
  const help = [f.help, f.advanced ? 'Advanced setting.' : ''].filter(Boolean).join(' ');
  return {
    id: f.id,
    label: f.label,
    help: help || undefined,
    value: fieldValue(f),
    confidence: trustConfidence(f.trust),
    evidence: `Layout from ${f.trust}; written with ${f.targets.join(' + ')}`,
    address: addressText(f),
    raw: f.raw,
    sensitive: f.sensitive,
  };
}

function runRow(u: Rt95UnclaimedRun): SettingRow {
  return {
    id: `unclaimed-${hexAddress(u.address)}`,
    label: u.label,
    value: u.raw ? (u.decoded ?? NOT_DECODED) : undefined,
    confidence: RUN_CONFIDENCE[u.confidence],
    evidence: u.note,
    address: `${hexAddress(u.address)} +${u.length}`,
    raw: u.raw,
  };
}

function summaryOf({ counts }: Rt95SettingsInventory): string {
  return (
    `${count(counts.captured)} of ${count(counts.registered)} registered setting fields captured · ` +
    `${count(counts.decoded)} decoded to a value · ${count(counts.unclaimedBytes)} of ` +
    `${count(counts.windowBytes)} settings bytes claimed by no field`
  );
}

const INTRO =
  'Read-only view of the clone image. Each field is shown only when every byte of its span was ' +
  'captured; missing bytes stay missing and are never filled with defaults. Confidence says where ' +
  'the layout comes from (CPS and/or CHIRP), not that this radio was verified. Clone values have ' +
  'unknown provenance. Nothing here edits the radio or reads it again.';

/** Settings view for an RT95 archive; "not captured" for anything else. */
export function rt95SettingsView(archive: Rt95SettingsArchive): SettingsView {
  const modelId = archive.manifest.radioModelId;
  if (modelId !== RT95_MODEL_ID)
    return {
      status: {
        kind: 'not-captured',
        reason: `This archive is for ${modelId}, not an RT95 capture; nothing is decoded.`,
      },
      summary: '',
      intro: '',
      groups: [],
    };
  const region = archive.manifest.regions.find((r) => r.id === 'programming-image');
  const settings = projectRt95Settings(archive.regions['programming-image'], region?.address ?? 0);
  const { counts } = settings;
  return {
    status: { kind: 'ok' },
    summary: summaryOf(settings),
    intro: INTRO,
    groups: RT95_SETTINGS_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      emptyText: 'No registered setting is in this group.',
      rows: settings.fields.filter((f) => f.group === g.id).map(fieldRow),
    })),
    trailing: [
      {
        id: 'unclaimed',
        title: 'Unclaimed bytes',
        description:
          `Bytes in the settings windows (0x1980–0x1AFF and 0x3200–0x327F) that no registered field covers, ` +
          `explained by the static decode (read-only, none writable): ${count(counts.meaningBytes)} bytes ` +
          `with a meaning, ${count(counts.unusedBytes)} unused (no reader), ${count(counts.unknownBytes)} ` +
          `still unknown. ${count(counts.unclaimedBytes)} bytes in ${count(settings.unclaimed.length)} runs. ` +
          `Confidence: traced = read in firmware; partly = from the CPS or CHIRP only, or inferred.`,
        emptyText: 'No unclaimed bytes.',
        rows: settings.unclaimed.map(runRow),
      },
    ],
  };
}
