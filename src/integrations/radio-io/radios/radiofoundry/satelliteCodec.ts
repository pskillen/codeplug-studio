/** Library satellites → RadioFoundry records and profiles (docs/reference/radios/radiofoundry/satellite-keps.md). */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { isTransmitterWriteEligible } from '@core/domain/satellite/transmitterWriteEligibility.ts';
import { shortenSatelliteNames } from '@core/domain/satellite/shortenSatelliteNames.ts';
import { RADIOFOUNDRY_LIMITS, type RadioFoundryBand } from '@core/radios/radiofoundry/limits.ts';
import {
  radioFoundrySatelliteProblem,
  radioFoundrySatelliteProfile,
  radioFoundryTransmitterProblem,
} from '@core/radios/radiofoundry/satelliteCapability.ts';
import type { SatelliteWritePreviewEntry } from '../at-d890uv/satelliteCodec.ts';
import { encodeSatelliteName, type RadioFoundrySatelliteRecord } from './satellite.ts';
import type { RadioFoundrySatelliteWriteInput } from './satelliteWrite.ts';

export interface RadioFoundryKepsOptions {
  bands: readonly RadioFoundryBand[];
  satelliteOverrides?: readonly BuildEntityOverride[];
}

export interface RadioFoundrySkippedTransmitter {
  satelliteId: string;
  transmitterId: string;
  reason: string;
}

export type RadioFoundrySatelliteWritePreviewEntry = SatelliteWritePreviewEntry & {
  slot: 'fm';
  slotCandidates: {
    transmitterId: string;
    label: string;
    mode: string | null;
    uplinkHz: number | null;
    downlinkHz: number | null;
  }[];
};

const NOT_CHOSEN = 'Not chosen: RadioFoundry stores one frequency pair per satellite.';

function isAllowedRadioFoundryNameChar(c: string): boolean {
  const code = c.codePointAt(0);
  return code !== undefined && code >= 0x20 && c !== '\u007f';
}

function listCandidates(
  satellite: Satellite,
  bands: readonly RadioFoundryBand[],
): SatelliteTransmitter[] {
  const out: SatelliteTransmitter[] = [];
  for (const tx of satellite.transmitters) {
    if (!isTransmitterWriteEligible(satellite, tx)) continue;
    if (radioFoundryTransmitterProblem(tx, bands) !== null) continue;
    out.push(tx);
  }
  return out;
}

function pickFmWinner(
  candidates: readonly SatelliteTransmitter[],
  satelliteOverrides?: readonly BuildEntityOverride[],
): SatelliteTransmitter | null {
  if (candidates.length === 0) return null;
  let tagged: SatelliteTransmitter | null = null;
  for (const row of satelliteOverrides ?? []) {
    if (row.satelliteBankSlot !== 'fm') continue;
    const hit = candidates.find((tx) => tx.id === row.libraryEntityId);
    if (hit) tagged = hit;
  }
  return tagged ?? candidates[0]!;
}

interface ResolvedWriteRow {
  satellite: Satellite;
  winner: SatelliteTransmitter;
  candidates: SatelliteTransmitter[];
}

function resolveWriteRow(
  satellite: Satellite,
  options: RadioFoundryKepsOptions,
): ResolvedWriteRow | null {
  if (!satellite.enabled) return null;
  if (radioFoundrySatelliteProblem(satellite) !== null) return null;
  const candidates = listCandidates(satellite, options.bands);
  const winner = pickFmWinner(candidates, options.satelliteOverrides);
  if (!winner) return null;
  return { satellite, winner, candidates };
}

function resolveWritten(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): ResolvedWriteRow[] {
  const out: ResolvedWriteRow[] = [];
  for (const satellite of satellites) {
    const row = resolveWriteRow(satellite, options);
    if (row) out.push(row);
  }
  return out;
}

function skippedSatelliteReason(satellite: Satellite, bands: readonly RadioFoundryBand[]): string {
  const satProblem = radioFoundrySatelliteProblem(satellite);
  if (satProblem) return satProblem;
  const eligible = satellite.transmitters.filter((tx) => isTransmitterWriteEligible(satellite, tx));
  if (eligible.length === 0) return 'It has no transmitter marked for write.';
  const problem = radioFoundryTransmitterProblem(eligible[0]!, bands);
  return problem ?? 'RadioFoundry tracks FM satellites only.';
}

function encodeRecordName(
  satellite: Satellite,
  generatedShortName: string,
  wireOverride: string | undefined,
): { name: string; fromOverride: boolean } {
  const chosen = wireOverride?.length ? wireOverride : generatedShortName;
  const decoded = new TextDecoder().decode(
    encodeSatelliteName(chosen, RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES),
  );
  const name = decoded.length > 0 ? decoded : String(satellite.noradId);
  return { name, fromOverride: Boolean(wireOverride?.length) };
}

