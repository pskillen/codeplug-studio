import type { ContactStoreKind } from '../../../services/egress/writeShellOptions.ts';

function sharedContactBankPhrase(contactBankSlots?: number): string {
  if (contactBankSlots != null) {
    return `the ${contactBankSlots}-slot DMR contact bank`;
  }
  return "the radio's DMR contact bank";
}

export function contactSourceHint(
  store: ContactStoreKind,
  radioLabel: string,
  contactBankSlots?: number,
): string {
  const bank = sharedContactBankPhrase(contactBankSlots);
  switch (store) {
    case 'shared-contact-bank':
      return `Talk groups and contacts use ${bank}. ID directory writes the firmware User Database for incoming-call lookup. ID directory does not fill ${bank}; ID directory alone leaves prior FLASH contacts. Contacts or Both replaces talk groups and contacts in that bank.`;
    case 'shared-address-book':
      return 'Contacts and the ID directory share one address book. ID directory or Both replaces that book. Duplicate DMR IDs: contacts win. Operator radio IDs come from your Digital IDs when the codeplug is written; contacts alone do not rewrite them.';
    case 'separate-lookup-database':
      return `Contacts always go to the radio's Contacts list with the codeplug, after talk groups, so channels and RX group lists can call them. This part writes the radio's ID database, which names incoming calls: your contacts, the ID directory, or both. ID directory rows for a DMR ID that is already a contact are skipped, so the radio shows your name for it. Unticked leaves the ID database as it is. Without Codeplug, ${radioLabel} still re-sends the codeplug image.`;
    default:
      return 'Contacts are the ones you curate and call. The ID directory is bulk lookup-only data. Both: contacts win on duplicate DMR ID.';
  }
}
