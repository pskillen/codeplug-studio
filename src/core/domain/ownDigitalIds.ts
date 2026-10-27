/**
 * Digital IDs: the operator's own DMR and NXDN IDs, what the radio sends.
 *
 * Not the `digitalId` number on a talk group or contact (who you call) and not the ID directory
 * (the downloaded lookup list). One ID per protocol can be the default; a channel either uses the
 * default (`ownDigitalIdId` null) or names one.
 */
import type { ProjectAggregate } from '../import-export/projectDocument.ts';
import { newId } from '../models/ids.ts';
import { initialRevision, isoNow } from '../models/revision.ts';
import type { OwnDigitalId, OwnDigitalIdProtocol } from '../models/library.ts';
import { NXDN_ID_MAX, NXDN_ID_MIN } from './validation.ts';

export const OWN_DIGITAL_ID_PROTOCOLS: readonly OwnDigitalIdProtocol[] = ['dmr', 'nxdn'];

export const DMR_OWN_ID_MIN = 1;
export const DMR_OWN_ID_MAX = 16_776_415;

/** Inclusive number range per protocol. */
export const OWN_ID_RANGE: Record<OwnDigitalIdProtocol, readonly [number, number]> = {
  dmr: [DMR_OWN_ID_MIN, DMR_OWN_ID_MAX],
  nxdn: [NXDN_ID_MIN, NXDN_ID_MAX],
};

export function ownDigitalIdProtocolLabel(protocol: OwnDigitalIdProtocol): string {
  return protocol === 'dmr' ? 'DMR' : 'NXDN';
}

/** What a list or select shows for an ID: its name, else "DMR 2351234" / "NXDN 1234". */
export function ownDigitalIdLabel(row: Pick<OwnDigitalId, 'name' | 'protocol' | 'number'>): string {
  return row.name.trim() || `${ownDigitalIdProtocolLabel(row.protocol)} ${row.number}`;
}

/** "Name (number)" for a named ID, else "DMR 2351234". */
export function ownDigitalIdOptionLabel(
  row: Pick<OwnDigitalId, 'name' | 'protocol' | 'number'>,
): string {
  const name = row.name.trim();
  return name ? `${name} (${row.number})` : ownDigitalIdLabel(row);
}

/** Range error for a number in a protocol, or `null` when it is in range. */
export function ownDigitalIdRangeError(
  protocol: OwnDigitalIdProtocol,
  number: number,
): string | null {
  const [min, max] = OWN_ID_RANGE[protocol];
  if (!Number.isInteger(number) || number < min || number > max) {
    return `${ownDigitalIdProtocolLabel(protocol)} IDs are ${min}–${max}`;
  }
  return null;
}

/** Errors that block saving an ID: unknown protocol, range, or the same number twice in a protocol. */
export function validateOwnDigitalId(
  row: Pick<OwnDigitalId, 'id' | 'protocol' | 'number'>,
  all: readonly Pick<OwnDigitalId, 'id' | 'protocol' | 'number'>[],
): string[] {
  const errors: string[] = [];
  if (!OWN_DIGITAL_ID_PROTOCOLS.includes(row.protocol)) {
    errors.push('Protocol must be DMR or NXDN');
    return errors;
  }
  const rangeError = ownDigitalIdRangeError(row.protocol, row.number);
  if (rangeError) errors.push(rangeError);
  const duplicate = all.some(
    (other) =>
      other.id !== row.id && other.protocol === row.protocol && other.number === row.number,
  );
  if (duplicate) {
    errors.push(
      `${ownDigitalIdProtocolLabel(row.protocol)} ID ${row.number} is already in Digital IDs`,
    );
  }
  return errors;
}

/**
 * The default ID of a protocol, or `null`. If a half-finished two-row write left several rows
 * marked, the one with the smallest `id` wins so every reader agrees.
 */
