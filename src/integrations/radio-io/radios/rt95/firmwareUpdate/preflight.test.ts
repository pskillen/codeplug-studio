import { describe, expect, it } from 'vitest';

import { RadioInterlockError, RadioWrongIdentError } from '../../../kit/errors.ts';
import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import { checkRt95PreflightOutgoing, createRt95HeadPreflightProbe } from './preflight.ts';

const probe = createRt95HeadPreflightProbe({ retryDelayMs: 0 });
const run = (mock: Rt95BootloaderMock, signal?: AbortSignal) => probe.run(mock, { signal });

describe('RT95 pre-flight probe', () => {
  it('reads the model and version in normal mode, sending exactly PROGRAM, 02 and END', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal' });
    await expect(run(mock)).resolves.toEqual({ summary: 'RT95-P, version V100' });
    expect(mock.log).toEqual(['PROGRAM', 'ident', 'END']);
    expect(mock.received).toEqual([
      ...new TextEncoder().encode('PROGRAM'),
      0x02,
      ...new TextEncoder().encode('END'),
    ]);
  });

  it('runs at the codeplug baud rate, not the update baud rate', () => {
    expect(probe.link.baudRate).toBe(9600);
  });

  it('ignores the first PROGRAMs after a Studio read (F43), then passes', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal', ignoreProgramFor: 3 });
    await expect(run(mock)).resolves.toMatchObject({ summary: 'RT95-P, version V100' });
    expect(mock.log.filter((l) => l === 'PROGRAM')).toHaveLength(4);
    expect(mock.log.at(-1)).toBe('END');
  });

  it('refuses a first-revision RT95 and still sends END', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal', model: 'RT95' });
    const err = await run(mock).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioWrongIdentError);
    expect((err as Error).message).toMatch(/reports RT95 V100\. Studio flashes only the RT95-P/);
    expect((err as Error).message).toMatch(/Nothing was written/);
    expect(mock.log.at(-1)).toBe('END');
  });

  it('refuses another version and still sends END', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal', version: 'V101' });
    await expect(run(mock)).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(mock.log.at(-1)).toBe('END');
  });

  it('fails a silent radio after 5 attempts with nothing but PROGRAMs sent', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'silent' });
    await expect(run(mock)).rejects.toThrow(/did not answer after 5 tries/);
    expect(mock.log).toEqual(['PROGRAM', 'PROGRAM', 'PROGRAM', 'PROGRAM', 'PROGRAM']);
  });

  it('stops retrying when aborted', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const mock = new Rt95BootloaderMock({ mode: 'silent' });
    await expect(run(mock, ctl.signal)).rejects.toThrow();
    expect(mock.log).toEqual([]);
  });
});

describe('RT95 pre-flight outgoing gate', () => {
  it('allows exactly PROGRAM, 02 and END', () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    for (const f of [enc('PROGRAM'), Uint8Array.of(0x02), enc('END')]) {
      expect(() => checkRt95PreflightOutgoing(f)).not.toThrow();
    }
  });

  it('refuses a codeplug write frame, the update end byte, a data frame and an empty frame', () => {
    const w = Uint8Array.of(0x57, 0x00, 0x10, 0x10, ...new Uint8Array(16), 0x10, 0x06);
    for (const f of [w, Uint8Array.of(0x18), new Uint8Array(1032), new Uint8Array(0)]) {
      expect(() => checkRt95PreflightOutgoing(f)).toThrow(RadioInterlockError);
    }
  });
});
