/**
 * UV5R-Mini `radioSettings.radioSpecific` read-only preview.
 * Labels / option indexes mirror NeonPlug `src/radios/uv5rmini/settingsProfile.ts`
 * (wire reference only — not modelled in the library).
 */

export interface NeonplugUv5rSettingRow {
  /** Stable wire key under radioSpecific. */
  key: string;
  label: string;
  /** Human-readable decoded value (or stringified leaf). */
  displayValue: string;
}

export interface NeonplugUv5rSettingSection {
  id: string;
  title: string;
  rows: NeonplugUv5rSettingRow[];
}

type FieldDef =
  | { key: string; label: string; kind: 'bool' }
  | { key: string; label: string; kind: 'select'; options: string[] }
  | { key: string; label: string; kind: 'select'; options: { value: number; label: string }[] };

function optionsFor(values: string[]): string[] {
  return values;
}

const UV5R_SETTING_SECTIONS: {
  id: string;
  title: string;
  fields: FieldDef[];
}[] = [
  {
    id: 'basic',
    title: 'Basic',
    fields: [
      {
        key: 'squelch',
        label: 'Squelch',
        kind: 'select',
        options: optionsFor(['Off', '1', '2', '3', '4', '5']),
      },
      { key: 'savemode', label: 'Save mode', kind: 'select', options: optionsFor(['Off', 'On']) },
      {
        key: 'vox',
        label: 'VOX',
        kind: 'select',
        options: optionsFor(['Off', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
      },
      {
        key: 'backlight',
        label: 'Backlight',
        kind: 'select',
        options: optionsFor([
          'Always On',
          ...Array.from({ length: 4 }, (_, i) => `${5 + i * 5} sec`),
        ]),
      },
      {
        key: 'dualstandby',
        label: 'Dual watch',
        kind: 'select',
        options: optionsFor(['Off', 'On']),
      },
      {
        key: 'tot',
        label: 'Timeout timer',
        kind: 'select',
        options: optionsFor(['Off', ...Array.from({ length: 12 }, (_, i) => `${15 + i * 15} sec`)]),
      },
      { key: 'beep', label: 'Beep', kind: 'select', options: optionsFor(['Off', 'On']) },
      { key: 'voicesw', label: 'Enable voice', kind: 'bool' },
      {
        key: 'voice',
        label: 'Voice prompt',
        kind: 'select',
        options: optionsFor(['English', 'Chinese']),
      },
    ],
  },
  {
    id: 'display',
    title: 'Display & Channel',
    fields: [
      {
        key: 'chadistype',
        label: 'Channel A display',
        kind: 'select',
        options: optionsFor(['Name', 'Frequency', 'Channel Number']),
      },
      {
        key: 'chbdistype',
        label: 'Channel B display',
        kind: 'select',
        options: optionsFor(['Name', 'Frequency', 'Channel Number']),
      },
      {
        key: 'chaworkmode',
        label: 'Channel A work mode',
        kind: 'select',
        options: optionsFor(['Frequency', 'Channel']),
      },
      {
        key: 'chbworkmode',
        label: 'Channel B work mode',
        kind: 'select',
        options: optionsFor(['Frequency', 'Channel']),
      },
      {
        key: 'powerondistype',
        label: 'Power on display',
        kind: 'select',
        options: optionsFor(['LOGO', 'BATT voltage']),
      },
      {
        key: 'aOrB',
        label: 'VFO selected',
        kind: 'select',
        options: [
          { value: 0, label: 'A' },
          { value: 1, label: 'B' },
        ],
      },
    ],
  },
  {
    id: 'ptt',
    title: 'PTT & Roger',
    fields: [
      {
        key: 'pttid',
        label: 'PTT ID',
        kind: 'select',
        options: optionsFor(['Off', 'BOT', 'EOT', 'Both']),
      },
      {
        key: 'pttdly',
        label: 'Send ID delay',
        kind: 'select',
        options: optionsFor(Array.from({ length: 30 }, (_, i) => `${100 + i * 100} ms`)),
      },
      { key: 'roger', label: 'Roger', kind: 'bool' },
      {
        key: 'sidetone',
        label: 'Side tone',
        kind: 'select',
        options: optionsFor(['Off', 'KB Side Tone', 'ANI Side Tone', 'KB + ANI Side Tone']),
      },
    ],
  },
  {
    id: 'scan',
    title: 'Scan & Squelch',
    fields: [
      {
        key: 'scanmode',
        label: 'Scan mode',
        kind: 'select',
        options: optionsFor(['Time', 'Carrier', 'Search']),
      },
      {
        key: 'ctsdcsscantype',
        label: 'QT save mode',
        kind: 'select',
        options: optionsFor(['Both', 'RX', 'TX']),
      },
    ],
  },
  {
    id: 'alarm',
    title: 'Alarm & Safety',
    fields: [
      {
        key: 'alarmmode',
        label: 'Alarm mode',
        kind: 'select',
        options: optionsFor(['Local', 'Send Tone', 'Send Code']),
      },
      { key: 'alarmtone', label: 'Sound alarm', kind: 'bool' },
      {
        key: 'totalarm',
        label: 'Timeout alarm',
        kind: 'select',
        options: optionsFor([
          'Off',
          '1 sec',
          '2 sec',
          '3 sec',
          '4 sec',
          '5 sec',
          '6 sec',
          '7 sec',
          '8 sec',
          '9 sec',
          '10 sec',
        ]),
      },
    ],
  },
  {
    id: 'repeater',
    title: 'Repeater',
    fields: [
      { key: 'tailclear', label: 'Tail clear', kind: 'bool' },
      {
        key: 'rpttailclear',
        label: 'Rpt tail clear',
        kind: 'select',
        options: optionsFor(Array.from({ length: 11 }, (_, i) => `${i * 100} ms`)),
      },
      {
        key: 'rpttaildet',
        label: 'Rpt tail delay',
        kind: 'select',
        options: optionsFor(Array.from({ length: 11 }, (_, i) => `${i * 100} ms`)),
      },
    ],
  },
  {
    id: 'vox',
    title: 'VOX & Misc',
    fields: [
      {
        key: 'voxdlytime',
        label: 'VOX delay time',
        kind: 'select',
        options: optionsFor(Array.from({ length: 16 }, (_, i) => `${500 + i * 100} ms`)),
      },
      { key: 'voxsw', label: 'VOX switch', kind: 'bool' },
      {
        key: 'menuquittime',
        label: 'Menu quit timer',
        kind: 'select',
        options: optionsFor([
          ...Array.from({ length: 10 }, (_, i) => `${5 + i * 5} sec`),
          '60 sec',
        ]),
      },
      { key: 'dispani', label: 'Display ANI', kind: 'bool' },
      { key: 'inputdtmf', label: 'Input DTMF', kind: 'bool' },
      { key: 'bcl', label: 'BCL', kind: 'bool' },
      { key: 'autolock', label: 'Key auto lock', kind: 'bool' },
      { key: 'keylock', label: 'Key lock', kind: 'bool' },
      { key: 'fmenable', label: 'Disable FM', kind: 'bool' },
      {
        key: 'hangup',
        label: 'Hang-up time',
        kind: 'select',
        options: optionsFor(['3 s', '4 s', '5 s', '6 s', '7 s', '8 s', '9 s', '10 s']),
      },
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function formatBool(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  return null;
}

function formatSelect(value: unknown, options: FieldDef & { kind: 'select' }): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const opts = options.options;
  if (opts.length > 0 && typeof opts[0] === 'string') {
    const labels = opts as string[];
    return labels[value] ?? `Index ${value}`;
  }
  const mapped = (opts as { value: number; label: string }[]).find((o) => o.value === value);
  return mapped?.label ?? `Index ${value}`;
}

function formatLeaf(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '—';
}

/**
 * Decode UV5R-Mini `radioSettings.radioSpecific` into labelled sections for the
 * read-only NeonPlug settings page. Unknown keys appear under “Other”.
 */
export function summariseUv5rminiRadioSpecific(
  radioSettings: unknown | null,
): NeonplugUv5rSettingSection[] {
  if (!isRecord(radioSettings)) return [];
  const specific = radioSettings.radioSpecific;
  if (!isRecord(specific)) return [];

  const seen = new Set<string>();
  const sections: NeonplugUv5rSettingSection[] = [];

  for (const section of UV5R_SETTING_SECTIONS) {
    const rows: NeonplugUv5rSettingRow[] = [];
    for (const field of section.fields) {
      if (!(field.key in specific)) continue;
      seen.add(field.key);
      const raw = specific[field.key];
      let displayValue: string;
      if (field.kind === 'bool') {
        displayValue = formatBool(raw) ?? formatLeaf(raw);
      } else {
        displayValue = formatSelect(raw, field) ?? formatLeaf(raw);
      }
      rows.push({ key: field.key, label: field.label, displayValue });
    }
    if (rows.length > 0) {
      sections.push({ id: section.id, title: section.title, rows });
    }
  }

  const otherRows: NeonplugUv5rSettingRow[] = [];
  for (const [key, value] of Object.entries(specific)) {
    if (seen.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      otherRows.push({ key, label: key, displayValue: formatLeaf(value) });
    }
  }
  if (otherRows.length > 0) {
    sections.push({ id: 'other', title: 'Other', rows: otherRows });
  }

  return sections;
}

/** True when radioSettings carries a UV5R-style nested radioSpecific bag. */
export function hasUv5rminiRadioSpecific(radioSettings: unknown | null): boolean {
  return isRecord(radioSettings) && isRecord(radioSettings.radioSpecific);
}
