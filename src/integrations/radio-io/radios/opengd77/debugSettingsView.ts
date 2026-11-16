/**
 * The OpenGD77 Settings tab as a radio-neutral `SettingsView`: the firmware settings struct and the
 * codeplug device info, general settings and boot password, decoded from the captured FLASH spans
 * by `debugSettings.ts`. Every sentence specific to this radio is here; the shared `SettingsTable`
 * only draws it. Read-only: it never reads a radio and nothing here writes one.
 */
import {
  OPENGD77_SETTINGS_ADDRESS,
  type OpenGd77CodeplugGeneralRow,
  type OpenGd77SettingsConfidence,
  type OpenGd77SettingsDecode,
  type OpenGd77SettingsMember,
} from '@core/radios/opengd77/settings.ts';
import type { Confidence, SettingRow, SettingsView } from '../../debugView/index.ts';
import { selectOpenGd77Settings } from './debugSettings.ts';

type OpenGd77SettingsArchive = Parameters<typeof selectOpenGd77Settings>[0];

const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(4, '0')}`;

const CONFIDENCE: Record<OpenGd77SettingsConfidence, Confidence> = {
  traced: 'traced',
  partly: 'partially-traced',
  unknown: 'unknown',
};

const NO_READER = 'Unused: nothing in OpenGD77 reads it.';

function memberValue(m: OpenGd77SettingsMember): string | undefined {
  if (m.state === 'captured') return m.value;
  return m.state === 'partly-captured' ? 'Partly captured' : undefined;
}

function memberRow(m: OpenGd77SettingsMember): SettingRow {
  const help = [m.meaning, m.note, `Type ${m.type}.`, m.hasReader ? '' : NO_READER]
    .filter(Boolean)
    .join(' ');
  return {
    id: `setting-${m.id}`,
    label: m.name,
    help,
    value: memberValue(m),
    confidence: m.hasReader ? CONFIDENCE[m.confidence] : 'unused',
    evidence: m.evidence,
    address: `${hexAddress(OPENGD77_SETTINGS_ADDRESS + m.offset)} (+0x${hexByte(m.offset)})${m.length > 1 ? ` +${m.length}` : ''}`,
    raw: m.raw ? Array.from(m.raw) : undefined,
  };
}

function generalRow(r: OpenGd77CodeplugGeneralRow): SettingRow {
  return {
    id: `general-${r.id}`,
    label: r.name,
    help: r.hasReader ? r.meaning : `${r.meaning} ${NO_READER}`,
    value: r.captured ? (r.value ?? 'Not interpreted (see raw bytes)') : undefined,
    confidence: r.hasReader ? CONFIDENCE[r.confidence] : 'unused',
    evidence: r.evidence,
    address: `${hexAddress(r.abs)}${r.length > 1 ? ` +${r.length}` : ''}`,
    raw: r.raw ? Array.from(r.raw) : undefined,
    sensitive: r.sensitive,
  };
}

function firmwareGroup(settings: OpenGd77SettingsDecode, label: string) {
  const base = { id: 'firmware', label: 'Firmware settings' };
  if (settings.status === 'ok')
    return {
      ...base,
      description:
        `${label} · settings struct at ${hexAddress(OPENGD77_SETTINGS_ADDRESS)}, size 0x${hexByte(settings.size)} · ${settings.provenance}. ` +
        `${settings.capturedBytes} of ${settings.memberBytes} member bytes are in this capture` +
        (settings.paddingBytes > 0
          ? `; ${settings.paddingBytes} struct padding bytes carry no member`
          : '') +
        '. The size assumes 1-byte enums (inferred).',
      rows: settings.members.map(memberRow),
    };
  return {
    ...base,
    emptyText:
      settings.status === 'refused'
        ? `Firmware settings not decoded: ${settings.reason}`
        : `Firmware settings not captured: ${settings.reason}`,
    rows: [],
  };
}

/** Settings view for an OpenGD77 archive; "not captured" when the model is not identified. */
export function openGd77SettingsView(archive: OpenGd77SettingsArchive): SettingsView {
  const selection = selectOpenGd77Settings(archive);
  if (selection.status === 'unavailable')
    return {
      status: {
        kind: 'not-captured',
        reason: `${selection.reason}. The Hex tab still shows the stored bytes.`,
      },
      summary: '',
      intro: '',
      groups: [],
    };
  const { settings, general, model } = selection;
  const groups = Array.from(new Set(general.map((r) => r.group)));
  const sensitive = general.some((r) => r.sensitive);
  return {
    status: { kind: 'ok' },
    summary: `${model.label}: firmware settings struct and codeplug general settings, read-only.`,
    intro:
      `Layout read from OpenGD77 firmware sources dated 2026-01-30 (DM-1701 family) and 2026-01-31 (MD-9600); not validated on hardware. ` +
      `Nothing on this page is written to the radio. A field not wholly in the capture reads Not captured; nothing is filled with a default.` +
      (sensitive
        ? ' The programming password and the boot PIN stay hidden until shown; Hex masks the same bytes.'
        : ''),
    groups: [
      firmwareGroup(settings, model.label),
      ...groups.map((group) => ({
        id: group,
        label: group.startsWith('Boot') ? group : `Codeplug ${group}`,
        rows: general.filter((r) => r.group === group).map(generalRow),
      })),
    ],
  };
}
