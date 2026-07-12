import type { ChannelMode } from '@core/models/libraryTypes.ts';

const MODE_DISPLAY_ORDER: ChannelMode[] = [
  'fm',
  'am',
  'ssb',
  'dmr',
  'dstar',
  'ysf',
  'p25',
  'nxdn',
  'm17',
  'tetra',
];

export interface ParsedRepeaterBookModes {
  modes: ChannelMode[];
  primaryMode: ChannelMode;
  colourCode: number | null;
}

function orderModes(modes: Iterable<ChannelMode>): ChannelMode[] {
  const set = new Set(modes);
  return MODE_DISPLAY_ORDER.filter((m) => set.has(m));
}

function isYes(value: unknown): boolean {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'yes' || normalized === '1' || normalized === 'true';
}

function parseColourCode(raw: unknown): number | null {
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 && n <= 15 ? n : null;
}

/** Map RepeaterBook capability flags to library modes. */
export function parseRepeaterBookModes(row: Record<string, unknown>): ParsedRepeaterBookModes {
  const modeSet = new Set<ChannelMode>();
  let colourCode: number | null = null;

  if (isYes(row['FM Analog'])) modeSet.add('fm');
  if (isYes(row['DMR'])) {
    modeSet.add('dmr');
    colourCode = parseColourCode(row['DMR Color Code']);
  }
  if (isYes(row['D-Star'])) modeSet.add('dstar');
  if (isYes(row['System Fusion'])) modeSet.add('ysf');
  if (isYes(row['NXDN'])) modeSet.add('nxdn');
  if (isYes(row['APCO P-25'])) modeSet.add('p25');
  if (isYes(row['Tetra'])) modeSet.add('tetra');
  if (isYes(row['M17'])) modeSet.add('m17');

  const modes = orderModes(modeSet);
  if (!modes.length && isYes(row['FM Analog'])) {
    modes.push('fm');
  }
  if (!modes.length) {
    modes.push('fm');
  }

  const primaryMode = modes.includes('fm') ? 'fm' : modes.includes('dmr') ? 'dmr' : modes[0]!;

  return {
    modes,
    primaryMode,
    colourCode: modes.includes('dmr') ? colourCode : null,
  };
}

export function isRepeaterBookOperational(status: string): boolean {
  return status.trim().toLowerCase() === 'on-air';
}
