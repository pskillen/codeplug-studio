import { describe, expect, it } from 'vitest';
import { createFakeRt95Pipe } from '@integrations/radio-io/radios/rt95/__fixtures__/fakeRt95Pipe.ts';
import { setRt95EndAtForTests } from '@integrations/radio-io/radios/rt95/protocol.ts';
import { openDebugArchive, rt95ArchiveDetails } from './captureArchive.ts';
import { captureRt95Pipe, guardRt95DebugPipe } from './rt95Capture.ts';

describe('RT95 debug capture', () => {
  it('captures via read-only frames and reopens identical region bytes', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe();
    const live = await captureRt95Pipe(pipe);
    const file = openDebugArchive(live.zipBytes, 'retevis-rt95');
    expect(live.source).toBe('live-read');
    expect(file.manifest).toEqual(live.manifest);
    expect(file.regions).toEqual(live.regions);
    expect(rt95ArchiveDetails(file)?.missing).toEqual([]);
    expect(rt95ArchiveDetails(file)?.summary).toBeTruthy();
    expect(pipe.count('W')).toBe(0);
    expect(pipe.log.every(({ op }) => ['PROGRAM', 'IDENT', 'R', 'END'].includes(op))).toBe(true);
  }, 30000);
  it('refuses write and unknown frames before reaching the pipe', async () => {
    const pipe = createFakeRt95Pipe();
    const guarded = guardRt95DebugPipe(pipe);
    await expect(guarded.write(new Uint8Array([0x57, 0, 0, 16]))).rejects.toThrow(/refused/);
    await expect(guarded.write(new Uint8Array([0x44]))).rejects.toThrow(/refused/);
    expect(pipe.writes).toHaveLength(0);
  });
});
