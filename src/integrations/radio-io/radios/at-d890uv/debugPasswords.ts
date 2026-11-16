import type { DebugSensitiveArchive, DebugSensitiveRange } from '../../debugSensitive.ts';
import { AT_D890UV_MODEL_IDS, D890_MAP } from './constants.ts';

/**
 * AT-D890UV password bytes the debug pages mask until revealed. Wire facts:
 * `docs/reference/radios/anytone/at-d890uv/memory-layout.md` (LocalInfo) and `optional-settings.md`
 * (power-on password). Display only: the capture and the archive keep every byte.
 */
export interface AtD890PasswordSpan {
  id: string;
  label: string;
  address: number;
  length: number;
}

/** Power-on password: ext optional settings +0x40, 8 ASCII digits, `00` ends the compare. */
export const AT_D890_POWER_ON_PASSWORD_SPAN: AtD890PasswordSpan = {
  id: 'powerOnPasswordDigits',
  label: 'Power-on password',
  address: D890_MAP.OptionalSettingsExt + 0x40,
  length: 8,
};

/** LocalInfo passwords: 4 ASCII characters each. */
export const AT_D890_LOCAL_INFO_PASSWORD_SPANS: readonly AtD890PasswordSpan[] = [
  {
    id: 'decodeProgramPassword',
    label: 'Decode program password',
    address: D890_MAP.LocalInfo + 0x28,
    length: 4,
  },
  {
    id: 'bandSettingsPassword',
    label: 'Band-settings password',
    address: D890_MAP.LocalInfo + 0x0b,
    length: 4,
  },
];

const ALL_SPANS = [AT_D890_POWER_ON_PASSWORD_SPAN, ...AT_D890_LOCAL_INFO_PASSWORD_SPANS];

/**
 * Descriptor hook: the password ranges that fall inside the archive region asked about, at their
 * absolute addresses. Nothing for another radio's archive or a region that holds none of them.
 */
export function atD890ArchiveSensitiveRanges(
  archive: DebugSensitiveArchive,
  regionId: string,
): readonly DebugSensitiveRange[] {
  if (!(AT_D890UV_MODEL_IDS as readonly string[]).includes(archive.manifest.radioModelId))
    return [];
  const region = archive.manifest.regions.find((r) => r.id === regionId);
  const bytes = archive.regions[regionId];
  if (!region || !bytes) return [];
  const end = region.address + bytes.length;
  return ALL_SPANS.flatMap((span) =>
    span.address >= region.address && span.address + span.length <= end
      ? [{ start: span.address, end: span.address + span.length, label: span.label }]
      : [],
  );
}
