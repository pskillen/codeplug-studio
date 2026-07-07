/** Channel mode display — mirror docs/reference/channel-modes.md */

import type {
  ChannelMode as CoreChannelMode,
  DigitalChannelMode,
} from '@core/models/libraryTypes.ts';

export type ChannelModeCategory = 'analog' | 'digital' | 'other';

/** Core channel modes plus a display-only fallback for unclassified repeater listings. */
export type ChannelMode = CoreChannelMode | 'other';

export interface ChannelModeDefinition {
  id: ChannelMode;
  label: string;
  category: ChannelModeCategory;
  color: string;
  mantine: string;
}

export const CHANNEL_MODES: ChannelModeDefinition[] = [
  { id: 'fm', label: 'FM', category: 'analog', color: '#f0c419', mantine: 'yellow.5' },
  { id: 'am', label: 'AM', category: 'analog', color: '#fab005', mantine: 'yellow.6' },
  { id: 'ssb', label: 'SSB', category: 'analog', color: '#fd7e14', mantine: 'orange.6' },
  { id: 'dmr', label: 'DMR', category: 'digital', color: '#e03131', mantine: 'red.7' },
  { id: 'ysf', label: 'YSF', category: 'digital', color: '#339af0', mantine: 'blue.5' },
  { id: 'dstar', label: 'D-STAR', category: 'digital', color: '#7950f2', mantine: 'violet.6' },
  { id: 'p25', label: 'P25', category: 'digital', color: '#12b886', mantine: 'teal.6' },
  { id: 'nxdn', label: 'NXDN', category: 'digital', color: '#868e96', mantine: 'gray.6' },
  { id: 'm17', label: 'M17', category: 'digital', color: '#20c997', mantine: 'teal.5' },
  { id: 'tetra', label: 'Tetra', category: 'digital', color: '#6741d9', mantine: 'indigo.6' },
  { id: 'other', label: 'Other', category: 'other', color: '#9c36b5', mantine: 'grape.6' },
];

const modeById = new Map(CHANNEL_MODES.map((m) => [m.id, m]));

/** Canonical digital mode order for talk groups, contacts, and segmented controls. */
export const DIGITAL_CHANNEL_MODES: readonly DigitalChannelMode[] = [
  'dmr',
  'dstar',
  'ysf',
  'p25',
  'nxdn',
  'm17',
  'tetra',
];

export function digitalModeSegmentOptions(): { value: DigitalChannelMode; label: string }[] {
  return DIGITAL_CHANNEL_MODES.map((mode) => ({
    value: mode,
    label: getModeDefinition(mode).label,
  }));
}

export function getModeDefinition(mode: ChannelMode): ChannelModeDefinition {
  return modeById.get(mode) ?? modeById.get('other')!;
}

export function modeLabel(mode: ChannelMode): string {
  return getModeDefinition(mode).label;
}

export function modeColor(mode: ChannelMode): string {
  return getModeDefinition(mode).color;
}

export function isAnalogMode(mode: ChannelMode): boolean {
  return getModeDefinition(mode).category === 'analog';
}

export function isDigitalMode(mode: ChannelMode): boolean {
  return getModeDefinition(mode).category === 'digital';
}

export function isDmrMode(mode: ChannelMode): boolean {
  return mode === 'dmr';
}

export function modeFilterOptions(): { value: ChannelMode; label: string }[] {
  return CHANNEL_MODES.map((m) => ({ value: m.id, label: m.label }));
}

/** OpenGD77 `Channel Type` column → internal mode. */
export function mapOpenGd77ChannelType(type: string): ChannelMode {
  const t = (type || '').toLowerCase();
  if (t === 'digital') return 'dmr';
  if (t === 'analogue' || t === 'analog') return 'fm';
  return 'other';
}

/** Map OpenGD77 export wire value from internal mode (lossy for non-DMR/FM modes). */
export function mapModeToOpenGd77ChannelType(mode: ChannelMode): string {
  if (isAnalogMode(mode)) return 'Analogue';
  if (isDigitalMode(mode)) return 'Digital';
  return mode;
}

/** Schema v2 legacy values → v3 specific modes. */
export function mapLegacyChannelMode(mode: string): ChannelMode {
  if (mode === 'analogue') return 'fm';
  if (mode === 'digital') return 'dmr';
  if (mode === 'ssb-usb' || mode === 'ssb-lsb') return 'ssb';
  if (modeById.has(mode as ChannelMode)) return mode as ChannelMode;
  return 'other';
}

export function normalizeChannelMode(mode: string): ChannelMode {
  return mapLegacyChannelMode(mode);
}
