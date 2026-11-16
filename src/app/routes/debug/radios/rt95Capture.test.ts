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
import { captureRt95Pipe, RT95_CAPTURE_STAGES } from './rt95Capture.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

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
    expect(pipe.log.filter((e) => e.op === 'R' && e.addr! >= 0x3b00).map((e) => e.addr)).toEqual([
      ...Array.from({ length: 76 }, (_, i) => 0x3b00 + i * 16),
      0x3b00,
      0x7b00,
      ...Array.from({ length: 512 }, (_, i) => 0x4000 + i * 16),
    ]);
    expect(pipe.count('END')).toBe(1);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.log.every(({ op }) => ['PROGRAM', 'IDENT', 'R', 'END'].includes(op))).toBe(true);
  }, 30000);
  it('reports progress for every phase, including calibration and MMD1', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe();
    const events: ProgressUpdate[] = [];
    await captureRt95Pipe(pipe, { onProgress: (p) => events.push({ ...p }) });
    const stages = [...new Set(events.map((e) => e.stage))];
    expect(stages).toEqual([...RT95_CAPTURE_STAGES]);
    const last = (stage: string) => events.filter((e) => e.stage === stage).at(-1)!;
    expect(last('Calibration')).toMatchObject({ cur: 76, max: 76 });
    expect(last('MMD1 zones')).toMatchObject({ cur: 512, max: 512 });
    expect(last('Clone image').max).toBeGreaterThan(0);
  }, 30000);
  it('reports MMD1 as skipped when the guard refuses', async () => {
    setRt95EndAtForTests(0);
    const events: ProgressUpdate[] = [];
    await captureRt95Pipe(createFakeRt95Pipe({ aliasing16k: true }), {
      onProgress: (p) => events.push({ ...p }),
    });
    expect(events.filter((e) => e.stage === 'MMD1 zones').at(-1)?.msg).toMatch(/Skipped/);
  }, 30000);
  it('skips MMD1 on an aliased chip and preserves the capture', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe({ aliasing16k: true });
    const capture = await captureRt95Pipe(pipe);
    expect(capture.regions['rt95-mmd1']).toBeUndefined();
    expect(capture.regions[RT95_CALIBRATION_REGION_ID]).toBeDefined();
    expect(pipe.log.some((e) => e.op === 'R' && e.addr === 0x4000)).toBe(false);
    expect(pipe.count('W')).toBe(0);
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
  it('does not publish a capture cancelled during cleanup', async () => {
    setRt95EndAtForTests(0);
    const pipe = createFakeRt95Pipe();
    const controller = new AbortController();
    const close = pipe.close.bind(pipe);
    vi.spyOn(pipe, 'close').mockImplementation(async () => {
      controller.abort();
      await close();
    });
    await expect(captureRt95Pipe(pipe, { signal: controller.signal })).rejects.toThrow();
    expect(pipe.count('END')).toBe(1);
    expect(pipe.close).toHaveBeenCalledOnce();
  }, 30000);
});
