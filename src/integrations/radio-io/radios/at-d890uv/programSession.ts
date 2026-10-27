/**
 * AT-D890UV PROGRAM-session write latch (#1406): no `R` after the first `W` until `END`.
 *
 * Why. The first `W` into an erase unit erases its non-live half, and only `END` promotes it
 * (docs/reference/radios/anytone/at-d890uv/flash-sectors.md). An `R` into another unit switches
 * the firmware's PC-link unit state, so the unit being written when the `R` arrives is never
 * marked and `END` does not promote it; an `R` as the last command before `END` makes `END`
 * commit nothing at all. Emulator-confirmed (anytone-d890-firmware F274 to F278, Q82).
 *
 * How. State is keyed on the **pipe**, not on a caller, and the three functions below sit at the
 * lowest send primitives in `connection.ts` (`atD890ReadBlockRaw`, `atD890WriteMemory`,
 * `atD890ExitProgram`). Any other D890 sender that writes its own frames opts in by calling the
 * same three functions around its `pipe.write`.
 *
 * - The latch is set **before** a `W` frame is written, so a `W` the radio may have received
 *   counts even when its ACK never arrives.
 * - It is cleared only by `END`. A fresh `PROGRAM` on the same pipe does **not** clear it: a
 *   session abandoned without `END` leaves the radio's unit state unknown.
 * - A new pipe object starts clean.
 * - A refused read throws before any byte is sent.
 *
 * Abandoned sessions (#1406). Leaving PROGRAM without `END` keeps the unit in progress safe, but
 * every unit the session had already finished keeps its PC marker and is committed by the next
 * write-mode `END` from any tool. {@link recordAtD890AbandonedSession} persists those units
 * (`pendingUnits.ts`, per radio: any read that covers the LocalInfo serial ties the pipe to its
 * radio), and {@link gateAtD890Write} refuses, before the first `W`, any write that would not
 * rewrite them. A session cut off with no error (tab closed, crash) is covered by an in-progress
 * marker written at each new unit entered and removed at `END`.
 */

import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import { D890_MAP } from './constants.ts';
import { isAtD890DigitalContactUnit } from './digitalContactUnits.ts';
import {
  LOCAL_INFO_SERIAL_LENGTH,
  LOCAL_INFO_SERIAL_OFFSET,
  formatAtD890LocalInfoSerial,
} from './identityCheck.ts';
import {
  AT_D890_UNKNOWN_RADIO,
  AtD890PendingUnitsError,
  clearAtD890PendingUnits,
  findAtD890PendingBlock,
  markAtD890WriteInProgress,
  recordAtD890PendingUnits,
  settleAtD890InProgress,
} from './pendingUnits.ts';

export class AtD890ReadAfterWriteError extends RadioProtocolError {
  constructor(
    readonly readAddress: number,
    readonly firstWriteAddress: number,
  ) {
    super(
      `AT-D890UV: refused an R at 0x${readAddress.toString(16)} after the first W at ` +
        `0x${firstWriteAddress.toString(16)} in this PROGRAM session. A read between writes stops ` +
        `the radio committing the unit it was writing.`,
    );
    this.name = 'AtD890ReadAfterWriteError';
  }
}

/** Cumulative for the pipe's life. `END` does not reset them. */
export interface AtD890ProgramCounters {
  rFrames: number;
  rBytes: number;
  wFrames: number;
  /** W frames whose erase unit differs from the previous W's. */
  wUnitsEntered: number;
}

