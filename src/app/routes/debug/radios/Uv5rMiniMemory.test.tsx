import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { encodeChannelRecord } from '@integrations/radio-io/radios/uv5r-mini/channelCodec.ts';
import { encodeUv5rMiniZoneTable } from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';
import { chooseCategory } from '@app/components/debug/memoryCategoriesTestUtils.ts';

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
        <Uv5rMiniMemory archive={archive} notDecoded={['scan lists']} />
      </MantineProvider>,
    );
    expect(screen.getByText('MM9PDY')).toBeInTheDocument();
    expect(screen.getByText(/1 channels listed of/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Sort channels')).not.toBeInTheDocument();
    // Channels is the default category; the zone table is behind the dropdown.
    fireEvent.change(screen.getByPlaceholderText('Search channels'), {
      target: { value: 'other' },
    });
    expect(screen.queryByText('MM9PDY')).not.toBeInTheDocument();
    expect(screen.getByText('Not decoded for this radio yet: scan lists.')).toBeInTheDocument();
    chooseCategory('Zones');
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
    expect(screen.getByText('1 zone listed')).toBeInTheDocument();
    // Members are a table opened by clicking the zone, not a comma list.
    expect(screen.queryByText(/7: MM9PDY/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('LOCAL'));
    const members = within(screen.getByLabelText('Zone 1: LOCAL members'));
    expect(members.getByText('MM9PDY')).toBeInTheDocument();
    expect(screen.getByText('1 member points at empty or unavailable slots')).toBeInTheDocument();
    expect(screen.getByText(/Slots: 9 \(empty\)/)).toBeInTheDocument();
  });

  it('counts every category in the picker, equal to the panel results', () => {
    const decoded = new Uint8Array(0x10000).fill(0xff);
    decoded.set(
      encodeUv5rMiniZoneTable({
        zones: [
          { name: 'A', slotIndexes: [0] },
          { name: 'B', slotIndexes: [1] },
        ],
      }).sector,
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
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('Channels (0)');
    chooseCategory('Zones');
    expect(screen.getByText('2 zones listed')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('Zones (2)');
  });
});
