import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { encodeChannelRecord } from '@integrations/radio-io/radios/uv5r-mini/channelCodec.ts';
import { encodeUv5rMiniZoneTable } from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';

describe('Mini memory', () => {
  it('shows actual channels and zone membership, and searches names', () => {
    const decoded = new Uint8Array(0x10000).fill(0xff);
    decoded.set(
      encodeChannelRecord({
        slotIndex: 7,
        empty: false,
        wireName: 'MM9PDY',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      }),
      6 * 32,
    );
    decoded.set(
      encodeUv5rMiniZoneTable({ zones: [{ name: 'LOCAL', slotIndexes: [6, 8] }] }).sector,
      0xc000,
    );
    const archive = archiveUv5rMiniRead({
      decoded,
      raw: decodeUv5rMiniFullRead(decoded),
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      spans: [],
    });
    render(
      <MantineProvider>
        <Uv5rMiniMemory archive={archive} />
      </MantineProvider>,
    );
    expect(screen.getByText('MM9PDY')).toBeInTheDocument();
    expect(screen.getByText(/7: MM9PDY, 9: \(missing channel\)/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search channels' }), {
      target: { value: 'other' },
    });
    expect(screen.queryByText('MM9PDY')).not.toBeInTheDocument();
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
  });
});
