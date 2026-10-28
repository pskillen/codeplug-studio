import { describe, expect, it } from 'vitest';
import { RadioTimeoutError } from '../../../kit/errors.ts';
import {
  enterProgramQxMode,
  exitProgramQxMode,
  makeProgramQxReadFrame,
  makeProgramQxWriteFrame,
  parseProgramQxReadReply,
  probeProgramQxIdent,
  sendProgramQxCommand,
} from '../../../kit/codecs/programQx.ts';
import { parseRt95IdentResponse } from '../ident.ts';
import { createFakeRt95Pipe } from './fakeRt95Pipe.ts';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe('fakeRt95Pipe', () => {
  it('answers PROGRAM, ident, R and W like the radio', async () => {
    const pipe = createFakeRt95Pipe();
    await enterProgramQxMode(pipe, 50);
    const ident = parseRt95IdentResponse(await probeProgramQxIdent(pipe, 50));
    expect(ident.model).toBe('RT95-P');

    const block = new Uint8Array(16).map((_, i) => i + 1);
    const ack = await sendProgramQxCommand(pipe, makeProgramQxWriteFrame(0x0100, 16, block), 1, 50);
    expect(ack).toEqual(new Uint8Array([0x06]));
    const reply = await sendProgramQxCommand(pipe, makeProgramQxReadFrame(0x0100, 16), 0x16, 50);
    expect(parseProgramQxReadReply(reply, 16)).toEqual(block);
    expect(pipe.log.map((e) => e.op)).toEqual(['PROGRAM', 'IDENT', 'W', 'R']);
  });

  it('is deaf to PROGRAM, R and W for deafAfterEndMs after END', async () => {
    let t = 1000;
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 40, now: () => t });
    await enterProgramQxMode(pipe, 50);
    await exitProgramQxMode(pipe);
    expect(pipe.lastEndAt).toBe(1000);
    await settle();
    await pipe.flush();
    await expect(enterProgramQxMode(pipe, 10)).rejects.toBeInstanceOf(RadioTimeoutError);
    expect(pipe.count('PROGRAM')).toBe(1);
    t += 40;
    await settle();
    await pipe.flush();
    await enterProgramQxMode(pipe, 50);
    expect(pipe.count('PROGRAM')).toBe(2);
  });
});
