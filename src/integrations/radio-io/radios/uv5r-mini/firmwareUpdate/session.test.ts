import { describe, expect, it } from 'vitest';

import {
  encodeUv5rMiniFrame,
  Uv5rMiniFrameParser,
  UV5RMINI_FW_CMD,
  uv5rMiniReadU32,
  uv5rMiniU32,
} from './frames.ts';
import {
  createUv5rMiniSession,
  type Uv5rMiniPhase,
  type Uv5rMiniReply,
  type Uv5rMiniSession,
} from './session.ts';

const IMAGE = Uint8Array.from({ length: 0x2000 }, (_, i) => (i * 31 + 7) & 0xff);
const { BAUD, DATA, RESULT, LENGTH, PING } = UV5RMINI_FW_CMD;
const req = (off: number, len: number) =>
  Uint8Array.from([...uv5rMiniU32(off), ...uv5rMiniU32(len)]);

/** The replies as `[cmd, data]`, decoded back through the parser. */
function decoded(r: Uv5rMiniReply): Array<[number, Uint8Array]> {
  const p = new Uv5rMiniFrameParser();
  return r.frames.flatMap((f) =>
    p.feed(f).map((e) => {
      if (e.kind !== 'frame') throw new Error('reply is not a good frame');
      return [e.cmd, e.data] as [number, Uint8Array];
    }),
  );
}

/** A session driven into `phase` the way a real run gets there. */
function inPhase(phase: Uv5rMiniPhase): Uv5rMiniSession {
  const s = createUv5rMiniSession(IMAGE);
  if (phase === 'listen') return s;
  s.ping();
  if (phase === 'ping') return s;
  s.onFrame(BAUD, new Uint8Array(0));
  if (phase === 'app') return s;
  s.onFrame(DATA, req(0, 0x200));
  s.onFrame(BAUD, new Uint8Array(0));
  if (phase === 'loader') return s;
  s.onFrame(RESULT, Uint8Array.from([0]));
  return s;
}

describe('UV-5R Mini session: lengthHeard', () => {
  it('is false until a cmd 4 arrives, and true for one the app stage ignores', () => {
    const app = inPhase('app');
    expect(app.lengthHeard).toBe(false);
    app.onFrame(RESULT, Uint8Array.from([0x83]));
    expect(app.lengthHeard).toBe(false);

    const ignored = inPhase('app');
    ignored.onFrame(LENGTH, uv5rMiniU32(0x1000));
    expect(ignored.areaLength).toBeUndefined();
    expect(ignored.lengthHeard).toBe(true);
  });

  it("is true once the loader's cmd 4 sets the area", () => {
    const s = inPhase('loader');
    expect(s.lengthHeard).toBe(false);
    s.onFrame(LENGTH, uv5rMiniU32(0x1000));
    expect(s.lengthHeard).toBe(true);
  });
});