/** Enabled satellites that will be written, in library order. */
export function listRadioFoundryWriteSatellites(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): Satellite[] {
  return resolveWritten(satellites, options).map((r) => r.satellite);
}

export function countRadioFoundryWriteSatellites(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): number {
  return listRadioFoundryWriteSatellites(satellites, options).length;
}

/** Enabled satellites that will not be written, with one reason each. */
export function radioFoundrySkippedSatellites(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): { satelliteId: string; reason: string }[] {
  const writtenIds = new Set(resolveWritten(satellites, options).map((r) => r.satellite.id));
  return satellites
    .filter((s) => s.enabled && !writtenIds.has(s.id))
    .map((s) => ({
      satelliteId: s.id,
      reason: skippedSatelliteReason(s, options.bands),
    }));
}

/** Transmitters marked for write that are not used, with a reason, for satellites that are written. */
export function radioFoundrySkippedTransmitters(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): RadioFoundrySkippedTransmitter[] {
  const out: RadioFoundrySkippedTransmitter[] = [];
  for (const row of resolveWritten(satellites, options)) {
    for (const tx of row.satellite.transmitters) {
      if (!isTransmitterWriteEligible(row.satellite, tx)) continue;
      if (tx.id === row.winner.id) continue;
      const problem = radioFoundryTransmitterProblem(tx, options.bands);
      out.push({
        satelliteId: row.satellite.id,
        transmitterId: tx.id,
        reason: problem ?? NOT_CHOSEN,
      });
    }
  }
  return out;
}

/** What writeRadioFoundrySatellites sends. No cap here: the writer and the app check it. */
export function packRadioFoundrySatellites(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): RadioFoundrySatelliteWriteInput {
  const written = resolveWritten(satellites, options);
  const shortNames = shortenSatelliteNames(
    written.map(({ satellite }) => ({
      id: satellite.id,
      name: satellite.name,
      noradId: satellite.noradId,
    })),
    {
      maxLength: RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES,
      isAllowedChar: isAllowedRadioFoundryNameChar,
    },
  );
  const overrides = overrideByEntityId(options.satelliteOverrides);
  const records: RadioFoundrySatelliteRecord[] = [];
  const profiles = [];
  for (const { satellite, winner } of written) {
    const wireOverride = overrides.get(satellite.id)?.wireName?.trim();
    const generated = shortNames.get(satellite.id)!.generatedShortName;
    const { name } = encodeRecordName(satellite, generated, wireOverride);
    records.push({
      catalogId: satellite.noradId,
      name,
      line1: satellite.tleLine1,
      line2: satellite.tleLine2,
    });
    profiles.push(radioFoundrySatelliteProfile(satellite.noradId, winner, options.bands));
  }
  return { records, profiles };
}

export function previewRadioFoundrySatelliteWriteRecords(
  satellites: readonly Satellite[],
  options: RadioFoundryKepsOptions,
): RadioFoundrySatelliteWritePreviewEntry[] {
  const written = resolveWritten(satellites, options);
  const shortNames = shortenSatelliteNames(
    written.map(({ satellite }) => ({
      id: satellite.id,
      name: satellite.name,
      noradId: satellite.noradId,
    })),
    {
      maxLength: RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES,
      isAllowedChar: isAllowedRadioFoundryNameChar,
    },
  );
  const overrides = overrideByEntityId(options.satelliteOverrides);
  const entries: RadioFoundrySatelliteWritePreviewEntry[] = [];
  for (const { satellite, winner, candidates } of written) {
    const names = shortNames.get(satellite.id)!;
    const wireOverride = overrides.get(satellite.id)?.wireName?.trim();
    const hasWireNameOverride = Boolean(wireOverride?.length);
    const { name: encodedName } = encodeRecordName(
      satellite,
      names.generatedShortName,
      wireOverride,
    );
    const nameTruncated = encodedName !== satellite.name.trim() && !hasWireNameOverride;
    entries.push({
      satelliteId: satellite.id,
      satelliteName: satellite.name,
      transmitterId: winner.id,
      transmitterLabel: winner.label,
      mode: winner.mode,
      encodedName,
      satelliteWireName: names.generatedShortName,
      generatedWireName: names.generatedShortName,
      suggestedFamiliarEncoded: names.suggestedFamiliar,
      suggestedOscarEncoded: names.suggestedOscar,
      hasWireNameOverride,
      uplinkHz: winner.uplinkHz,
      downlinkHz: winner.downlinkHz,
      nameTruncated,
      slot: 'fm',
      slotCandidates: candidates.map((tx) => ({
        transmitterId: tx.id,
        label: tx.label,
        mode: tx.mode,
        uplinkHz: tx.uplinkHz,
        downlinkHz: tx.downlinkHz,
      })),
    });
  }
  return entries;
}
