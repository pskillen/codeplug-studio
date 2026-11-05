/**
 * OpenGD77 User Database sidecar FLASH spans (outside the programming MemoryMap).
 * Cite: qdmr OpenUV380CallsignDB Offset; occupied bytes only — not size1.
 */

import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  OPENGD77_SECTOR,
  OPENUV380_FLASH_ID_16MIB,
  OPENUV380_VOICE_PROMPTS_MAGIC,
  OPENUV380_VOICE_PROMPTS_VERSION,
} from './constants.ts';
import { type OpenGd77UserDatabaseEncodeResult } from './userDatabaseCodec.ts';

/**
 * FirmwareInfo features bit 1: the User Database loaded at boot is in `'n'` mode, i.e. its second
 * segment sits on the voice prompts (firmware `usb_com.c`). A state, not a capability.
 */
export const OPENGD77_USER_DB_N_MODE_BIT = 1;

/** Warn only when bit 1 is set: an earlier `'n'` upload already overwrote the voice prompts. */
export function openGd77NModeDatabaseWarning(features: number): string | undefined {
  if ((features & (1 << OPENGD77_USER_DB_N_MODE_BIT)) === 0) return undefined;
  return 'The User Database now on this radio was written in the short mode that overwrites the voice prompts, so they are probably gone. This write keeps the voice prompts safe; reflash them with the OpenGD77 CPS voice prompt upload if the radio no longer speaks.';
}

/** What the voice-prompt probe found, or `unknown` when a read failed. */
export type VoicePromptProbe = 'current' | 'legacy-only' | 'none' | 'unknown';

function readU32(b: Uint8Array, at: number): number {
  return (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
}

/**
 * Classify the two 8-byte header reads (`undefined` = the read failed or came back short).
 *
 * The current slot counts only when the firmware would load it: magic AND
 * `OPENUV380_VOICE_PROMPTS_VERSION` (`voicePrompts.c:126-131`). The legacy slot is guarded on the
 * magic alone: a Write that holds back for prompts the firmware may not load costs entries, one
 * that runs over prompts it does load costs the operator's voice.
 */
export function classifyVoicePrompts(
  current: Uint8Array | undefined,
  legacy: Uint8Array | undefined,
): VoicePromptProbe {
  if (!current || !legacy) return 'unknown';
  if (current.byteLength < 8 || legacy.byteLength < 8) return 'unknown';
  if (
    readU32(current, 0) === OPENUV380_VOICE_PROMPTS_MAGIC &&
    readU32(current, 4) === OPENUV380_VOICE_PROMPTS_VERSION
  ) {
    return 'current';
  }
  return readU32(legacy, 0) === OPENUV380_VOICE_PROMPTS_MAGIC ? 'legacy-only' : 'none';
}

export interface UserDatabaseCapDecision {
  cap: number;
  warnings: string[];
}

/**
 * The most entries this Write may send, and why it is lower than the ceiling when it is. Pure, so
 * every refusal is tested without a radio. `probe` is only consulted when more entries than the
 * legacy-voice-prompt cap are wanted; pass `undefined` when it was not taken.
 */
export function resolveUserDatabaseCap(input: {
  flashId: number | undefined;
  features: number;
  wanted: number;
  probe: VoicePromptProbe | undefined;
}): UserDatabaseCapDecision {
  const limits = OPENGD77_FAMILY_LIMITS;
  const warnings: string[] = [];
  let cap = limits.USER_DATABASE_MAX;
  if (input.flashId !== OPENUV380_FLASH_ID_16MIB) {
    cap = limits.USER_DATABASE_MAX_UNCONFIRMED_FLASH;
    warnings.push(
      `This radio did not report the 16 MiB flash part, so the User Database is held to ${cap} entries.`,
    );
  }
  const modeWarning = openGd77NModeDatabaseWarning(input.features);
  if (modeWarning) warnings.push(modeWarning);
  if (input.wanted > limits.USER_DATABASE_MAX_LEGACY_VOICE_PROMPTS) {
    const legacyCap = limits.USER_DATABASE_MAX_LEGACY_VOICE_PROMPTS;
    if (input.probe === 'legacy-only') {
      cap = Math.min(cap, legacyCap);
      warnings.push(
        `This radio keeps its voice prompts in the older flash slot, which a database over ${legacyCap} entries would overwrite. The write is held to ${legacyCap} entries. Reinstall the voice prompts with the OpenGD77 CPS to lift this.`,
      );
    } else if (input.probe === 'unknown' || input.probe === undefined) {
      cap = Math.min(cap, legacyCap);
      warnings.push(
        `Studio could not check where this radio keeps its voice prompts, so the write is held to ${legacyCap} entries to keep them safe.`,
      );
    }
  }
  return { cap, warnings };
}

export interface UserDatabaseFlashSpan {
  abs: number;
  data: Uint8Array;
}

export function userDatabaseFlashSpans(
  encoded: OpenGd77UserDatabaseEncodeResult,
): UserDatabaseFlashSpan[] {
  const entries0 = new Uint8Array(encoded.header.byteLength + encoded.entries0.byteLength);
  entries0.set(encoded.header, 0);
  entries0.set(encoded.entries0, encoded.header.byteLength);
  const spans: UserDatabaseFlashSpan[] = [{ abs: encoded.headerAbs, data: entries0 }];
  if (encoded.entries1.byteLength > 0) {
    spans.push({ abs: encoded.entries1Abs, data: encoded.entries1 });
  }
  return spans;
}

export function userDatabaseSectorAbsSet(spans: readonly UserDatabaseFlashSpan[]): number[] {
  const sectors = new Set<number>();
  for (const span of spans) {
    const start = Math.floor(span.abs / OPENGD77_SECTOR) * OPENGD77_SECTOR;
    const end = span.abs + span.data.byteLength;
    for (let sectorAbs = start; sectorAbs < end; sectorAbs += OPENGD77_SECTOR) {
      sectors.add(sectorAbs);
    }
  }
  return [...sectors].sort((a, b) => a - b);
}

export function overlayUserDatabaseSpanOnSector(
  sector: Uint8Array,
  sectorAbs: number,
  span: UserDatabaseFlashSpan,
): void {
  const spanEnd = span.abs + span.data.byteLength;
  const sectorEnd = sectorAbs + sector.byteLength;
  const from = Math.max(span.abs, sectorAbs);
  const to = Math.min(spanEnd, sectorEnd);
  if (to <= from) return;
  sector.set(span.data.subarray(from - span.abs, to - span.abs), from - sectorAbs);
}

/**
 * Occupied-sector payloads from encode only (0x00 fill). Do not RMW-read FLASH —
 * qdmr callsign upload writes encoded blocks after write_start, never a prior read
 * of 0x50000. The host owns the whole sector here, so every block is sent (unlike
 * codeplug sectors, which send only in-span blocks).
 */
export function buildUserDatabaseSectorPayloads(
  encoded: OpenGd77UserDatabaseEncodeResult,
): Map<number, Uint8Array> {
  const spans = userDatabaseFlashSpans(encoded);
  const payloads = new Map<number, Uint8Array>();
  for (const sectorAbs of userDatabaseSectorAbsSet(spans)) {
    const sector = new Uint8Array(OPENGD77_SECTOR);
    for (const span of spans) {
      overlayUserDatabaseSpanOnSector(sector, sectorAbs, span);
    }
    payloads.set(sectorAbs, sector);
  }
  return payloads;
}
