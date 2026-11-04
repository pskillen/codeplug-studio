/** The `[d890-write-timing]` line carries the pipe's byte and rotation counters (#1548). */

import { describe, expect, it, vi } from 'vitest';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { BytePipe, RadioSession } from '@integrations/radio-io/types.ts';
import { D890_WRITE_TIMING_PREFIX, startAtD890WriteTiming } from './radioIoAtD890WriteTimings.ts';

function sessionWith(pipe: object): RadioSession {
  return { radio: new AtD890uvProtocol(), pipe: pipe as BytePipe } as unknown as RadioSession;
}

function parse(line: string): Record<string, unknown> {
  expect(line.startsWith(D890_WRITE_TIMING_PREFIX)).toBe(true);
  return JSON.parse(line.slice(D890_WRITE_TIMING_PREFIX.length));
}

describe('startAtD890WriteTiming finish line', () => {
  it('carries txBytesWritten and writerRotations from a pipe that reports them', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const timing = startAtD890WriteTiming(
      sessionWith({ txBytesWritten: 3_050_000, writerRotations: 2 }),
      undefined,
    );
    const out = parse(timing!.finish({ profileId: 'p', contacts: 5 }));
    expect(out.txBytesWritten).toBe(3_050_000);
    expect(out.writerRotations).toBe(2);
  });

  it('omits both fields for a pipe that does not report them', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const timing = startAtD890WriteTiming(sessionWith({}), undefined);
    const out = parse(timing!.finish({ profileId: 'p', contacts: 0 }));
    expect('txBytesWritten' in out).toBe(false);
    expect('writerRotations' in out).toBe(false);
  });
});
