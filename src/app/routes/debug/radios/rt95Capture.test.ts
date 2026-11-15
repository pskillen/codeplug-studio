import {
  RT95_CALIBRATION_START,
  RT95_CALIBRATION_LENGTH,
} from '@core/radios/retevis/rt95/calibration.ts';
import {
  RT95_CALIBRATION_REGION_ID,
  RT95_CALIBRATION_REGION_PATH,
} from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { describe, expect, it, vi } from 'vitest';
import { createFakeRt95Pipe } from '@integrations/radio-io/radios/rt95/__fixtures__/fakeRt95Pipe.ts';
import { setRt95EndAtForTests } from '@integrations/radio-io/radios/rt95/protocol.ts';
import { openDebugArchive, rt95ArchiveDetails } from './captureArchive.ts';
import { guardRt95ClonePipe } from '@integrations/radio-io/radios/rt95/transportGuard.ts';
import { captureRt95Pipe } from './rt95Capture.ts';

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
    expect(file.manifest.regions.find((r) => r.id === RT95_CALIBRATION_REGION_ID)).toMatchObject({
      address: RT95_CALIBRATION_START,
      byteLength: RT95_CALIBRATION_LENGTH,
      path: RT95_CALIBRATION_REGION_PATH,
    });
    expect(file.regions[RT95_CALIBRATION_REGION_ID]).toEqual(pipe.eeprom.slice(0x3b00, 0x3fc0));
    expect(file.sidecars['debug/ident.bin']).toHaveLength(16);
    expect(pipe.log.filter((e) => e.op === 'R' && e.addr! >= 0x3b00).map((e) => e.addr)).toEqual(
      Array.from({ length: 76 }, (_, i) => 0x3b00 + i * 16),
    );
    expect(pipe.count('END')).toBe(1);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.log.every(({ op }) => ['PROGRAM', 'IDENT', 'R', 'END'].includes(op))).toBe(true);
  }, 30000);
  it('refuses write and unknown frames before reaching the pipe', async () => {
    const pipe = createFakeRt95Pipe();
    const guarded = guardRt95ClonePipe(pipe);
    await expect(guarded.write(new Uint8Array([0x57, 0, 0, 16]))).rejects.toThrow(/refused/);
    await expect(guarded.write(new Uint8Array([0x44]))).rejects.toThrow(/refused/);
    expect(pipe.writes).toHaveLength(0);
  });
  it('ends and closes after a calibration read failure', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe({ silentReadAddrs: [0x3b00] });
    const close = vi.spyOn(pipe, 'close');
    await expect(captureRt95Pipe(pipe)).rejects.toThrow();
    expect(pipe.count('END')).toBe(1);
    expect(pipe.count('W')).toBe(0);
    expect(close).toHaveBeenCalledOnce();
  }, 10000);
  it('ends and closes when cancelled during calibration', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe();
    const controller = new AbortController();
    const write = pipe.write.bind(pipe);
    vi.spyOn(pipe, 'write').mockImplementation(async (frame) => {
      await write(frame);
      if (frame[0] === 0x52 && frame[1] === 0x3b && frame[2] === 0) controller.abort();
    });
    const close = vi.spyOn(pipe, 'close');
    await expect(captureRt95Pipe(pipe, { signal: controller.signal })).rejects.toThrow();
    expect(pipe.count('END')).toBe(1);
    expect(pipe.count('W')).toBe(0);
    expect(close).toHaveBeenCalledOnce();
  }, 10000);
});
