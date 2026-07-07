import type { ChannelMode } from '@core/models/libraryTypes.ts';

/** ETCC `modeCodes` single-letter flags — see docs/reference/ukrepeater/README.md */
const FLAG_TO_MODE: Record<string, ChannelMode> = {
  A: 'fm',
  D: 'dstar',
  E: 'tetra',
  M: 'dmr',
  F: 'ysf',
  P: 'p25',
  '7': 'm17',
  N: 'nxdn',
};

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

export interface ParsedUkRepeaterModeCodes {
  modes: ChannelMode[];
  primaryMode: ChannelMode;
  colourCode: number | null;
}

function orderModes(modes: Iterable<ChannelMode>): ChannelMode[] {
  const set = new Set(modes);
  return MODE_DISPLAY_ORDER.filter((m) => set.has(m));
}

/** Preferred library channel mode when importing a listing (FM wins over digital). */
export function primaryModeFromModes(modes: ChannelMode[]): ChannelMode {
  if (modes.includes('fm')) return 'fm';
  if (modes.includes('dmr')) return 'dmr';
  return modes[0] ?? 'fm';
}

export function parseUkRepeaterModeCodes(modeCodes: string[]): ParsedUkRepeaterModeCodes {
  const modeSet = new Set<ChannelMode>();
  let colourCode: number | null = null;

  for (const raw of modeCodes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;

    if (code.startsWith('M:')) {
      modeSet.add('dmr');
      const n = Number.parseInt(code.slice(2), 10);
      if (Number.isFinite(n) && n >= 0 && n <= 15) colourCode = n;
      continue;
    }

    const flag = code.charAt(0);
    const mode = FLAG_TO_MODE[flag];
    if (mode) modeSet.add(mode);
  }

  const modes = orderModes(modeSet);
  const primaryMode = primaryModeFromModes(modes);
  return {
    modes,
    primaryMode,
    colourCode: modes.includes('dmr') ? colourCode : null,
  };
}

export function formatModeCodesSummary(modeCodes: string[]): string {
  return modeCodes.join(', ') || '—';
}

export function isOperationalStatus(status: string): boolean {
  return status.trim().toUpperCase() === 'OPERATIONAL';
}