interface AtD890ProgramSessionState {
  firstWriteAddress?: number;
  firstWriteAtMs?: number;
  counters: AtD890ProgramCounters;
  /** Erase units entered by `W` since the last `END`, in order, consecutive repeats collapsed. */
  unitsEntered: number[];
  /** Units a caller has said this session will write beyond the ones it names to the gate. */
  declaredUnits: Set<number>;
  /** The pending-units gate has passed for this session. */
  gated: boolean;
  /** LocalInfo serial seen on this pipe; `''` until a read covered it. */
  serial: string;
  /** Names this session's in-progress marker in storage. */
  sessionId: string;
  /** Radio bucket the in-progress marker was written under. */
  markedRadio?: string;
  /** Pending units this session must rewrite (set by the gate). */
  mustRewrite: number[];
  /** Pending contact units outside the new contact plan: dead data, cleared by `END` (F276). */
  deadContactUnits: number[];
}

let sessionCounter = 0;

const sessions = new WeakMap<BytePipe, AtD890ProgramSessionState>();

function stateFor(pipe: BytePipe): AtD890ProgramSessionState {
  let st = sessions.get(pipe);
  if (!st) {
    st = {
      counters: { rFrames: 0, rBytes: 0, wFrames: 0, wUnitsEntered: 0 },
      unitsEntered: [],
      declaredUnits: new Set(),
      gated: false,
      serial: '',
      sessionId: `${Date.now().toString(36)}-${(sessionCounter++).toString(36)}`,
      mustRewrite: [],
      deadContactUnits: [],
    };
    sessions.set(pipe, st);
  }
  return st;
}

/** Call before each `W` frame's `pipe.write`, resends included. */
export function noteAtD890WriteFrame(pipe: BytePipe, address: number): void {
  const st = stateFor(pipe);
  if (st.firstWriteAddress === undefined) {
    // Backstop: a sender that never called the gate may not write while units are pending.
    if (!st.gated) {
      const block = findAtD890PendingBlock(st.serial);
      if (block) throw new AtD890PendingUnitsError(block);
      st.gated = true;
    }
    st.firstWriteAddress = address;
    st.firstWriteAtMs = Date.now();
  }
  st.counters.wFrames += 1;
  const unit = eraseUnitBaseFor(address);
  if (st.unitsEntered[st.unitsEntered.length - 1] !== unit) {
    st.unitsEntered.push(unit);
    st.counters.wUnitsEntered += 1;
    // A tab closed or a crash from here on sends no `END` and throws nothing: leave a marker.
    st.markedRadio = st.serial || AT_D890_UNKNOWN_RADIO;
    markAtD890WriteInProgress(st.markedRadio, st.sessionId, st.unitsEntered);
  }
}

/**
 * Call with the bytes of every completed read. When the read covered the LocalInfo serial, the
 * pipe is tied to that radio: pending-unit records are kept and checked per radio.
 */
export function noteAtD890ReadCompleted(pipe: BytePipe, address: number, data: Uint8Array): void {
  const need = LOCAL_INFO_SERIAL_OFFSET + LOCAL_INFO_SERIAL_LENGTH;
  const rel = D890_MAP.LocalInfo - address;
  if (rel < 0 || rel + need > data.length) return;
  const serial = formatAtD890LocalInfoSerial(data.subarray(rel, rel + need));
  if (serial) stateFor(pipe).serial = serial;
}

/** The LocalInfo serial seen on this pipe, `''` when none has been read. */
export function getAtD890SessionSerial(pipe: BytePipe): string {
  return stateFor(pipe).serial;
}

/** Call before each `R` frame's `pipe.write`. Throws, sending nothing, in the write phase. */
export function assertAtD890ReadAllowed(pipe: BytePipe, address: number, length: number): void {
  const st = stateFor(pipe);
  if (st.firstWriteAddress !== undefined) {
    throw new AtD890ReadAfterWriteError(address, st.firstWriteAddress);
  }
  st.counters.rFrames += 1;
  st.counters.rBytes += length;
}

/** Call before `END` is sent. Clears the write phase. */
export function noteAtD890ProgramExited(pipe: BytePipe): void {
  const st = stateFor(pipe);
  st.firstWriteAddress = undefined;
  st.firstWriteAtMs = undefined;
  st.unitsEntered = [];
}