describe('UV-5R Mini session: every command in every phase', () => {
  const none = 'no reply';
  // [phase, cmd, data, expected reply cmds] (the reply's content is checked in the tests below)
  const table: Array<[Uv5rMiniPhase, number, Uint8Array, string]> = [
    ['listen', BAUD, new Uint8Array(0), 'cmd1 38400 + switch'],
    ['listen', DATA, req(0, 8), none],
    ['listen', LENGTH, uv5rMiniU32(0x1000), none],
    ['listen', RESULT, Uint8Array.from([0x86]), none],
    ['listen', PING, new Uint8Array(0), none],
    ['listen', 9, Uint8Array.from([1]), none],
    ['ping', BAUD, new Uint8Array(0), 'cmd1 9600'],
    ['ping', BAUD, Uint8Array.from([1, 2, 3, 4]), none],
    ['ping', DATA, req(0, 8), 'cmd2'],
    ['ping', LENGTH, uv5rMiniU32(0x1000), none],
    ['ping', RESULT, Uint8Array.from([0x01]), none],
    ['ping', PING, new Uint8Array(0), none],
    ['app', BAUD, new Uint8Array(0), none], // before any read: not a handover
    ['app', DATA, req(0, 8), 'cmd2'],
    ['app', LENGTH, uv5rMiniU32(0x1000), none],
    ['app', RESULT, Uint8Array.from([0x8a]), none], // the app's result is not echoed
    ['app', 9, Uint8Array.from([1]), none],
    ['loader', BAUD, new Uint8Array(0), 'cmd1 38400'],
    ['loader', DATA, req(0x200, 8), 'cmd2'],
    ['loader', LENGTH, uv5rMiniU32(0x1000), 'cmd4 echo'],
    ['loader', RESULT, Uint8Array.from([0]), 'cmd3 echo'],
    ['loader', 9, Uint8Array.from([1]), none],
    ['done', BAUD, new Uint8Array(0), none],
    ['done', DATA, req(0, 8), none],
    ['done', LENGTH, uv5rMiniU32(0x1000), none],
    ['done', RESULT, Uint8Array.from([0]), 'cmd3 echo'], // the loader may repeat its result
    ['done', 9, Uint8Array.from([1]), none],
  ];

  it.each(table)('%s, cmd %i %j -> %s', (phase, cmd, data, expected) => {
    const s = inPhase(phase);
    const r = s.onFrame(cmd, data);
    const out = decoded(r);
    switch (expected) {
      case none:
        expect(out).toEqual([]);
        break;
      case 'cmd1 38400 + switch':
        expect(out).toEqual([[BAUD, uv5rMiniU32(38400)]]);
        expect(r.rate).toBe(9600);
        expect(r.switchTo).toBe(38400);
        break;
      case 'cmd1 9600':
        expect(out).toEqual([[BAUD, uv5rMiniU32(9600)]]);
        expect(r.switchTo).toBeUndefined();
        break;
      case 'cmd1 38400':
        expect(out).toEqual([[BAUD, uv5rMiniU32(38400)]]);
        expect(r.rate).toBe(38400);
        expect(r.switchTo).toBeUndefined();
        break;
      case 'cmd2': {
        const off = uv5rMiniReadU32(data, 0);
        const len = uv5rMiniReadU32(data, 4);
        expect(out).toEqual([
          [DATA, Uint8Array.from([...data, ...IMAGE.subarray(off, off + len)])],
        ]);
        expect(r.flagged).toBeUndefined();
        break;
      }
      case 'cmd4 echo':
        expect(out).toEqual([[LENGTH, data]]);
        expect(s.areaLength).toBe(0x1000);
        break;
      case 'cmd3 echo':
        expect(out).toEqual([[RESULT, data]]);
        break;
    }
    // Only the rules above move a phase.
    if (phase === 'listen' && cmd === BAUD) expect(s.phase).toBe('loader');
    else if (phase === 'ping' && cmd === BAUD && data.length === 0) expect(s.phase).toBe('app');
    else if (cmd === RESULT && data.length) expect(s.phase).toBe('done');
    else expect(s.phase).toBe(phase);
  });

  it('records the area length only in the loader', () => {
    for (const phase of ['listen', 'ping', 'app'] as const) {
      const s = inPhase(phase);
      s.onFrame(LENGTH, uv5rMiniU32(0x78000));
      expect(s.areaLength).toBeUndefined();
    }
    const s = inPhase('loader');
    s.onFrame(LENGTH, uv5rMiniU32(0x78000));
    expect(s.areaLength).toBe(0x78000);
  });
});