export function defaultOwnDigitalId(
  all: readonly OwnDigitalId[],
  protocol: OwnDigitalIdProtocol,
): OwnDigitalId | null {
  let best: OwnDigitalId | null = null;
  for (const row of all) {
    if (row.protocol !== protocol || !row.isDefault) continue;
    if (best === null || row.id < best.id) best = row;
  }
  return best;
}

/** Whether a new ID of this protocol should be created as the default (the first one is). */
export function newOwnDigitalIdIsDefault(
  all: readonly OwnDigitalId[],
  protocol: OwnDigitalIdProtocol,
): boolean {
  return !all.some((row) => row.protocol === protocol);
}

/** Protocols that have IDs but no default (after the default was deleted, or after migration). */
export function protocolsWithoutDefault(all: readonly OwnDigitalId[]): OwnDigitalIdProtocol[] {
  return OWN_DIGITAL_ID_PROTOCOLS.filter(
    (protocol) =>
      all.some((row) => row.protocol === protocol) && defaultOwnDigitalId(all, protocol) === null,
  );
}

/** Protocols where more than one row is marked default. */
export function protocolsWithSeveralDefaults(all: readonly OwnDigitalId[]): OwnDigitalIdProtocol[] {
  return OWN_DIGITAL_ID_PROTOCOLS.filter(
    (protocol) => all.filter((row) => row.protocol === protocol && row.isDefault).length > 1,
  );
}

/** Library-page notices about the default rules. */
export function ownDigitalIdWarnings(all: readonly OwnDigitalId[]): string[] {
  const warnings: string[] = [];
  for (const protocol of protocolsWithoutDefault(all)) {
    const label = ownDigitalIdProtocolLabel(protocol);
    warnings.push(
      `No default ${label} ID. Channels set to Default use whatever ${label} ID the radio already has, and some radios send none, until you choose one.`,
    );
  }
  for (const protocol of protocolsWithSeveralDefaults(all)) {
    warnings.push(
      `More than one default ${ownDigitalIdProtocolLabel(protocol)} ID. Set one as the default to fix it.`,
    );
  }
  // A number outside the protocol's range can arrive from an older project (migration keeps it so
  // channels keep their choice) or a hand-edited file. It stays in the list; the notice says so.
  for (const row of all) {
    if (!OWN_DIGITAL_ID_PROTOCOLS.includes(row.protocol)) continue;
    const rangeError = ownDigitalIdRangeError(row.protocol, row.number);
    if (rangeError) {
      warnings.push(
        `${ownDigitalIdLabel(row)} is out of range (${rangeError}). Open it and enter a valid number, or delete it.`,
      );
    }
  }
  return warnings;
}

/** The part of a mode profile that names an own ID. */
export interface OwnIdProfileChoice {
  mode: string;
  ownDigitalIdId?: string | null;
}

/** Protocol of a mode profile that carries an own ID, or `null` for other modes. */
export function ownIdProtocolOfMode(mode: string): OwnDigitalIdProtocol | null {
  return mode === 'dmr' || mode === 'nxdn' ? mode : null;
}

/**
 * The ID a channel profile sends: the row it names (when it exists and is the profile's protocol),
 * else the protocol's default, else `null`.
 */
export function resolveChannelOwnId(
  profile: OwnIdProfileChoice,
  all: readonly OwnDigitalId[],
): { row: OwnDigitalId; source: 'override' | 'default' } | null {
  const protocol = ownIdProtocolOfMode(profile.mode);
  if (!protocol) return null;
  const override = channelOwnIdOverride(profile, all);
  if (override) return { row: override, source: 'override' };
  const fallback = defaultOwnDigitalId(all, protocol);
  return fallback ? { row: fallback, source: 'default' } : null;
}

/** The ID a profile names explicitly; never the default. `null` when it names none or a bad one. */
export function channelOwnIdOverride(
  profile: OwnIdProfileChoice,
  all: readonly OwnDigitalId[],
): OwnDigitalId | null {
  const protocol = ownIdProtocolOfMode(profile.mode);
  if (!protocol || !profile.ownDigitalIdId) return null;
  const row = all.find((candidate) => candidate.id === profile.ownDigitalIdId);
  return row && row.protocol === protocol ? row : null;
}

