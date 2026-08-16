import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  libraryFromAssembledOrStub,
  overridesFromAssembledWireNames,
  resolveWireNamesFromOptions,
} from '@core/services/resolveWireNamesCore.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  type NeonplugDm32uvRadioProfile,
} from './profiles.ts';
import type { NeonplugContact } from './wireTypes.ts';

export interface NeonplugContactsExport {
  contacts: NeonplugContact[];
  /** Studio entity UUID → NeonPlug contacts-book `id` (1-based). */
  contactIdByEntityId: Map<string, number>;
}

function truncateOptional(value: string | undefined, maxLen: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Talk groups first, then digital contacts → NeonPlug `contacts[]`.
 * Cap at profile `maxContacts` (250). Analog/DTMF omitted.
 */
export function serialiseNeonplugContacts(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  options: CpsExportOptions | undefined,
  warnings: ExportWarning[],
): NeonplugContactsExport {
  const contacts: NeonplugContact[] = [];
  const contactIdByEntityId = new Map<string, number>();
  const max = profile.maxContacts;
  const library = libraryFromAssembledOrStub(assembled);
  const mergedOptions = { ...options, profileId: profile.id };

  const talkGroupWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library,
    entityKind: 'talkGroup',
    formatId: 'neonplug',
    profileId: profile.id,
    options: mergedOptions,
    overrides: overridesFromAssembledWireNames(assembled.talkGroups, (row) => row.entity.id),
  })) {
    talkGroupWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Talk group',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId: profile.id,
    });
  }

  const contactWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library,
    entityKind: 'contact',
    formatId: 'neonplug',
    profileId: profile.id,
    options: mergedOptions,
    overrides: options?.contactOverrides,
  })) {
    contactWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Contact',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId: profile.id,
    });
  }

  for (const row of assembled.talkGroups) {
    if (contacts.length >= max) break;
    const id = contacts.length + 1;
    const name = talkGroupWireNames.get(row.entity.id) ?? row.wireName;
    contacts.push({
      id,
      name,
      dmrId: row.entity.digitalId,
    });
    contactIdByEntityId.set(row.entity.id, id);
  }

  for (const row of assembled.digitalContacts) {
    if (contacts.length >= max) break;
    const id = contacts.length + 1;
    const name = contactWireNames.get(row.entity.id) ?? row.wireName;
    const contact: NeonplugContact = {
      id,
      name,
      dmrId: row.entity.digitalId,
    };
    const callSign = truncateOptional(row.entity.callsign, 7);
    if (callSign) contact.callSign = callSign;
    const city = truncateOptional(row.entity.city, 16);
    if (city) contact.city = city;
    const province = truncateOptional(row.entity.state, 16);
    if (province) contact.province = province;
    const country = truncateOptional(row.entity.country, 16);
    if (country) contact.country = country;
    const remark = truncateOptional(row.entity.remarks, 16);
    if (remark) contact.remark = remark;
    contacts.push(contact);
    contactIdByEntityId.set(row.entity.id, id);
  }

  return { contacts, contactIdByEntityId };
}

export function serialiseNeonplugContactsForProfile(
  assembled: AssembledBuild,
  profileId: string,
  options: CpsExportOptions | undefined,
  warnings: ExportWarning[],
): NeonplugContactsExport {
  const profile = getNeonplugProfile(profileId);
  if (!isNeonplugDm32uvProfile(profile)) {
    return { contacts: [], contactIdByEntityId: new Map() };
  }
  return serialiseNeonplugContacts(assembled, profile, options, warnings);
}
