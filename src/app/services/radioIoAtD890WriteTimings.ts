/**
 * Per-stage timings and frame counts for an AT-D890UV Write (#1406).
 *
 * Wraps the progress callback in a stage timeline that also samples the pipe's `R` and `W` frame
 * counters, so each stage reports its duration and the frames it sent. `END` is sent later, when
 * the session closes, so it is not timed. The result is a single console line, and the same line
 * is returned to the stepper for its Copy write timings button.
 */

import {
  createStageTimeline,
  type StageTimeline,
} from '@integrations/radio-io/kit/stageTimeline.ts';
import { readAtD890ProgramCounters } from '@integrations/radio-io/radios/at-d890uv/programSession.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';

export const D890_WRITE_TIMING_PREFIX = '[d890-write-timing] ';

export interface AtD890WriteTiming {
  timeline: StageTimeline;
  /** Stop timing, log once to the console, and return the line (prefix plus JSON). */
  finish(info: {
    profileId: string;
    contacts: number;
    /** Omitted: `ok`. */
    outcome?: 'ok' | 'failed' | 'aborted';
  }): string;
}

/** `undefined` for any session that is not an AT-D890UV. */
export function startAtD890WriteTiming(
  session: RadioSession,
  onProgress: ProgressFn | undefined,
): AtD890WriteTiming | undefined {
  if (!(session.radio instanceof AtD890uvProtocol)) return undefined;
  const timeline = createStageTimeline(onProgress, Date.now, () => {
    const c = readAtD890ProgramCounters(session.pipe);
    return { rFrames: c.rFrames, rBytes: c.rBytes, wFrames: c.wFrames, wUnits: c.wUnitsEntered };
  });
  return {
    timeline,
    finish({ profileId, contacts, outcome = 'ok' }) {
      const line =
        D890_WRITE_TIMING_PREFIX +
        JSON.stringify({ profileId, contacts, outcome, ...timeline.report(), untimed: ['END'] });
      console.info(line);
      return line;
    },
  };
}
