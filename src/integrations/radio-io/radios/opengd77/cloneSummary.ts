/**
 * Read-only summary of an OpenGD77 / OpenUV380 radio-clone hydration bag.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { decodeChannelsFromImage } from './channelCodec.ts';
import { decodeContactsFromImage } from './contactCodec.ts';
import { OPENGD77_CHANNEL_SLOTS } from './constants.ts';
import { memoryMapFromOpenGd77Hydration } from './hydration.ts';
import { decodeRxGroupsFromImage } from './rxGroupCodec.ts';
import {
  ancillaryRetainPreview,
  settingsRetainPreview,
  type OpenGd77AncillaryRetainPreview,
  type OpenGd77RetainPreviewRow,
} from './retainPreview.ts';
import {
  OPENGD77_APRS_WRITE_GAP,
  OPENGD77_DTMF_CONTACTS_WRITE_GAP,
  OPENGD77_WRITTEN_FROM_BUILD_LABELS,
  openGd77KeptRegions,
} from './writeRole.ts';
import { decodeZonesFromImage } from './zoneCodec.ts';
import { inspectOccupiedChannels, type CloneInspectNamedItem } from '../../cloneInspect.ts';
import { userDatabaseCountFromOccupied } from './userDatabaseCodec.ts';

export interface OpenGd77OnRadioCounts {
  occupiedChannels: number;
  emptyChannelSlots: number;
  zoneCount: number;
  contactCount: number;
  rxGroupCount: number;
  /** Occupied User Database entries when the backup captured that region. */
  userDatabaseCount?: number;
}

export interface OpenGd77RetainGroupSummary {
  label: string;
  regionCount: number;
  role: string;
}

export interface OpenGd77CloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  onRadioCounts: OpenGd77OnRadioCounts;
  writtenFromBuild: readonly string[];
  dtmfContactsWriteGap: string;
  aprsWriteGap: string;
  retainGroups: readonly OpenGd77RetainGroupSummary[];
  settingsRetain: readonly OpenGd77RetainPreviewRow[];
  ancillaryRetain: OpenGd77AncillaryRetainPreview;
  inspectChannels: readonly CloneInspectNamedItem[];
  inspectZones: readonly CloneInspectNamedItem[];
  inspectContacts: readonly CloneInspectNamedItem[];
  inspectRxGroups: readonly CloneInspectNamedItem[];
}

function buildRetainGroups(): OpenGd77RetainGroupSummary[] {
  return openGd77KeptRegions().map((r) => ({
    label: r.label,
    regionCount: 1,
    role: r.retainRoleCopy,
  }));
}

export function summariseOpenGd77Clone(
  bag: RadioCloneHydrationBag,
  userDatabaseOccupied?: Uint8Array,
): OpenGd77CloneSummary {
  const image = memoryMapFromOpenGd77Hydration(bag);
  const channels = decodeChannelsFromImage(image);
  const occupied = channels.filter((c) => !c.empty).length;
  const contacts = decodeContactsFromImage(image);
  const contactsByIndex = new Map(contacts.map((c) => [c.index, c.digitalId]));
  const zones = decodeZonesFromImage(image);
  const rxGroups = decodeRxGroupsFromImage(image, contactsByIndex);

  return {
    radioModelId: bag.retain.radioModelId,
    firmware: bag.retain.firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    onRadioCounts: {
      occupiedChannels: occupied,
      emptyChannelSlots: OPENGD77_CHANNEL_SLOTS - occupied,
      zoneCount: zones.length,
      contactCount: contacts.length,
      rxGroupCount: rxGroups.length,
      userDatabaseCount: userDatabaseCountFromOccupied(userDatabaseOccupied),
    },
    writtenFromBuild: [...OPENGD77_WRITTEN_FROM_BUILD_LABELS],
    dtmfContactsWriteGap: OPENGD77_DTMF_CONTACTS_WRITE_GAP,
    aprsWriteGap: OPENGD77_APRS_WRITE_GAP,
    retainGroups: buildRetainGroups(),
    settingsRetain: settingsRetainPreview(image),
    ancillaryRetain: ancillaryRetainPreview(image),
    inspectChannels: inspectOccupiedChannels(channels),
    inspectZones: zones.map((z, i) => ({ slotIndex: i + 1, name: z.wireName })),
    inspectContacts: contacts.map((c) => ({ slotIndex: c.index, name: c.wireName })),
    inspectRxGroups: rxGroups.map((g) => ({ slotIndex: g.index, name: g.wireName })),
  };
}
