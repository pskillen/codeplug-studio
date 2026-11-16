/**
 * The UV-5R Mini Settings tab as a radio-neutral `SettingsView`, built from the settings frame
 * (`0x9000-0x903F`) and the two VFO records (`0x8000-0x803F`) of the archive's decoded clone.
 * Every sentence specific to this radio is here; the shared `SettingsTable` only draws it.
 * Read-only: nothing here writes, copies or sends bytes.
 */
import type { Confidence, SettingRow, SettingsView } from '../../../debugView/index.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';
import {
  decodeUv5rMiniSettings,
  decodeUv5rMiniVfo,
  type Uv5rMiniFrameCounts,
  type Uv5rMiniFrameFieldValue,
} from './settingsFrame.ts';

/** What the view needs of an archive: the stored region bytes (the decoded clone is `clone`). */
export interface Uv5rMiniSettingsArchive {
  regions: Readonly<Record<string, Uint8Array>>;
}

const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(4, '0')}`;

function confidenceOf(row: Uv5rMiniFrameFieldValue): Confidence {
  if (row.field.kind === 'no-reader') return 'unused';
  return row.field.confidence === 'traced'
    ? 'traced'
    : row.field.confidence === 'partly'
      ? 'partially-traced'
      : 'unknown';
}

function toRow(row: Uv5rMiniFrameFieldValue, idPrefix: string, side?: string): SettingRow {
  const { field, bytes, address } = row;
  const unused = field.kind === 'no-reader';
  const encoding = field.encoding ? `Encoding: ${field.encoding}.` : '';
  return {
    id: `${idPrefix}-${field.offset.toString(16).padStart(2, '0')}-${field.length}-${field.name}`,
    label: side ? `${field.name} (VFO ${side})` : field.name,
    help: encoding || undefined,
    value: unused ? 'Unused (no reader)' : row.text,
    firmwareDefault: field.defaultText || undefined,
    confidence: confidenceOf(row),
    evidence: field.evidence,
    address: field.length > 1 ? `${hexAddress(address)} +${field.length}` : hexAddress(address),
    raw: Array.from(bytes),
  };
}

function countsText(c: Uv5rMiniFrameCounts): string {
  const unread = c.noReader === 1 ? '1 byte' : `${c.noReader} bytes`;
  return `${c.named} bytes named (${c.traced} traced, ${c.partly} inferred), ${unread} unused (no reader).`;
}

/** Settings view for a UV-5R Mini archive; "not captured" when there is no whole decoded clone. */
export function uv5rMiniSettingsView(archive: Uv5rMiniSettingsArchive): SettingsView {
  const clone = archive.regions.clone;
  if (!clone || clone.length !== UV5R_MINI_FULL_READ_SIZE)
    return {
      status: {
        kind: 'not-captured',
        reason:
          'This archive has no whole decoded clone, so the settings and VFO frames (0x9000-0x903F, 0x8000-0x803F) cannot be decoded.',
      },
      summary: '',
      intro: '',
      groups: [],
    };
  const settings = decodeUv5rMiniSettings(clone);
  const vfo = decodeUv5rMiniVfo(clone);
  const blank = settings.empty
    ? ' Every byte of the settings frame reads the same (0x00 or 0xFF): the radio would load its defaults.'
    : '';
  return {
    status: { kind: 'ok' },
    summary: `Settings frame 0x9000-0x903F: ${countsText(settings.counts)} VFO records 0x8000-0x803F: ${countsText(vfo.counts)}`,
    intro:
      `Evidence is a v0.04 firmware address, or a radio repo ledger id (F302-F309, PR #219); v0.27 runs the same code relocated. ` +
      `Traced is code address and meaning; partly traced is a traced use with an inferred name. A byte shown as unused (no reader) ` +
      `has no reference in either build, which does not rule out a computed pointer access. Nothing in the settings frame is sensitive.${blank}`,
    groups: [
      {
        id: 'settings',
        label: 'Settings frame',
        description: 'The 64-byte settings frame at 0x9000-0x903F.',
        rows: settings.fields.map((f) => toRow(f, 'settings')),
      },
      ...vfo.sides.map((s) => ({
        id: `vfo-${s.side.toLowerCase()}`,
        label: `VFO ${s.side}`,
        description:
          s.side === 'A'
            ? 'Two 32-byte records, A then B. Busy lockout in VFO mode is settings byte 0x0F, not here. CHIRP has 6 offset digits and its squelch mode at +0x1C; the firmware writes 7 digits and SP-Mute at +0x1B.'
            : undefined,
        rows: s.fields.map((f) => toRow(f, `vfo-${s.side.toLowerCase()}`, s.side)),
      })),
    ],
  };
}
