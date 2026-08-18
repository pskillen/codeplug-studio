import type { EntityRef, EntityRefKind, Library } from '@core/models/library.ts';
import { validateEntityRef } from '@core/domain/validation.ts';
import { MODE_EXPORT_NAME_SUFFIXES } from './modeExportSuffix.ts';

const ENTITY_REF_KINDS = new Set<EntityRefKind>([
  'channel',
  'talkGroup',
  'digitalContact',
  'analogContact',
]);

const MODE_SUFFIX_SET = new Set<string>(MODE_EXPORT_NAME_SUFFIXES);

/** Second segment of m×n scratch companion override keys (`{channelId}:scratch`). */
export const SCRATCH_WIRE_KEY_SUFFIX = 'scratch';

export type ChannelOverrideKey =
  | { kind: 'plain'; channelId: string }
  | { kind: 'expansion'; channelId: string; modeSuffix: string }
  | { kind: 'scratch'; channelId: string }
  | { kind: 'multiMember'; channelId: string; modeSuffix: string; memberRef: EntityRef };

/** Build override key for an m×n scratch companion row. */
export function scratchWireKey(channelId: string): string {
  return `${channelId}:${SCRATCH_WIRE_KEY_SUFFIX}`;
}

function parseModeSuffix(value: string): string | null {
  return MODE_SUFFIX_SET.has(value) ? value : null;
}

/** Parse a build channel override key — plain channel UUID or composite expansion key. */
export function parseChannelOverrideKey(libraryEntityId: string): ChannelOverrideKey {
  if (!libraryEntityId.includes(':')) {
    return { kind: 'plain', channelId: libraryEntityId };
  }

  const parts = libraryEntityId.split(':');
  if (parts.length === 2) {
    const channelId = parts[0];
    const second = parts[1] ?? '';
    if (!channelId) {
      throw new Error(`Invalid channel override key: ${libraryEntityId}`);
    }
    if (second === SCRATCH_WIRE_KEY_SUFFIX) {
      return { kind: 'scratch', channelId };
    }
    const modeSuffix = parseModeSuffix(second);
    if (!modeSuffix) {
      throw new Error(`Invalid channel override key: ${libraryEntityId}`);
    }
    return { kind: 'expansion', channelId, modeSuffix };
  }

  if (parts.length === 4) {
    const channelId = parts[0];
    const modeSuffix = parseModeSuffix(parts[1] ?? '');
    const refKind = parts[2];
    const refId = parts[3];
    if (!channelId || !modeSuffix || !refId || !ENTITY_REF_KINDS.has(refKind as EntityRefKind)) {
      throw new Error(`Invalid channel override key: ${libraryEntityId}`);
    }
    return {
      kind: 'multiMember',
      channelId,
      modeSuffix,
      memberRef: { kind: refKind as EntityRefKind, id: refId },
    };
  }

  throw new Error(`Invalid channel override key: ${libraryEntityId}`);
}

export function validateChannelOverrideKey(libraryEntityId: string, library: Library): void {
  const parsed = parseChannelOverrideKey(libraryEntityId);
  const channelIds = new Set(library.channels.map((channel) => channel.id));

  if (!channelIds.has(parsed.channelId)) {
    throw new Error(`Channel override channel ${parsed.channelId} not found in library`);
  }

  if (parsed.kind === 'multiMember') {
    validateEntityRef(parsed.memberRef, library);
  }
}
