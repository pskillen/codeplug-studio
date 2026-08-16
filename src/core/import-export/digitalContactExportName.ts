import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { DigitalContact } from '@core/models/library.ts';
import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { resolveMaxNameLength } from './channelExpansion/exportWireNames.ts';
import { sanitiseAsciiWireString } from './sanitiseAsciiWireString.ts';
import { finalizeWireName, hardTruncateUniqueWireName } from './channelExpansion/shortenName.ts';
import {
  pushWireNameCollisionWarning,
  pushWireNameLengthWarning,
} from './channelExpansion/wireNameWarning.ts';

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
  warnings: ExportWarning[],
  isOverride = false,
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();

  if (isOverride || !shorten || maxLen == null) {
    if (isOverride && maxLen != null) {
      const localReserved = new Set<string>();
      const { name: truncated } = hardTruncateUniqueWireName(
        original,
        localReserved,
        maxLen,
        false,
      );
      const exported = sanitiseAsciiWireString(truncated);
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Contact',
        original,
        exported,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
      return exported;
    }

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
  const {
    name: finalized,
    collided,
    stem,
  } = finalizeWireName(original, localReserved, maxLen, {
    allowCallsignSuffixDowngrade: false,
  });
  const exported = sanitiseAsciiWireString(finalized);
  if (collided) {
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Contact',
      candidate: stem,
      disambiguated: exported,
    });
  }
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

/** Pure library-field base for analog contact CPS names — never reads overrides. */
export function analogContactExportBaseName(contact: { name: string }): string {
  const name = contact.name.trim();
  return name || 'Untitled contact';
}

export function resolveAnalogContactExportBaseName(
  contact: { id: string; name: string },
  contactOverrides: readonly BuildEntityOverride[] | undefined,
): string {
  const override = overrideByEntityId(contactOverrides).get(contact.id)?.wireName?.trim();
  if (override) return override;
  return analogContactExportBaseName(contact);
}

export function buildDigitalContactExportWireNameMap(
  contacts: readonly { entity: DigitalContact }[],
  contactOverrides: readonly BuildEntityOverride[] | undefined,
  options: CpsExportOptions | undefined,
  profileId: string,
  warnings: ExportWarning[],
): Map<string, string> {
  const mode = options?.digitalContactExportNameMode ?? DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE;
  const overrideMap = overrideByEntityId(contactOverrides);
  const map = new Map<string, string>();
  for (const row of contacts) {
    const override = overrideMap.get(row.entity.id)?.wireName?.trim();
    const isOverride = Boolean(override);
    const base = isOverride ? override! : digitalContactExportBaseName(row.entity, mode);
    map.set(
      row.entity.id,
      applyDigitalContactExportWireName(base, options, profileId, warnings, isOverride),
    );
  }
  return map;
}
