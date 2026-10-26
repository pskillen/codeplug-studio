import { describe, expect, it } from 'vitest';
import {
  atD890RepeaterBootBytes,
  atD890RepeaterPrerequisiteProblems,
} from './repeaterModePrerequisites.ts';

function main(bytes: Record<number, number>): Uint8Array {
  const out = new Uint8Array(0x200);
  for (const [at, value] of Object.entries(bytes)) out[Number(at)] = value;
  return out;
}

describe('atD890RepeaterBootBytes', () => {
  it('reads Sub-Channel Mode +0x2D, NOAA alert +0xEF and AM/FM function +0x21', () => {
    expect(atD890RepeaterBootBytes(main({ 0x2d: 1, 0xef: 1, 0x21: 2 }))).toEqual({
      subChannelMode: 1,
      noaaAlert: 1,
      amFmFunction: 2,
    });
  });

  it('is undefined for a record too short to hold the bytes', () => {
    expect(atD890RepeaterBootBytes(new Uint8Array(0x20))).toBeUndefined();
  });
});

describe('atD890RepeaterPrerequisiteProblems', () => {
  const ok = { subChannelMode: 1, noaaAlert: 0, amFmFunction: 0 };

  it('finds nothing when every prerequisite is met', () => {
    expect(atD890RepeaterPrerequisiteProblems(ok)).toEqual([]);
  });

  it('names Sub-Channel Mode off', () => {
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, subChannelMode: 0 })).toEqual([
      { id: 'subChannelMode', text: 'Sub-Channel Mode is off' },
    ]);
  });

  it('names NOAA alert on, for any non-zero value', () => {
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, noaaAlert: 1 }).map((p) => p.id)).toEqual([
      'noaaAlert',
    ]);
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, noaaAlert: 2 }).map((p) => p.id)).toEqual([
      'noaaAlert',
    ]);
  });

  it('names FM radio, and not the airband values (they do not stop repeater mode)', () => {
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, amFmFunction: 1 }).map((p) => p.id)).toEqual(
      ['fmRadio'],
    );
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, amFmFunction: 2 })).toEqual([]);
    expect(atD890RepeaterPrerequisiteProblems({ ...ok, amFmFunction: 3 })).toEqual([]);
  });

  it('lists every failed prerequisite, in the order the firmware checks them', () => {
    expect(
      atD890RepeaterPrerequisiteProblems({ subChannelMode: 0, noaaAlert: 1, amFmFunction: 1 }).map(
        (p) => p.id,
      ),
    ).toEqual(['subChannelMode', 'noaaAlert', 'fmRadio']);
  });
});
