/**
 * The AT-D890UV Settings tab as a radio-neutral `SettingsView`, built from `debugMemorySettings.ts`.
 * Every sentence that is specific to this radio (summary, intro, evidence, group blurbs) is here;
 * the shared `SettingsTable` only draws it. Read-only: nothing here edits the radio.
 */
import type { Confidence, SettingRow, SettingsView } from '../../debugView/index.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { AT_D890UV_MODEL_IDS } from './constants.ts';
import { buildAtD890SparseCapture } from './debugMemory.ts';
import {
  AT_D890_SETTINGS_GROUPS,
  projectAtD890Settings,
  type AtD890LockPasswordView,
  type AtD890NamedSettingBytes,
  type AtD890SettingFieldView,
  type AtD890SettingsInventory,
} from './debugMemorySettings.ts';

/** What the view needs of an archive: the manifest and the stored region bytes. */
export interface AtD890SettingsArchive {
  manifest: Pick<RadioBackupManifestV1, 'radioModelId' | 'regions'>;
  regions: Readonly<Record<string, Uint8Array>>;
}

const count = (n: number) => n.toLocaleString('en-GB');
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(7, '0')}`;
const NOT_DECODED = 'Not decoded';

const KIND_TEXT: Record<AtD890NamedSettingBytes['kind'], string> = {
  meaning: 'Used by the radio',
  'never-read': 'Unused (no reader)',
  unreferenced: 'Unused (no reference)',
  'no-reader': 'Bits unused (no reader)',
};

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

/** The value as a word or physical value; the raw number stays behind the raw toggle. */
function fieldValue(f: AtD890SettingFieldView): string | undefined {
  if (f.status === 'not-captured') return undefined;
  if (f.value === undefined && f.stateText) return f.stateText;
  if (f.value === undefined) {
    if (f.valueLabel) return `${f.valueLabel} (read-only value)`;
    return f.sensitive || !f.raw
      ? 'Not interpreted (see raw bytes)'
      : `Not interpreted (raw ${f.raw.map(hexByte).join(' ')})`;
  }
  if (typeof f.value === 'boolean') return f.value ? 'On' : 'Off';
  if (typeof f.value === 'string') return f.value;
  return f.valueLabel ?? String(f.value);
}

function fieldRow(f: AtD890SettingFieldView): SettingRow {
  const help = [f.help, f.conditional, f.firmwareNote].filter(Boolean).join(' ');
  return {
    id: f.id,
    label: f.label,
    help: help || undefined,
    value: fieldValue(f),
    // The decoder carries no confidence for registered fields.
    confidence: 'unknown',
    address: addressText(f),
    raw: f.raw,
    sensitive: f.sensitive,
  };
}

function lockRow(p: AtD890LockPasswordView): SettingRow {
  return {
    id: p.id,
    label: p.label,
    help: `LocalInfo, ${p.length} ASCII characters.`,
    value: p.status === 'captured' ? p.text : undefined,
    confidence: 'unknown',
    address: `${hexAddress(p.address)} +${p.length}`,
    raw: p.raw,
    sensitive: true,
  };
}

function namedRow(n: AtD890NamedSettingBytes): SettingRow {
  const span =
    n.bytes.length > 1 ? `${hexAddress(n.address)} +${n.bytes.length}` : hexAddress(n.address);
  return {
    id: `named-${hexAddress(n.address)}${n.mask === undefined ? '' : `-${hexByte(n.mask)}`}`,
    label: n.name,
    help: `${KIND_TEXT[n.kind]}: ${n.meaning}${n.mask === undefined ? '' : ` (bits 0x${hexByte(n.mask)} only)`}`,
    value: NOT_DECODED,
    confidence:
      n.kind !== 'meaning' ? 'unused' : n.confidence === 'traced' ? 'traced' : 'partially-traced',
    evidence: n.evidence,
    address: span,
    raw: n.bytes,
  };
}

function modRows(store: AtD890SettingsInventory['mm9pdy']): {
  rows: SettingRow[];
  emptyText?: string;
  description?: string;
} {
  if (store.status === 'not-captured')
    return { rows: [], emptyText: 'MM9PDY settings store (0x03500200): Not captured.' };
  if (store.status === 'invalid')
    return {
      rows: [],
      emptyText:
        'No valid MM9PDY settings record: the 32 bytes at 0x03500200 have no valid magic, version or sum, so the firmware treats every MM9PDY setting as 0 (default). This is expected on stock firmware or before a mod setting was ever changed.',
    };
  return {
    description:
      'MM9PDY settings store at 0x03500200: one byte per setting, 0 is the default. Read-only, decoded from the firmware source; Studio never writes it.',
    rows: store.settings.map((x) => ({
      id: `mm9pdy-${hexByte(x.byte)}`,
      label: x.label,
      value: x.valueLabel ?? String(x.raw),
      confidence: 'traced' as const,
      evidence: 'Traced from the firmware source',
      address: `0x03500200 +0x${hexByte(x.byte)}`,
      raw: [x.raw],
    })),
  };
}

function gpsRows(settings: AtD890SettingsInventory): SettingRow[] {
  const gps = settings.gpsText;
  if (!gps) return [];
  const run = settings.aprsRuns[0];
  return [
    {
      id: 'gps-template-text',
      label: 'GPS template text',
      help:
        `UTF-16, up to 32 characters, added to the position message when the GPS text option (+0x53) is on. ` +
        `The capture holds 0x${gps.capturedBytes.toString(16).toUpperCase()} of 0x${gps.blockBytes.toString(16).toUpperCase()} bytes` +
        (gps.truncated
          ? ', so the text may be cut short (a full capture would hold all 32 characters).'
          : '.'),
      value: gps.text,
      confidence: 'traced',
      evidence: 'Traced: radio repo F356',
      address: run ? `${hexAddress(run.address)} +${run.bytes.length}` : undefined,
      raw: run?.bytes,
    },
  ];
}

function summaryOf({ counts }: AtD890SettingsInventory): string {
  return (
    `${count(counts.captured)} of ${count(counts.registered)} known setting fields captured · ` +
    `${count(counts.decoded)} decoded to a known value`
  );
}

function introOf(missingBytes: number): string {
  return (
    `Each field is shown only when every byte of its own span was captured; missing bytes stay missing and ` +
    `are never filled with defaults. Meanings follow the stock settings layout documented for this radio; ` +
    `the bytes alone do not show which firmware is installed. Nothing here edits the radio. ` +
    `${count(missingBytes)} bytes of the main and power-on settings blocks were not captured.`
  );
}

/** Settings view for an AT-D890UV archive; "not captured" for anything else. */
export function atD890SettingsView(archive: AtD890SettingsArchive): SettingsView {
  const modelId = archive.manifest.radioModelId;
  if (!(AT_D890UV_MODEL_IDS as readonly string[]).includes(modelId))
    return {
      status: {
        kind: 'not-captured',
        reason: `This archive is for ${modelId}, not an AT-D890UV capture; nothing is decoded.`,
      },
      summary: '',
      intro: '',
      groups: [],
    };
  const settings = projectAtD890Settings(
    buildAtD890SparseCapture(archive.manifest.regions, archive.regions),
  );
  const mod = modRows(settings.mm9pdy);
  return {
    status: { kind: 'ok' },
    summary: summaryOf(settings),
    intro: introOf(settings.missingBytes),
    groups: AT_D890_SETTINGS_GROUPS.flatMap((g) => {
      const fields = settings.fields.filter((f) => f.group === g.id).map(fieldRow);
      if (g.id === 'other' && fields.length === 0) return [];
      const base = { id: g.id, label: g.label };
      if (g.id === 'privacy')
        return [{ ...base, rows: [...fields, ...settings.lockPasswords.map(lockRow)] }];
      if (g.id === 'gps') return [{ ...base, rows: [...fields, ...gpsRows(settings)] }];
      if (g.id === 'mod')
        return [
          {
            ...base,
            ...(mod.description ? { description: mod.description } : {}),
            emptyText: mod.emptyText,
            rows: [...fields, ...mod.rows],
          },
        ];
      if (g.id === 'scan')
        return [
          {
            ...base,
            emptyText:
              'No scan setting is established in the decoded settings fields; this is unavailable, not off. Scan lists are in their own tab.',
            rows: fields,
          },
        ];
      return [{ ...base, rows: fields }];
    }),
    trailing: [
      {
        id: 'named',
        title: 'Other settings bytes',
        description:
          `Captured bytes that no setting above edits but the firmware trace names: the radio's own state, ` +
          `values it reads without a menu entry, and bytes it never reads (shown as unused, not unknown). ` +
          `${count(settings.named.filter((n) => n.kind !== 'meaning').length)} of ${count(settings.named.length)} ` +
          `captured ranges are unused. Display only: Write never touches them. Their bytes show with the raw-bytes switch on.`,
        emptyText: 'None of these bytes were captured.',
        rows: settings.named.map(namedRow),
      },
      {
        id: 'unknown',
        title: 'Unknown bytes',
        description:
          'Captured bytes (or bits of a partly known byte) in the main and power-on settings blocks that nothing names. They are unexplained, not zero.',
        emptyText: 'No unexplained captured bytes.',
        rows: settings.unknown.map((u) => ({
          id: `unknown-${hexAddress(u.address)}`,
          label: `Unknown bytes at ${hexAddress(u.address)}`,
          value: NOT_DECODED,
          confidence: 'unknown' as Confidence,
          address:
            u.unclaimedMask === undefined
              ? u.bytes.length > 1
                ? `${hexAddress(u.address)} +${u.bytes.length}`
                : hexAddress(u.address)
              : `${hexAddress(u.address)} mask 0x${hexByte(u.unclaimedMask)}`,
          raw: u.bytes,
        })),
      },
    ],
  };
}
