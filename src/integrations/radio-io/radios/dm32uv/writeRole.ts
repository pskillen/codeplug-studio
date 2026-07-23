/**
 * DM-32UV write-role manifest — single source of truth for encode vs retain.
 * Cite: tier-3 memory-layout.md; target write contract (#667+ siblings).
 */

import { DM32_METADATA } from './constants.ts';
import type { Dm32BlockType } from './memory.ts';
import { channelBlocksNeeded } from './memory.ts';

export type Dm32WriteRole = 'replaced' | 'kept';

export interface Dm32WriteRoleHint {
  /** Addresses used as channel banks for library channel encode. */
  channelBankAddresses?: ReadonlySet<number>;
  address?: number;
}

/** Operator-facing labels for replaced categories (Written from your build). */
export const DM32_WRITTEN_FROM_BUILD_LABELS: readonly string[] = [
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX group lists',
  'Contacts',
  'APRS settings',
] as const;

/** Operator-facing block label from metadata byte (no hex in output). */
export function dm32BlockLabel(metadata: number, type: Dm32BlockType): string {
  if (metadata >= DM32_METADATA.CHANNEL_FIRST && metadata <= DM32_METADATA.CHANNEL_LAST) {
    return metadata === DM32_METADATA.CHANNEL_FIRST ? 'Channel bank (first)' : 'Channel bank';
  }
  switch (metadata) {
    case DM32_METADATA.VFO_SETTINGS:
      return 'Radio settings';
    case DM32_METADATA.ZONE:
      return 'Zone data';
    case DM32_METADATA.SCAN_LIST:
      return 'Scan lists';
    case DM32_METADATA.TX_CONTACT_LOW:
      return 'TX contacts (channels 1–2048)';
    case DM32_METADATA.TX_CONTACT_HIGH:
      return 'TX contacts (channels 2049+)';
    case DM32_METADATA.TALK_GROUPS:
      return 'Talk groups';
    case DM32_METADATA.CONFIG_TG_COUNTER:
      return 'Talk group counter';
    case DM32_METADATA.METADATA_0x0B:
      return 'Talk group quick access';
    case DM32_METADATA.RX_GROUPS:
      return 'RX group lists';
    case DM32_METADATA.QUICK_MESSAGES:
      return 'Quick text messages';
    case DM32_METADATA.CALIBRATION:
      return 'Calibration';
    case DM32_METADATA.DMR_RADIO_IDS:
      return 'Operator radio IDs';
    case DM32_METADATA.VFO_BANK:
      return 'VFO A/B';
    case DM32_METADATA.ANALOG_EMERGENCY:
      return 'Analog emergency';
    case 0x03:
      return 'Digital emergency';
    case DM32_METADATA.EMPTY:
    case DM32_METADATA.EMPTY_ALT:
      return 'Empty';
    default:
      break;
  }
  switch (type) {
    case 'zone':
      return 'Zone data';
    case 'scan':
      return 'Scan lists';
    case 'rxgroup':
      return 'RX group lists';
    case 'message':
      return 'Quick text messages';
    case 'calibration':
      return 'Calibration';
    case 'dmrradioid':
      return 'Operator radio IDs';
    case 'digitalemergency':
      return 'Digital emergency';
    case 'analogemergency':
      return 'Analog emergency';
    case 'config':
      return 'Talk group counter';
    case 'vfo':
      return 'Radio settings';
    case 'empty':
      return 'Empty';
    default:
      return 'Unknown region';
  }
}

/**
 * Whether a sparse block is rewritten from library/build on Write, or kept from Read.
 */
export function dm32WriteRole(
  metadata: number,
  type: Dm32BlockType,
  hint?: Dm32WriteRoleHint,
): Dm32WriteRole {
  if (metadata === DM32_METADATA.TX_CONTACT_LOW || metadata === DM32_METADATA.TX_CONTACT_HIGH) {
    return 'replaced';
  }
  if (
    metadata === DM32_METADATA.TALK_GROUPS ||
    metadata === DM32_METADATA.METADATA_0x0B ||
    metadata === DM32_METADATA.CONFIG_TG_COUNTER
  ) {
    return 'replaced';
  }
  if (type === 'zone' || type === 'scan' || type === 'rxgroup') {
    return 'replaced';
  }
  if (type === 'channel') {
    const addr = hint?.address;
    const banks = hint?.channelBankAddresses;
    if (metadata === DM32_METADATA.VFO_BANK && addr !== undefined && banks && !banks.has(addr)) {
      return 'kept';
    }
    return 'replaced';
  }
  if (metadata === DM32_METADATA.VFO_SETTINGS || type === 'vfo') {
    return 'kept';
  }
  if (metadata === DM32_METADATA.VFO_BANK) {
    return 'kept';
  }
  if (type === 'empty') {
    return 'kept';
  }
  return 'kept';
}

export function dm32ChannelBankAddresses(
  discovered: readonly { address: number; metadata: number }[],
  channelCount: number,
): Set<number> {
  const channelBlocks = discovered
    .filter(
      (b) =>
        b.metadata >= DM32_METADATA.CHANNEL_FIRST && b.metadata <= DM32_METADATA.CHANNEL_LAST,
    )
    .map((b) => ({
      address: b.address,
      metadata: b.metadata,
      type: 'channel' as const,
    }));
  return new Set(channelBlocksNeeded(channelBlocks, channelCount).map((b) => b.address));
}

export function dm32IsRequiredMetadata(metadata: number): boolean {
  return (
    metadata === DM32_METADATA.VFO_SETTINGS ||
    metadata === DM32_METADATA.DIGITAL_EMERGENCY ||
    metadata === DM32_METADATA.VFO_BANK ||
    metadata === DM32_METADATA.QUICK_MESSAGES ||
    metadata === DM32_METADATA.METADATA_0x0B ||
    metadata === DM32_METADATA.DMR_RADIO_IDS ||
    metadata === DM32_METADATA.CALIBRATION ||
    metadata === DM32_METADATA.RX_GROUPS ||
    metadata === DM32_METADATA.TALK_GROUPS ||
    metadata === DM32_METADATA.CONFIG_TG_COUNTER ||
    metadata === DM32_METADATA.TX_CONTACT_LOW ||
    metadata === DM32_METADATA.TX_CONTACT_HIGH
  );
}
