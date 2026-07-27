/**
 * Pre-encode validation for AT-D890UV MR channel records (WATCH-08).
 */

import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';

/** AM airband lives in a separate bank on D890 — never MR channel slots. */
export const AT_D890_AM_AIRBAND_MIN_HZ = 108_000_000;
export const AT_D890_AM_AIRBAND_MAX_HZ = 137_000_000;

export class AtD890ChannelEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtD890ChannelEncodeError';
  }
}

function isAmAirbandHz(hz: number): boolean {
  return hz >= AT_D890_AM_AIRBAND_MIN_HZ && hz <= AT_D890_AM_AIRBAND_MAX_HZ;
}

function assertBcdEncodableFrequencyHz(hz: number, label: string, slotIndex: number): void {
  if (!Number.isFinite(hz) || hz <= 0) {
    throw new AtD890ChannelEncodeError(
      `AT-D890UV channel ${slotIndex}: ${label} must be a positive frequency in Hz`,
    );
  }
  const units10Hz = Math.round(hz / 10);
  const digits = String(units10Hz).padStart(8, '0').slice(-8);
  if (!/^\d{8}$/.test(digits)) {
    throw new AtD890ChannelEncodeError(
      `AT-D890UV channel ${slotIndex}: ${label} ${hz} Hz is not BCD-encodable for Anytone wire format`,
    );
  }
  const roundTrip = encodeBcdFrequencyHz(hz);
  const decodedUnits = Number.parseInt(
    Array.from(roundTrip)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    10,
  );
  if (decodedUnits * 10 !== Math.round(hz / 10) * 10) {
    throw new AtD890ChannelEncodeError(
      `AT-D890UV channel ${slotIndex}: ${label} ${hz} Hz failed BCD encode round-trip`,
    );
  }
}

/** Fail before encode when MR slot carries airband or illegal frequency values. */
export function assertAtD890MrChannelFrequencies(ch: RadioChannelDto): void {
  if (ch.empty) return;
  if (ch.rxHz <= 0) {
    if (ch.rxHz < 0) {
      throw new AtD890ChannelEncodeError(
        `AT-D890UV channel ${ch.slotIndex}: RX frequency must be a positive frequency in Hz`,
      );
    }
    return;
  }
  const slotIndex = ch.slotIndex;
  const rxHz = ch.rxHz;
  const txHz = ch.txHz > 0 ? ch.txHz : rxHz;

  assertBcdEncodableFrequencyHz(rxHz, 'RX frequency', slotIndex);
  if (txHz > 0) {
    assertBcdEncodableFrequencyHz(txHz, 'TX frequency', slotIndex);
  }

  if (isAmAirbandHz(rxHz)) {
    throw new AtD890ChannelEncodeError(
      `AT-D890UV channel ${slotIndex}: RX ${rxHz} Hz is AM airband (108–137 MHz) — airband belongs in the separate AmAir bank, not MR channel slots`,
    );
  }
  if (isAmAirbandHz(txHz)) {
    throw new AtD890ChannelEncodeError(
      `AT-D890UV channel ${slotIndex}: TX ${txHz} Hz is AM airband (108–137 MHz) — airband belongs in the separate AmAir bank, not MR channel slots`,
    );
  }
}