/** Legacy profile numbers, before `ownDigitalIdId`: input-only, never part of the model. */
export interface LegacyModeProfileIds {
  /** DMR profile: the number typed on the channel. */
  dmrId?: number | null;
  /** NXDN profile: the number typed on the channel. */
  unitId?: number | null;
}

function legacyNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Turn the per-channel `dmrId` / `unitId` numbers of an older project into Digital IDs.
 *
 * Each distinct (protocol, number) not already in `existing` becomes one unnamed, non-default row,
 * in order of first appearance. The profile then chooses that row. A null or non-positive legacy
 * number (0 included: it means "no override") becomes `ownDigitalIdId: null` (Default). A number
 * above the protocol's range is kept as a row, so the channel keeps its choice; the library page
 * warns about it. Pure and idempotent: profiles without a legacy
 * key are left as they are, and a channel with none is returned as the same object.
 */
export function migrateLegacyOwnIds<C extends { modeProfiles: readonly object[] }>(
  projectId: string,
  channels: readonly C[],
  existing: readonly OwnDigitalId[],
  makeId: () => string = newId,
): { channels: C[]; ownDigitalIds: OwnDigitalId[] } {
  const rows: OwnDigitalId[] = [...existing];
  const rowFor = (
    protocol: OwnDigitalIdProtocol,
    number: number,
    updatedAt: string,
  ): OwnDigitalId => {
    const found = rows.find((row) => row.protocol === protocol && row.number === number);
    if (found) return found;
    const created: OwnDigitalId = {
      id: makeId(),
      projectId,
      revision: initialRevision(),
      updatedAt,
      name: '',
      protocol,
      number,
      isDefault: false,
    };
    rows.push(created);
    return created;
  };

  const migrated = channels.map((channel) => {
    let changed = false;
    // A format change, not an edit: the new row is as old as the channel that introduced it.
    const stamp = (channel as { updatedAt?: string }).updatedAt ?? isoNow();
    // A partial or very old row may have no profiles; leave it alone (normalizeChannel does the same).
    const modeProfiles = (channel.modeProfiles ?? []).map((profile) => {
      const legacy = profile as { mode?: string } & LegacyModeProfileIds & OwnIdProfileChoice;
      const key = legacy.mode === 'dmr' ? 'dmrId' : legacy.mode === 'nxdn' ? 'unitId' : null;
      if (!key || !(key in legacy)) return profile;
      changed = true;
      const { [key]: legacyValue, ...rest } = legacy;
      const number = legacyNumber(legacyValue);
      const protocol: OwnDigitalIdProtocol = key === 'dmrId' ? 'dmr' : 'nxdn';
      const ownDigitalIdId =
        number !== null ? rowFor(protocol, number, stamp).id : (legacy.ownDigitalIdId ?? null);
      return { ...rest, ownDigitalIdId };
    });
    return changed ? ({ ...channel, modeProfiles } as C) : channel;
  });

  return {
    channels: migrated,
    ownDigitalIds: rows.length === existing.length ? [...existing] : rows,
  };
}

/**
 * Aggregate form of {@link migrateLegacyOwnIds}: runs on every YAML, Drive and seed load and on
 * YAML export, so it must stay idempotent.
 */
export function migrateOwnDigitalIdsAggregate(aggregate: ProjectAggregate): ProjectAggregate {
  const existing = aggregate.ownDigitalIds ?? [];
  const { channels, ownDigitalIds } = migrateLegacyOwnIds(
    aggregate.meta.projectId,
    aggregate.channels,
    existing,
  );
  const unchanged =
    ownDigitalIds.length === existing.length &&
    channels.every((c, i) => c === aggregate.channels[i]);
  if (unchanged && aggregate.ownDigitalIds) return aggregate;
  return { ...aggregate, channels, ownDigitalIds };
}
