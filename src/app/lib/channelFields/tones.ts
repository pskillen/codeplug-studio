import type { ChannelTone } from '@core/models/libraryTypes.ts';

export const NONE_TONE: ChannelTone = 'none';

/** Common CTCSS tones (Hz) for UI selects — domain-standard, not format-specific. */
export const CTCSS_TONE_OPTIONS: readonly string[] = [
  '67.0',
  '69.3',
  '71.9',
  '74.4',
  '77.0',
  '79.7',
  '82.5',
  '85.4',
  '88.5',
  '91.5',
  '94.8',
  '97.4',
  '100.0',
  '103.5',
  '107.2',
  '110.9',
  '114.8',
  '118.8',
  '123.0',
  '127.3',
  '131.8',
  '136.5',
  '141.3',
  '146.2',
  '151.4',
  '156.7',
  '162.2',
  '167.9',
  '173.8',
  '179.9',
  '186.2',
  '192.8',
  '203.5',
  '210.7',
  '218.1',
  '225.7',
  '233.6',
  '241.8',
  '250.3',
];

/** Common DCS codes (`D023N`). The picker strips the normal suffix and adds inverted separately. */
export const DCS_TONE_OPTIONS: readonly string[] = [
  'D023N',
  'D025N',
  'D026N',
  'D031N',
  'D032N',
  'D043N',
  'D047N',
  'D051N',
  'D054N',
  'D065N',
  'D071N',
  'D072N',
  'D073N',
  'D074N',
  'D114N',
  'D115N',
  'D116N',
  'D125N',
  'D131N',
  'D132N',
  'D134N',
  'D143N',
  'D152N',
  'D155N',
  'D156N',
  'D162N',
  'D165N',
  'D172N',
  'D174N',
  'D205N',
  'D223N',
  'D226N',
  'D243N',
  'D244N',
  'D245N',
  'D251N',
  'D261N',
  'D263N',
  'D265N',
  'D271N',
  'D306N',
  'D311N',
  'D315N',
  'D331N',
  'D343N',
  'D346N',
  'D351N',
  'D364N',
  'D365N',
  'D371N',
  'D411N',
  'D412N',
  'D413N',
  'D423N',
  'D431N',
  'D432N',
  'D445N',
  'D464N',
  'D465N',
  'D466N',
  'D503N',
  'D506N',
  'D516N',
  'D532N',
  'D546N',
  'D565N',
  'D606N',
  'D612N',
  'D624N',
  'D627N',
  'D631N',
  'D632N',
  'D654N',
  'D662N',
  'D664N',
  'D703N',
  'D712N',
  'D723N',
  'D731N',
  'D732N',
  'D734N',
  'D743N',
  'D754N',
];

export function ctcssToneSelectOptions(extraHz?: string): { value: string; label: string }[] {
  const options = CTCSS_TONE_OPTIONS.map((tone) => ({ value: tone, label: `${tone} Hz` }));
  if (extraHz && !options.some((option) => option.value === extraHz)) {
    options.push({ value: extraHz, label: `${extraHz} Hz` });
  }
  return options;
}

/** Three-digit DCS code (`023`) from the normal-polarity catalog, plus a stored code that is not listed. */
export function dcsCodeSelectOptions(extraCode?: string): { value: string; label: string }[] {
  const options = DCS_TONE_OPTIONS.map((tone) => {
    const code = tone.slice(1, -1);
    return { value: code, label: `D${code}` };
  });
  if (extraCode && !options.some((option) => option.value === extraCode)) {
    options.push({ value: extraCode, label: `D${extraCode}` });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }
  return options;
}

export function normalizeToneValue(value: string | null | undefined): ChannelTone {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return NONE_TONE;
  return trimmed;
}
