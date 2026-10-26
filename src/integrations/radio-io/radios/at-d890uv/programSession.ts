/**
 * AT-D890UV PROGRAM-session write latch (#1406): no `R` after the first `W` until `END`.
 *
 * Why. The first `W` into an erase unit erases its non-live half, and only `END` promotes it
 * (docs/reference/radios/anytone/at-d890uv/flash-sectors.md). An `R` into another unit switches
 * the firmware's PC-link unit state, so the unit being written when the `R` arrives is never
 * marked and `END` does not promote it; an `R` as the last command before `END` makes `END`
 * commit nothing at all. Emulator-confirmed (anytone-d890-firmware F248 to F251, Q78).
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
 */

import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';

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
}

const sessions = new WeakMap<BytePipe, AtD890ProgramSessionState>();

function stateFor(pipe: BytePipe): AtD890ProgramSessionState {
  let st = sessions.get(pipe);
  if (!st) {
    st = {
      counters: { rFrames: 0, rBytes: 0, wFrames: 0, wUnitsEntered: 0 },
      unitsEntered: [],
    };
    sessions.set(pipe, st);
  }
  return st;
}

/** Call before each `W` frame's `pipe.write`, resends included. */
export function noteAtD890WriteFrame(pipe: BytePipe, address: number): void {
  const st = stateFor(pipe);
  if (st.firstWriteAddress === undefined) {
    st.firstWriteAddress = address;
    st.firstWriteAtMs = Date.now();
  }
  st.counters.wFrames += 1;
  const unit = eraseUnitBaseFor(address);
  if (st.unitsEntered[st.unitsEntered.length - 1] !== unit) {
    st.unitsEntered.push(unit);
    st.counters.wUnitsEntered += 1;
  }
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