export function readAtD890ProgramCounters(pipe: BytePipe): AtD890ProgramCounters {
  return { ...stateFor(pipe).counters };
}

/** Whether a `W` has been sent since the last `END` (the radio may hold uncommitted units). */
export function isAtD890WritePhase(pipe: BytePipe): boolean {
  return stateFor(pipe).firstWriteAddress !== undefined;
}

/** Erase units entered by `W` since the last `END`, in order. */
export function listAtD890UnitsEntered(pipe: BytePipe): readonly number[] {
  return [...stateFor(pipe).unitsEntered];
}

/**
 * Tell the gate which units this session will also write (the app knows the contact units before
 * `upload()` runs). Additive; call before {@link gateAtD890Write}.
 */
export function declareAtD890PlannedUnits(pipe: BytePipe, units: readonly number[]): void {
  const st = stateFor(pipe);
  for (const u of units) st.declaredUnits.add(u);
}

/**
 * Before the first `W`: units pending from an interrupted Write to **this radio** must all be
 * rewritten by this session (`plannedUnits` plus the declared ones), else throw
 * {@link AtD890PendingUnitsError} having sent nothing. Passing marks the session so later senders
 * in it are not re-checked. Returns the pending units this session must rewrite.
 *
 * Contact order and data units beyond the new contact count are dead data (anytone-d890-firmware
 * F276: the firmware reads `count * 8` order entries and the self-terminating record stream), so
 * when this session rewrites the contact header they count as satisfied and `END` clears them.
 * This is never relaxed for codeplug units, nor when the header is not rewritten.
 */
export function gateAtD890Write(
  pipe: BytePipe,
  plannedUnits: readonly number[],
): readonly number[] {
  const st = stateFor(pipe);
  if (st.gated) return [...st.mustRewrite];
  const block = findAtD890PendingBlock(st.serial);
  st.mustRewrite = [];
  st.deadContactUnits = [];
  if (block) {
    if (block.hard) throw new AtD890PendingUnitsError(block);
    const planned = new Set([...st.declaredUnits, ...plannedUnits]);
    const headerRewritten = planned.has(D890_MAP.DigitalContactMeta);
    for (const u of block.units) {
      if (planned.has(u)) st.mustRewrite.push(u);
      else if (
        headerRewritten &&
        u !== D890_MAP.DigitalContactMeta &&
        isAtD890DigitalContactUnit(u)
      )
        st.deadContactUnits.push(u);
      else throw new AtD890PendingUnitsError(block);
    }
  }
  st.gated = true;
  return [...st.mustRewrite];
}

/**
 * The session is being left without `END`. Every unit it had finished (all entered, except the
 * one in progress) keeps its PC marker, so persist them. Returns the units recorded.
 */
export function recordAtD890AbandonedSession(pipe: BytePipe): readonly number[] {
  const st = stateFor(pipe);
  const finished = st.unitsEntered.slice(0, -1);
  const radio = st.markedRadio ?? (st.serial || AT_D890_UNKNOWN_RADIO);
  recordAtD890PendingUnits(radio, finished);
  settleAtD890InProgress(radio, st.sessionId);
  st.gated = false;
  return finished;
}

/**
 * After `END` was sent: the units this session wrote are committed, so no longer pending. The
 * same `END` promotes the dead contact units the gate waved through, so they go too, but only
 * when the contact header was actually written.
 */
export function commitAtD890SessionUnits(pipe: BytePipe, units: readonly number[]): void {
  const st = stateFor(pipe);
  const dead = units.includes(D890_MAP.DigitalContactMeta) ? st.deadContactUnits : [];
  clearAtD890PendingUnits(
    st.markedRadio ?? (st.serial || AT_D890_UNKNOWN_RADIO),
    [...units, ...dead],
    st.sessionId,
  );
  st.markedRadio = undefined;
  st.deadContactUnits = [];
  st.mustRewrite = [];
}
