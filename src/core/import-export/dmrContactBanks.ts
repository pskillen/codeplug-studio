import { libraryDigitalIdSet } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { DigitalChannelMode } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { pushGeneralWarning, type ExportWarning } from './exportWarning.ts';

/**
 * Library talk groups and contacts carry a digital `mode`; the factories default it to `'dmr'`.
 * A row with no mode (older data) is treated as DMR.
 */
export function isDmrDigitalEntity(entity: { mode?: DigitalChannelMode | null }): boolean {
  return entity.mode == null || entity.mode === 'dmr';
}

/**
 * DMR IDs of the build's DMR contacts: the set an ID-database directory row is skipped against.
 * Non-DMR contacts are not written, so a directory row sharing one's ID must still be written.
 */
export function dmrContactDigitalIdSet(
  contacts: readonly { entity: { mode?: DigitalChannelMode | null; digitalId: number } }[],
): Set<number> {
  return libraryDigitalIdSet(
    contacts.filter((row) => isDmrDigitalEntity(row.entity)).map((row) => row.entity),
  );
}

/**
 * Keep only DMR talk groups and contacts for a radio whose talk-group and contact banks are
 * DMR-only. RX group lists lose their non-DMR members, and channel TX contacts that point at a
 * skipped entry no longer resolve (no contact). Pushes one warning when anything is skipped.
 */
export function keepDmrTalkGroupsAndContacts(
  assembled: AssembledBuild,
  warnings: ExportWarning[],
): AssembledBuild {
  const talkGroups = assembled.talkGroups.filter((row) => isDmrDigitalEntity(row.entity));
  const digitalContacts = assembled.digitalContacts.filter((row) => isDmrDigitalEntity(row.entity));
  const skippedTalkGroups = assembled.talkGroups.length - talkGroups.length;
  const skippedContacts = assembled.digitalContacts.length - digitalContacts.length;
  if (skippedTalkGroups === 0 && skippedContacts === 0) return assembled;

  const skippedIds = new Set<string>();
  for (const row of assembled.talkGroups) {
    if (!isDmrDigitalEntity(row.entity)) skippedIds.add(row.entity.id);
  }
  for (const row of assembled.digitalContacts) {
    if (!isDmrDigitalEntity(row.entity)) skippedIds.add(row.entity.id);
  }
  let channelsWithoutContact = 0;
  for (const row of assembled.channels) {
    const callsSkipped = row.entity.modeProfiles.some(
      (profile) =>
        profile.mode === 'dmr' &&
        profile.contactRef != null &&
        skippedIds.has(profile.contactRef.id),
    );
    if (callsSkipped) channelsWithoutContact++;
  }

  const channelNote =
    channelsWithoutContact > 0
      ? `; ${channelsWithoutContact} DMR channel(s) that call one are written with no TX contact`
      : '';
  pushGeneralWarning(
    warnings,
    `${skippedTalkGroups} talk group(s) and ${skippedContacts} contact(s) are not DMR (e.g. NXDN) and were left out of the radio's DMR contact lists and RX group lists${channelNote}`,
  );

  // RX group lists drive both the radio's RX lists and the per-member channel fan-out, so drop
  // non-DMR members here rather than in each consumer.
  const rxGroupLists = assembled.rxGroupLists.map((row) => {
    const members = row.entity.members.filter((member) => !skippedIds.has(member.ref.id));
    return members.length === row.entity.members.length
      ? row
      : { ...row, entity: { ...row.entity, members } };
  });

  return { ...assembled, talkGroups, digitalContacts, rxGroupLists };
}
