/**
 * Typed OpenGD77 flash-write errors carrying where in the write they happened.
 * Messages reach the Write stepper's error text unchanged, so they say it all.
 */

import { RadioProtocolError, RadioTimeoutError } from '../../kit/errors.ts';
import { hexBytes } from '../../kit/frameTrace.ts';

export type OpenGd77WriteCommand = 'set-sector' | 'sector-buffer' | 'finish' | 'verify';
export type OpenGd77WritePhase = 'codeplug' | 'user-database' | 'keps' | 'restore';

export interface OpenGd77WriteContext {
  command: OpenGd77WriteCommand;
  /** Absolute FLASH address of the sector being programmed. */
  sectorAbs: number;
  /** Offset of the block within the sector (0 for set-sector / finish). */
  offset: number;
  /** 1-based position in this write's sector list. */
  sectorIndex: number;
  sectorsTotal: number;
  phase: OpenGd77WritePhase;
  /** Unexpected bytes found on the line (set by {@link OpenGd77WriteStaleBytesError}). */
  staleBytes?: Uint8Array;
}

const COMMAND_LABEL: Record<OpenGd77WriteCommand, string> = {
  'set-sector': 'SET_SECTOR',
  'sector-buffer': 'SECTOR_BUFFER',
  finish: 'FINISH',
  verify: 'read-back',
};

const PHASE_LABEL: Record<OpenGd77WritePhase, string> = {
  codeplug: 'FLASH',
  'user-database': 'User Database FLASH',
  keps: 'FLASH',
  restore: 'restore FLASH',
};

/** `SECTOR_BUFFER for FLASH sector 0x9c000 at +0x40 (sector 3 of 12)` */
export function describeOpenGd77WriteContext(ctx: OpenGd77WriteContext): string {
  const at =
    ctx.command === 'sector-buffer' || ctx.command === 'verify'
      ? ` at +0x${ctx.offset.toString(16)}`
      : '';
  return `${COMMAND_LABEL[ctx.command]} for ${PHASE_LABEL[ctx.phase]} sector 0x${ctx.sectorAbs.toString(16)}${at} (sector ${ctx.sectorIndex} of ${ctx.sectorsTotal})`;
}

/** The radio answered a write command with the one-byte NACK `'-'`. */
export class OpenGd77WriteNackError extends RadioProtocolError {
  readonly context: OpenGd77WriteContext;

  constructor(context: OpenGd77WriteContext) {
    super(`OpenGD77 refused ${describeOpenGd77WriteContext(context)}: radio answered '-'.`);
    this.name = 'OpenGd77WriteNackError';
    this.context = context;
  }
}

/** The radio answered with two bytes that are not the `{type, cmd}` echo. */
export class OpenGd77WriteDesyncError extends RadioProtocolError {
  readonly context: OpenGd77WriteContext;
  readonly received: Uint8Array;

  constructor(context: OpenGd77WriteContext, received: Uint8Array) {
    super(
      `OpenGD77 sent an unexpected reply to ${describeOpenGd77WriteContext(context)}: ${hexBytes(received)}.`,
    );
    this.name = 'OpenGd77WriteDesyncError';
    this.context = context;
    this.received = received;
  }
}

/** No reply within the I/O timeout; carries where the write stood. */
export class OpenGd77WriteTimeoutError extends RadioTimeoutError {
  readonly context: OpenGd77WriteContext;

  constructor(context: OpenGd77WriteContext, timeoutMs: number, cause: string) {
    super(
      `OpenGD77 got no reply to ${describeOpenGd77WriteContext(context)} within ${timeoutMs} ms (${cause}).`,
    );
    this.name = 'OpenGd77WriteTimeoutError';
    this.context = context;
  }
}

/** Bytes were already on the line when a frame was about to be sent: a split frame's stray reply. */
export class OpenGd77WriteStaleBytesError extends RadioProtocolError {
  readonly context: OpenGd77WriteContext;

  constructor(context: OpenGd77WriteContext, stale: Uint8Array) {
    super(
      `OpenGD77 had ${stale.length} unexpected byte(s) on the line before ${describeOpenGd77WriteContext(context)}: ${hexBytes(stale)}.`,
    );
    this.name = 'OpenGd77WriteStaleBytesError';
    this.context = { ...context, staleBytes: stale };
  }
}

/** The sector was programmed but reading it back gave different bytes (or no answer). */
export class OpenGd77WriteVerifyError extends RadioProtocolError {
  readonly context: OpenGd77WriteContext;

  constructor(context: OpenGd77WriteContext, detail: string) {
    super(`OpenGD77 read-back of ${describeOpenGd77WriteContext(context)} failed: ${detail}.`);
    this.name = 'OpenGd77WriteVerifyError';
    this.context = context;
  }
}
