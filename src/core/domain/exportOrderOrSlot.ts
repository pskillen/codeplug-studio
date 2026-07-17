import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { Channel } from '@core/models/library.ts';
import type { FlatMemoryLayout } from '@core/models/traitLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  isEntityExcluded,
  overrideOrderOrSlot,
  upsertOverride,
} from '@core/domain/formatBuildOverrides.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import { isChirpAnalogueExportable } from '@core/import-export/formats/chirp/channelWire.ts';

/** One row in a top-level export list; `channelId` null → blank memory slot (CHIRP). */
export interface ExportMemorySlot {
  /** 1-based export location (CHIRP `Location`). */
  slot: number;
  channelId: string | null;
}

export function buildUsesFlatMemoryList(build: FormatBuild): boolean {
  const profile = traitProfileFor(build.profileId);
  return profile?.traits.includes(BuildCapabilityTrait.FlatMemoryList) ?? false;
}

export function findFlatMemorySection(build: FormatBuild): FlatMemoryLayout | undefined {
  return build.layout.sections.find((s): s is FlatMemoryLayout => s.kind === 'flatMemory');
}

export function isChirpFlatMemoryChannel(channel: Channel): boolean {
  return isChirpAnalogueExportable(channel);
}

function chirpEligibleChannel(build: FormatBuild, channel: Channel): boolean {
  if (build.formatId === 'chirp' && !isChirpFlatMemoryChannel(channel)) {
    return false;
  }
  return true;
}

function includedChirpChannels(build: FormatBuild, library: LibrarySlice): Channel[] {
  return library.channels.filter(
    (channel) =>
      chirpEligibleChannel(build, channel) && !isEntityExcluded(build.channelOverrides, channel.id),
  );
}

/** Resolve CHIRP memory slots from sparse overrides; gaps become blank slots. */
export function resolveChirpChannelMemorySlots(
  build: FormatBuild,
  library: LibrarySlice,
): ExportMemorySlot[] {
  const included = includedChirpChannels(build, library);
  const explicit: { slot: number; channelId: string }[] = [];
  const implicit: string[] = [];

  for (const channel of included) {
    const slot = overrideOrderOrSlot(build.channelOverrides, channel.id);
    if (slot != null) {
      explicit.push({ slot, channelId: channel.id });
    } else {
      implicit.push(channel.id);
    }
  }

  const slotToChannel = new Map<number, string>();
  const bumped: string[] = [];

  for (const entry of explicit.sort((a, b) => a.slot - b.slot)) {
    if (!slotToChannel.has(entry.slot)) {
      slotToChannel.set(entry.slot, entry.channelId);
    } else {
      bumped.push(entry.channelId);
    }
  }

  const implicitIds = [...implicit, ...bumped];
  if (implicitIds.length > 0) {
    const maxExplicit = explicit.length > 0 ? Math.max(...explicit.map((row) => row.slot)) : 0;
    let nextSlot = maxExplicit > 0 ? maxExplicit + 1 : 1;
    for (const channelId of implicitIds) {
      while (slotToChannel.has(nextSlot)) nextSlot++;
      slotToChannel.set(nextSlot, channelId);
      nextSlot++;
    }
  }

  if (slotToChannel.size === 0) return [];

  const maxSlot = Math.max(...slotToChannel.keys());
  const slots: ExportMemorySlot[] = [];
  for (let slot = 1; slot <= maxSlot; slot++) {
    slots.push({ slot, channelId: slotToChannel.get(slot) ?? null });
  }
  return slots;
}

/** Channel ids in memory-slot order (blanks omitted). */
export function chirpMemoryChannelIds(build: FormatBuild, library: LibrarySlice): string[] {
  return resolveChirpChannelMemorySlots(build, library)
    .map((row) => row.channelId)
    .filter((id): id is string => id != null);
}

/** Persist dense 1…n order for the given included channel ids; clears order on others. */
export function applyDenseChannelOrderOrSlots(
  overrides: BuildEntityOverride[],
  orderedChannelIds: string[],
): BuildEntityOverride[] {
  return applyDenseOrderOrSlots(overrides, orderedChannelIds);
}

/** Persist dense 1…n `orderOrSlot` for any entity override list. */
export function applyDenseOrderOrSlots(
  overrides: BuildEntityOverride[],
  orderedEntityIds: string[],
): BuildEntityOverride[] {
  const ordered = new Set(orderedEntityIds);
  let next = overrides;
  for (const row of overrides) {
    if (!ordered.has(row.libraryEntityId) && row.orderOrSlot != null) {
      next = upsertOverride(next, row.libraryEntityId, { orderOrSlot: undefined });
    }
  }
  for (let index = 0; index < orderedEntityIds.length; index++) {
    next = upsertOverride(next, orderedEntityIds[index]!, { orderOrSlot: index + 1 });
  }
  return next;
}

/** True when any override row carries a finite 1-based `orderOrSlot`. */
export function hasAnyOrderOrSlotOverride(
  overrides: BuildEntityOverride[] | undefined,
): boolean {
  return (overrides ?? []).some((row) => {
    const value = row.orderOrSlot;
    return value != null && Number.isFinite(value) && value >= 1;
  });
}

/**
 * Clear `orderOrSlot` on every override row.
 * Empty rows (no other fields) are dropped by {@link upsertOverride}.
 */
export function clearAllOrderOrSlots(
  overrides: BuildEntityOverride[] | undefined,
): BuildEntityOverride[] {
  let next = overrides ?? [];
  for (const row of overrides ?? []) {
    if (row.orderOrSlot == null) continue;
    next = upsertOverride(next, row.libraryEntityId, { orderOrSlot: undefined });
  }
  return next;
}

/** Confirm copy for clearing build export-order overrides (permanent, like Sort…). */
export function exportOrderResetConfirmMessage(): string {
  return (
    'Reset export order to the library default?\n\n' +
    'This clears build order overrides. Restoring the previous build order requires manual reorder.'
  );
}

/** Order-only migration when library is unavailable (IndexedDB read). */
export function migrateFlatMemoryLayoutOrderOnly(build: FormatBuild): FormatBuild {
  const flatMemory = findFlatMemorySection(build);
  if (!flatMemory) return build;

  let channelOverrides = [...build.channelOverrides];
  flatMemory.channelIds.forEach((channelId, index) => {
    channelOverrides = upsertOverride(channelOverrides, channelId, { orderOrSlot: index + 1 });
  });

  return {
    ...build,
    channelOverrides,
    layout: {
      sections: build.layout.sections.filter((section) => section.kind !== 'flatMemory'),
    },
  };
}
/** Convert legacy flat-memory layout to orderOrSlot overrides and strip the section. */
export function migrateFlatMemoryLayoutToOrderOrSlot(
  build: FormatBuild,
  library: LibrarySlice,
): FormatBuild {
  const flatMemory = findFlatMemorySection(build);
  if (!flatMemory) return build;

  const inList = new Set(flatMemory.channelIds);
  let channelOverrides = [...build.channelOverrides];

  flatMemory.channelIds.forEach((channelId, index) => {
    channelOverrides = upsertOverride(channelOverrides, channelId, { orderOrSlot: index + 1 });
  });

  for (const channel of library.channels) {
    if (!chirpEligibleChannel(build, channel)) continue;
    if (inList.has(channel.id)) continue;
    if (isEntityExcluded(channelOverrides, channel.id)) continue;
    channelOverrides = upsertOverride(channelOverrides, channel.id, { excluded: true });
  }

  return {
    ...build,
    channelOverrides,
    layout: {
      sections: build.layout.sections.filter((section) => section.kind !== 'flatMemory'),
    },
  };
}
