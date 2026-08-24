/**
 * Print Studio encode bytes 9–11 and 15/17 for the #1234 golden cases.
 * Run from repo root: npx vite-node --script docs/investigations/i007-rt95-serial-write-bit-packing/harness/encode-studio-bytes.mts
 */
import { encodeChannelRecord } from '../../../../src/integrations/radio-io/radios/rt95/channelCodec.ts';
import type { RadioChannelDto } from '../../../../src/integrations/radio-io/radioChannelDto.ts';

function dto(over: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: 'TEST01',
    rxHz: 146_520_000,
    txHz: 146_520_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    ...over,
  };
}

const cases: [string, RadioChannelDto][] = [
  ['High + none + FM', dto()],
  ['High + plus + FM', dto({ txHz: 147_120_000 })],
  ['High + tx_off + FM', dto({ rxOnly: true })],
  ['CTCSS encode-only', dto({ txTone: { kind: 'ctcss', hz: 100 } })],
  [
    'CTCSS TSQL',
    dto({
      txTone: { kind: 'ctcss', hz: 100 },
      rxTone: { kind: 'ctcss', hz: 100 },
    }),
  ],
  [
    'DTCS enc+dec',
    dto({
      txTone: { kind: 'dcs', code: 23, polarity: 'N' },
      rxTone: { kind: 'dcs', code: 23, polarity: 'N' },
    }),
  ],
  ['DTCS invert TX', dto({ txTone: { kind: 'dcs', code: 23, polarity: 'I' } })],
];

for (const [name, d] of cases) {
  const raw = encodeChannelRecord(d);
  const offsetBcd = [...raw.subarray(4, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  console.log(
    name.padEnd(22),
    `b9=${raw[9]!.toString(16).padStart(2, '0')}`,
    `b10=${raw[10]!.toString(16).padStart(2, '0')}`,
    `b11=${raw[11]!.toString(16).padStart(2, '0')}`,
    `b15=${raw[15]!.toString(16).padStart(2, '0')}`,
    `b17=${raw[17]!.toString(16).padStart(2, '0')}`,
    `offsetBCD=${offsetBcd}`,
  );
}