describe('UV-5R Mini session: the run', () => {
  it('ping puts the session in ping and sends cmd 6, empty, at 9600', () => {
    const s = createUv5rMiniSession(IMAGE);
    expect(s.phase).toBe('listen');
    const r = s.ping();
    expect(s.phase).toBe('ping');
    expect(decoded(r)).toEqual([[PING, new Uint8Array(0)]]);
    expect(r.rate).toBe(9600);
  });

  it('starts the app stage at 9600 with no echo, then switches at the hand-over', () => {
    const s = createUv5rMiniSession(IMAGE);
    s.ping();
    const pong = s.onFrame(BAUD, new Uint8Array(0));
    expect(s.phase).toBe('app');
    expect(s.rate).toBe(9600);
    expect(pong.switchTo).toBeUndefined();

    s.onFrame(DATA, req(0, 0x200));
    expect(s.reads).toBe(1);

    const hand = s.onFrame(BAUD, new Uint8Array(0));
    expect(s.phase).toBe('loader');
    expect(s.continued).toBe(false);
    expect(hand.rate).toBe(9600); // sent at the rate before the switch
    expect(hand.switchTo).toBe(38400);
    expect(decoded(hand)).toEqual([[BAUD, uv5rMiniU32(38400)]]);
    expect(s.rate).toBe(38400); // and the host listens at the new one

    const again = s.onFrame(BAUD, new Uint8Array(0));
    expect(again.rate).toBe(38400);
    expect(again.switchTo).toBeUndefined();
    expect(decoded(again)).toEqual([[BAUD, uv5rMiniU32(38400)]]);
    expect(s.phase).toBe('loader');
  });

  it('recognises a loader restarted from its record, talking first in listen', () => {
    const s = createUv5rMiniSession(IMAGE);
    const r = s.onFrame(BAUD, new Uint8Array(0));
    expect(s.phase).toBe('loader');
    expect(s.continued).toBe(true);
    expect(r.rate).toBe(9600);
    expect(r.switchTo).toBe(38400);
    expect(s.events[0]).toEqual({ kind: 'loader-first', rate: 9600 });
    expect(s.reads).toBe(0);
  });

  it('answers reads with the request plus exactly the image slice and counts them', () => {
    const s = inPhase('loader');
    const before = s.reads;
    const r = s.onFrame(DATA, req(0x20, 0x40));
    expect(decoded(r)[0]![1]).toEqual(
      Uint8Array.from([...req(0x20, 0x40), ...IMAGE.subarray(0x20, 0x60)]),
    );
    expect(s.reads).toBe(before + 1);
    expect(s.events.at(-1)).toEqual({ kind: 'read', off: 0x20, len: 0x40, inImage: true });
  });

  it('flags a read outside the image, and one over the frame limit, but still answers with what exists', () => {
    const s = inPhase('app');
    const past = s.onFrame(DATA, req(IMAGE.length - 4, 0x10));
    expect(past.flagged).toMatch(/outside the image/);
    expect(decoded(past)[0]![1]).toEqual(
      Uint8Array.from([...req(IMAGE.length - 4, 0x10), ...IMAGE.subarray(IMAGE.length - 4)]),
    );
    expect(s.onFrame(DATA, req(IMAGE.length + 8, 4)).flagged).toMatch(/outside the image/);
    const big = s.onFrame(DATA, req(0, 0x1800));
    expect(big.flagged).toMatch(/frame limit/);
  });

  it('marks a loader read past the image, before any cmd 4, as already installed; nothing else', () => {
    const loader = inPhase('loader');
    const past = loader.onFrame(DATA, req(IMAGE.length, 0x20));
    expect(past.flagged).toMatch(/outside the image/);
    expect(past.alreadyInstalled).toBe(true);
    // Over the frame limit is not "already installed".
    expect(loader.onFrame(DATA, req(0, 0x1800)).alreadyInstalled).toBeUndefined();
    // The app stage reading past the image is not the loader's plan.
    expect(inPhase('app').onFrame(DATA, req(IMAGE.length, 0x20)).alreadyInstalled).toBeUndefined();
    // Once an erase was announced this is a real update gone wrong, not "already installed".
    const erasing = inPhase('loader');
    erasing.onFrame(UV5RMINI_FW_CMD.LENGTH, Uint8Array.from([0, 0x10, 0, 0]));
    expect(erasing.onFrame(DATA, req(IMAGE.length, 0x20)).alreadyInstalled).toBeUndefined();
  });

  it('first result wins; the loader echoes it, the app does not', () => {
    const app = inPhase('app');
    expect(decoded(app.onFrame(RESULT, Uint8Array.from([0x8a])))).toEqual([]);
    expect(app.result).toBe(0x8a);
    expect(app.resultPhase).toBe('app');
    expect(app.phase).toBe('done');
    app.onFrame(RESULT, Uint8Array.from([0]));
    expect(app.result).toBe(0x8a);

    const loader = inPhase('loader');
    loader.onFrame(LENGTH, uv5rMiniU32(0x4000));
    expect(decoded(loader.onFrame(RESULT, Uint8Array.from([0x87])))).toEqual([
      [RESULT, Uint8Array.from([0x87])],
    ]);
    expect(loader.result).toBe(0x87);
    expect(loader.resultPhase).toBe('loader');
    expect(loader.areaLength).toBe(0x4000);
    expect(loader.done).toBe(true);
  });

  it('a refusal before cmd 4 leaves no area length', () => {
    const s = inPhase('loader');
    s.onFrame(RESULT, Uint8Array.from([0x86]));
    expect(s.result).toBe(0x86);
    expect(s.areaLength).toBeUndefined();
  });

  it('logs a bad CRC and nothing else; an ignored frame goes in the log with its phase', () => {
    const s = createUv5rMiniSession(IMAGE);
    s.noteBadCrc('aa55');
    s.onFrame(9, Uint8Array.from([0xab]));
    expect(s.events).toEqual([
      { kind: 'bad-crc', hex: 'aa55' },
      { kind: 'ignored', cmd: 9, phase: 'listen', hex: 'ab' },
    ]);
    expect(s.phase).toBe('listen');
  });

  it('keeps the radio last frame per command for the outgoing guard', () => {
    const s = inPhase('loader');
    s.onFrame(LENGTH, uv5rMiniU32(7));
    s.onFrame(LENGTH, uv5rMiniU32(9));
    expect(s.lastRadioData(LENGTH)).toEqual(uv5rMiniU32(9));
    expect(s.lastRadioData(RESULT)).toBeUndefined();
  });

  it('only ever builds frames the host may send', () => {
    // Every reply across a whole run is one of the five commands the host sends.
    const s = createUv5rMiniSession(IMAGE);
    const sent = [
      s.ping(),
      s.onFrame(BAUD, new Uint8Array(0)),
      s.onFrame(DATA, req(0, 8)),
      s.onFrame(BAUD, new Uint8Array(0)),
      s.onFrame(BAUD, new Uint8Array(0)),
      s.onFrame(LENGTH, uv5rMiniU32(8)),
      s.onFrame(RESULT, Uint8Array.from([0])),
    ].flatMap(decoded);
    for (const [cmd] of sent) expect([1, 2, 3, 4, 6]).toContain(cmd);
    expect(encodeUv5rMiniFrame(6).length).toBe(7);
  });
});
