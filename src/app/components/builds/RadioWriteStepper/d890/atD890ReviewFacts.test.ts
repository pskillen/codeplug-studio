import { describe, expect, it } from 'vitest';
import { listAtD890ReceiveOnlyChannels } from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { decodeAtD890RadioSettings } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import {
  atD890OverrideWords,
  atD890ReceiveOnlyChannels,
  atD890ReviewRange,
  atD890SettingChanges,
} from './atD890ReviewFacts.ts';

function ch(slotIndex: number, mhz: number, extra: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
    slotIndex,
    empty: false,
    wireName: `C${slotIndex}`,
    rxHz: mhz * 1e6,
    txHz: mhz * 1e6,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: null,
    bandwidth: 'FM',
    ...extra,
  };
}

const localInfo = (bytes: Record<number, number> = {}) => {
  const out = new Uint8Array(0x100);
  for (const [k, v] of Object.entries(bytes)) out[Number(k)] = v;
  return out;
};

describe('atD890ReviewRange', () => {
  it('names the range from the ident band code', () => {
    const d = atD890ReviewRange({ bandCode: 3, localInfo: localInfo() });
    expect(d.caption).toBe('Amateur Europe');
    expect(d.summary).toBe('Amateur Europe (code 3) · TX 430–440, 144–146 MHz');
  });

  it('shows an unknown ident code as treated-as-0, and a locked 14 as not unlocked', () => {
    expect(atD890ReviewRange({ bandCode: 40, localInfo: localInfo() }).known).toBe(false);
    const locked = atD890ReviewRange({ bandCode: 14, localInfo: localInfo() });
    expect(locked.caption).toContain('not unlocked');
    // 890# in LocalInfo +0x0B..+0x0E unlocks it.
    const unlocked = atD890ReviewRange({
      bandCode: 14,
      localInfo: localInfo({ 0x0b: 0x38, 0x0c: 0x39, 0x0d: 0x30, 0x0e: 0x23 }),
    });
    expect(unlocked.known).toBe(true);
  });
});

describe('atD890ReceiveOnlyChannels', () => {
  const channels = [
    ch(1, 145.5),
    ch(2, 446.0),
    ch(3, 439.0),
    ch(4, 150.0),
    ch(5, 446.0, { rxOnly: true }),
    ch(6, 446.0, { empty: true }),
  ];

  it('lists exactly what listAtD890ReceiveOnlyChannels returns for the band code', () => {
    const expected = listAtD890ReceiveOnlyChannels(channels, 3).map((c) => c.slotIndex);
    expect(atD890ReceiveOnlyChannels(channels, 3).map((c) => c.slotIndex)).toEqual(expected);
    expect(expected).toEqual([2, 4]);
  });

  it('is empty on a range that transmits everywhere', () => {
    expect(atD890ReceiveOnlyChannels([ch(1, 146), ch(2, 446)], 1)).toEqual([]);
  });
});

describe('atD890SettingChanges', () => {
  const snapshot = { main: new Uint8Array(0x200), ext: new Uint8Array(0x60) };
  const current = decodeAtD890RadioSettings(snapshot, 'stock').keyTone!.value as boolean;

  it('leaves out a value the radio already holds', () => {
    expect(
      atD890SettingChanges(snapshot, 'stock', [{ fieldId: 'keyTone', value: current }]),
    ).toEqual([]);
  });

  it('gives now and after in words for a real change', () => {
    const [change] = atD890SettingChanges(snapshot, 'stock', [
      { fieldId: 'keyTone', value: !current },
    ]);
    expect(change?.label).toBeTruthy();
    expect(change?.now).toBe(current ? 'On' : 'Off');
    expect(change?.after).toBe(current ? 'Off' : 'On');
  });

  it('shows an empty text line as such', () => {
    const [change] = atD890SettingChanges(snapshot, 'stock', [
      { fieldId: 'powerOnLine1', value: 'HELLO' },
    ]);
    expect(change?.after).toBe('HELLO');
    const empty = atD890SettingChanges(
      { ...snapshot, ext: new Uint8Array(0x60).fill(0x41) },
      'stock',
      [{ fieldId: 'powerOnLine1', value: '' }],
    );
    expect(empty[0]?.after).toBe('(empty line)');
  });
});

describe('the power-on password in the Review', () => {
  const pair = (enabled: boolean, digits: string) => [
    { fieldId: 'powerOnPasswordEnabled', value: enabled },
    { fieldId: 'powerOnPasswordDigits', value: digits },
  ];
  const off = { main: new Uint8Array(0x200), ext: new Uint8Array(0x60) };
  const on = (() => {
    const ext = new Uint8Array(0x60);
    ext.set([0x31, 0x32, 0x33, 0x34], 0x40);
    const main = new Uint8Array(0x200);
    main[0x07] = 1;
    return { main, ext };
  })();

  it('is one change: Off to On with the chosen digits, never the radio digits', () => {
    const changes = atD890SettingChanges(off, 'stock', pair(true, '4821'));
    expect(changes).toEqual([
      {
        fieldId: 'powerOnPasswordEnabled',
        label: 'Power-on password',
        now: 'Off',
        after: 'On (4821)',
      },
    ]);
  });

  it('On to Off for Clear password, and nothing when it is already off and empty', () => {
    expect(atD890SettingChanges(on, 'stock', pair(false, ''))[0]).toMatchObject({
      now: 'On',
      after: 'Off',
    });
    expect(atD890SettingChanges(off, 'stock', pair(false, ''))).toEqual([]);
  });

  it('Clear password on a factory-default radio (off, stock digits) says the digits are cleared', () => {
    const ext = new Uint8Array(0x60);
    ext.set([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38], 0x40);
    const changes = atD890SettingChanges(
      { main: new Uint8Array(0x200), ext },
      'stock',
      pair(false, ''),
    );
    expect(changes).toEqual([
      {
        fieldId: 'powerOnPasswordEnabled',
        label: 'Power-on password',
        now: 'Off',
        after: 'Off (stored digits cleared)',
      },
    ]);
  });

  it('a new password over the same on state is still a change; the same one is not', () => {
    expect(atD890SettingChanges(on, 'stock', pair(true, '9999'))).toHaveLength(1);
    expect(atD890SettingChanges(on, 'stock', pair(true, '1234'))).toEqual([]);
  });

  it('is one phrase in the part row', () => {
    expect(atD890OverrideWords(pair(true, '4821'), 'stock')).toEqual(['Power-on password On']);
  });
});

describe('atD890OverrideWords', () => {
  it('names the first few and counts the rest', () => {
    const words = atD890OverrideWords(
      [
        { fieldId: 'keyTone', value: true },
        { fieldId: 'powerOnLine1', value: 'MM9PDY' },
        { fieldId: 'keyShortP1', value: 14 },
        { fieldId: 'keyShortP2', value: 13 },
      ],
      'mm9pdy',
      2,
    );
    expect(words).toHaveLength(3);
    expect(words[1]).toContain('MM9PDY');
    expect(words[2]).toBe('+2 more');
  });
});
