import { describe, expect, it } from 'vitest';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { preparedRt95HeadImage, synthRt95HeadPackage } from './__fixtures__/syntheticPackage.ts';
import { RT95_HEAD_FW_LIMIT, RT95_HEAD_FW_MODEL_OFFSET } from './constants.ts';
import { makeRt95UpdateFrame } from './frames.ts';
import {
  checkRt95FirmwareImage,
  checkRt95Outgoing,
  checkRt95Package,
  rt95AddrProblem,
} from './interlocks.ts';
import { RT95_HEAD_TARGET, type Rt95FirmwareTarget } from './targets.ts';

/** Test-only second profile: a narrow window, a frame cap and an exact SP. */
const TEST_TARGET: Rt95FirmwareTarget = {
  ...RT95_HEAD_TARGET,
  label: 'test target',
  limit: 0x08002000 + 2 * 1024,
  maxFrames: 2,
  sp: { kind: 'exact', value: 0x200045e8 },
  copy: { ...RT95_HEAD_TARGET.copy, vectorTable: (sp, reset) => `test vectors ${sp} ${reset}` },
};

const gate = { cloneEndAllowed: false };
const goldenPkg = () =>
  checkRt95FirmwareImage(preparedRt95HeadImage(synthRt95HeadPackage()), RT95_HEAD_TARGET);

describe('RT95_HEAD_TARGET', () => {
  it('holds the head numbers and strings', () => {
    expect(RT95_HEAD_TARGET.radioId).toBe('retevis-rt95-head');
    expect(RT95_HEAD_TARGET.limit).toBe(0x08020000);
    expect(RT95_HEAD_TARGET.limit).toBe(RT95_HEAD_FW_LIMIT);
    expect(RT95_HEAD_TARGET.maxFrames).toBeUndefined();
    expect(RT95_HEAD_TARGET.sp).toEqual({
      kind: 'range',
      minExclusive: 0x20002000,
      maxInclusive: 0x20005000,
    });
    expect(RT95_HEAD_TARGET.modelOffset).toBe(0x15360);
    expect(RT95_HEAD_TARGET.modelOffset).toBe(RT95_HEAD_FW_MODEL_OFFSET);
    expect(RT95_HEAD_TARGET.copy.otherTargetImage).toBe(
      'This is a main-board image. Studio only flashes the RT95 front panel.',
    );
    expect(RT95_HEAD_TARGET.copy.notThisTarget).toBe(
      'This firmware image is not for the RT95 front panel.',
    );
    expect(RT95_HEAD_TARGET.copy.vectorTable('0x1', '0x2')).toBe(
      'The firmware vector table does not look like the RT95 front panel (SP 0x1, reset 0x2).',
    );
    expect(RT95_HEAD_TARGET.copy.normalMode).toMatch(/^The radio is switched on normally/);
    expect(RT95_HEAD_TARGET.copy.notInUpdateMode).toMatch(/^The radio didn't answer/);
  });

  it('accepts the golden package', () => {
    expect(goldenPkg().entry.len).toBe(0x15500);
  });
});

describe('a second (test-only) profile through the same functions', () => {
  it('refuses a block past its limit', () => {
    expect(rt95AddrProblem(0x08002000, TEST_TARGET)).toBeUndefined();
    expect(rt95AddrProblem(0x08002800, TEST_TARGET)).toMatch(/outside the firmware window/);
    const frame = makeRt95UpdateFrame(0x08002800, new Uint8Array(1024));
    expect(() => checkRt95Outgoing(frame, gate, TEST_TARGET)).toThrow(RadioInterlockError);
    expect(() => checkRt95Outgoing(frame, gate, RT95_HEAD_TARGET)).not.toThrow();
  });

  it('refuses a third data frame', () => {
    const wide = { ...TEST_TARGET, limit: RT95_HEAD_FW_LIMIT };
    expect(() => checkRt95Package(goldenPkg(), wide)).toThrow(/at most 2/);
  });

  it('refuses a wrong SP', () => {
    const wrongSp: Rt95FirmwareTarget = {
      ...TEST_TARGET,
      limit: RT95_HEAD_FW_LIMIT,
      maxFrames: undefined,
      sp: { kind: 'exact', value: 0x200013e8 },
    };
    expect(() => checkRt95Package(goldenPkg(), wrongSp)).toThrow(/test vectors/);
  });

  it('refuses an image for another radio id', () => {
    expect(() =>
      checkRt95FirmwareImage(
        preparedRt95HeadImage(synthRt95HeadPackage(), { radioId: 'anytone-at-d890uv' }),
        TEST_TARGET,
      ),
    ).toThrow(/not for the RT95 front panel/);
  });
});
