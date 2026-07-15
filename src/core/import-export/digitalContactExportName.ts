import type { DigitalContact } from '@core/models/library.ts';
import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { resolveMaxNameLength } from './channelExpansion/exportWireNames.ts';
import { sanitiseAsciiWireString } from './sanitiseAsciiWireString.ts';
import { finalizeWireName } from './channelExpansion/shortenName.ts';
import { pushWireNameLengthWarning } from './channelExpansion/wireNameWarning.ts';

/** How library contact fields compose CPS wire `Name` at export (Anytone, OpenGD77, …). */
export type DigitalContactExportNameMode = 'name' | 'callsign' | 'callsign-name';

export const DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE: DigitalContactExportNameMode = 'name';

const MODE_LABELS: Record<DigitalContactExportNameMode, string> = {
  name: 'Name',
  callsign: 'Callsign',
  'callsign-name': 'Callsign + name',
};

export const DIGITAL_CONTACT_EXPORT_NAME_MODES: readonly DigitalContactExportNameMode[] = [
  'callsign-name',
  'name',
  'callsign',
];

export function digitalContactExportNameModeLabel(mode: DigitalContactExportNameMode): string {
  return MODE_LABELS[mode];
}

export function isDigitalContactExportNameMode(
  value: string,
): value is DigitalContactExportNameMode {
  return (DIGITAL_CONTACT_EXPORT_NAME_MODES as readonly string[]).includes(value);
}

export function digitalContactExportBaseName(
  contact: Pick<DigitalContact, 'name' | 'callsign'>,
  mode: DigitalContactExportNameMode = DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE,
): string {
  const callsign = contact.callsign.trim();
  const name = contact.name.trim();

  switch (mode) {
    case 'name':
      return name || callsign || 'Untitled contact';
    case 'callsign':
      return callsign || name || 'Untitled contact';
    case 'callsign-name':
      if (callsign && name) return `${callsign} ${name}`;
      return callsign || name || 'Untitled contact';
  }
}

export function resolveDigitalContactExportBaseName(
  contact: DigitalContact,
  contactOverrides: readonly BuildEntityOverride[] | undefined,
  mode: DigitalContactExportNameMode = DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE,
): string {
  const override = overrideByEntityId(contactOverrides).get(contact.id)?.wireName?.trim();
  if (override) return override;
  return digitalContactExportBaseName(contact, mode);
}

/** Truncate/sanitise contact export names without cross-contact uniqueness disambiguation. */
export function applyDigitalContactExportWireName(
  baseWireName: string,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();

  if (!shorten || maxLen == null) {
    const exported = sanitiseAsciiWireString(original);
    if (maxLen != null && exported.length > maxLen) {
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Contact',
        original,
        exported: exported.slice(0, maxLen),
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
      return exported.slice(0, maxLen);
    }
    return exported;
  }

  const localReserved = new Set<string>();
  const exported = sanitiseAsciiWireString(
    finalizeWireName(original, localReserved, maxLen, { allowCallsignSuffixDowngrade: false }),
  );
  pushWireNameLengthWarning(warnings, {
    entityKind: 'Contact',
    original,
    exported,
    maxLen,
    profileId: profileId ?? options?.profileId,
    shortenEnabled: true,
  });
  return exported;
}

export function resolveAnalogContactExportBaseName(
  contact: { id: string; name: string },
  contactOverrides: readonly BuildEntityOverride[] | undefined,
): string {
  const override = overrideByEntityId(contactOverrides).get(contact.id)?.wireName?.trim();
  if (override) return override;
  const name = contact.name.trim();
  return name || 'Untitled contact';
}

export function buildDigitalContactExportWireNameMap(
  contacts: readonly { entity: DigitalContact }[],
  contactOverrides: readonly BuildEntityOverride[] | undefined,
  options: CpsExportOptions | undefined,
  profileId: string,
  warnings: string[],
): Map<string, string> {
  const mode = options?.digitalContactExportNameMode ?? DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE;
  const map = new Map<string, string>();
  for (const row of contacts) {
    const base = resolveDigitalContactExportBaseName(row.entity, contactOverrides, mode);
    map.set(row.entity.id, applyDigitalContactExportWireName(base, options, profileId, warnings));
  }
  return map;
}
