import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
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
  warnings: string[],
): NeonplugContactsExport {
  const contacts: NeonplugContact[] = [];
  const contactIdByEntityId = new Map<string, number>();
  const reserved = new Set<string>();
  const max = profile.maxContacts;

  for (const row of assembled.talkGroups) {
    if (contacts.length >= max) break;
    const id = contacts.length + 1;
    const name = applyListWireNameLimits(
      row.wireName,
      reserved,
      options,
      profile.id,
      warnings,
      'Talk group',
      profile.nameLimit,
    );
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
    const name = applyListWireNameLimits(
      row.wireName,
      reserved,
      options,
      profile.id,
      warnings,
      'Contact',
      profile.nameLimit,
    );
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
  warnings: string[],
): NeonplugContactsExport {
  const profile = getNeonplugProfile(profileId);
  if (!isNeonplugDm32uvProfile(profile)) {
    return { contacts: [], contactIdByEntityId: new Map() };
  }
  return serialiseNeonplugContacts(assembled, profile, options, warnings);
}
