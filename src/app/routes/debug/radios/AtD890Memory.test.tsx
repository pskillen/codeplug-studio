import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '@integrations/radio-io/backup/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { AtD890Memory, formatAtD890Tone } from './AtD890Memory.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

type Entry = [RadioBackupRegionV1, Uint8Array];
const sparse = (address: number, data: Uint8Array): Entry => [
  {
    id: `sparse-${address.toString(16)}`,
    label: 'Sparse configuration',
    address,
    byteLength: data.length,
    path: `regions/sparse-${address.toString(16)}.bin`,
    restoreRole: 'inspect-only',
  },
  data,
];
function archive(entries: readonly Entry[], capturedAt = '2026-01-01'): DebugArchive {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt,
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: 0x5000000,
    regions: entries.map(([r]) => r),
  };
  return openDebugArchive(
    packRadioBackupZip(manifest, Object.fromEntries(entries.map(([r, b]) => [r.id, b]))),
    'AT-D890UV',
  );
}
function bitmap(bytes: number, bits: number[]) {
  const out = new Uint8Array(bytes);
  for (const b of bits) out[b >> 3]! |= 1 << (b & 7);
  return out;
}
const bcd = (digits: string) => Uint8Array.from(digits.match(/../g)!.map((p) => parseInt(p, 16)));
function wide(text: string, length: number) {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => {
    out[i * 2] = c.charCodeAt(0) & 0xff;
    out[i * 2 + 1] = c.charCodeAt(0) >> 8;
  });
  return out;
}
/** Channel entries; `halves: 'primary'` leaves the secondary half uncaptured. */
function channel(index: number, name: string, rx: string, halves: 'both' | 'primary' = 'both') {
  const rec = new Uint8Array(0x80);
  rec.set(bcd(rx), 0);
  rec[0x08] = 0x0c; // simplex, narrow bandwidth bits clear; power bits 11
  rec.set(wide(name, 0x20), 0x44);
  return [
    sparse(channelPrimaryAddress(index), rec.slice(0, 0x40)),
    ...(halves === 'both' ? [sparse(channelSecondaryAddress(index), rec.slice(0x40))] : []),
  ];
}
function members(indices: number[]) {
  const out = new Uint8Array(0x200).fill(0xff);
  indices.forEach((v, i) => {
    out[i * 2] = v & 0xff;
    out[i * 2 + 1] = v >> 8;
  });
  return out;
}
const channelSet = (slots: number[]) => sparse(D890_MAP.ChannelSet, bitmap(0x200, slots));
const zoneSet = (bits: number[]) => sparse(D890_MAP.ZoneSet, bitmap(0x20, bits));

function memoryArchive(capturedAt = '2026-01-01') {
  return archive(
    [
      channelSet([0, 6, 8]),
      ...channel(0, 'GB3ED Edinburgh', '14550000'),
      ...channel(6, 'MM9PDY Local', '43350000'),
      ...channel(8, 'Half captured', '43000000', 'primary'),
      zoneSet([0, 2]),
      sparse(zoneNameAddress(0), wide('Local ★', 0x20)),
      sparse(zoneChannelsAddress(0), members([6, 0, 6, 8, 20, 4001])),
      sparse(zoneNameAddress(2), new Uint8Array(0x20)),
      sparse(zoneChannelsAddress(2), members([])),
    ],
    capturedAt,
  );
}

const view = (a?: DebugArchive) =>
  render(
    <MantineProvider>
      <AtD890Memory archive={a} />
    </MantineProvider>,
  );
const rowTexts = () => screen.getAllByRole('row').map((r) => r.textContent ?? '');
const open = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('AtD890Memory', () => {
  it('shows a clear no-capture state', () => {
    view();
    expect(screen.getByText('No capture')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Channels' })).not.toBeInTheDocument();
  });

  it('refuses an archive for another model', () => {
    const a = memoryArchive();
    view({ ...a, manifest: { ...a.manifest, radioModelId: 'RT95' } });
    expect(screen.getByText('Not an AT-D890UV capture')).toBeInTheDocument();
  });

  it('shows a missing bitmap as Not captured, not as zero channels', () => {
    view(archive([sparse(channelPrimaryAddress(0), new Uint8Array(0x40))]));
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    expect(screen.queryByText(/no channel slot is occupied/)).not.toBeInTheDocument();
  });

  it('shows a captured empty bitmap as genuinely empty', () => {
    view(archive([channelSet([])]));
    expect(screen.getByText(/no channel slot is occupied/)).toBeInTheDocument();
    expect(screen.getByText(/Occupied 0 of 4,000 channel slots/)).toBeInTheDocument();
  });

  it('lists occupied slots unrenumbered with decoded counts and missing records visible', () => {
    view(memoryArchive());
    expect(
      screen.getByText(/Occupied 3 of 4,000 channel slots · decoded 2 of 3 occupied/),
    ).toBeInTheDocument();
    const rows = rowTexts();
    expect(rows[1]).toMatch(/^1GB3ED Edinburgh145\.50000/);
    expect(rows[2]).toMatch(/^7MM9PDY Local433\.50000/);
    expect(rows[3]).toMatch(/^9Not capturedOccupied; second half not captured/);
    expect(
      screen.getByText(/separate\s+callsign and name data is unavailable/),
    ).toBeInTheDocument();
  });

  it('searches and sorts over the complete identity label', () => {
    view(memoryArchive());
    fireEvent.change(screen.getByLabelText('Search table'), { target: { value: 'mm9pdy' } });
    expect(rowTexts()).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Search table'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No channels match/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search table'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
    expect(rowTexts()[1]).toMatch(/^1GB3ED/);
    fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
    // Descending: the unreadable-name label sorts first, then MM9PDY, then GB3ED.
    expect(rowTexts()[2]).toMatch(/^7MM9PDY/);
  });

  it('shows zones, selects one and explains each kind of member reference', () => {
    view(memoryArchive());
    open('Zones');
    expect(
      screen.getByText(/Occupied 2 of 250 zone slots · names decoded 2 · member lists decoded 2/),
    ).toBeInTheDocument();
    expect(screen.getByText('(unnamed)')).toBeInTheDocument();
    expect(screen.getByText('Select a zone to see its members.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Local ★'));
    const region = screen.getByRole('region', { name: 'Zone 1 members' });
    const rows = within(region)
      .getAllByRole('row')
      .map((r) => r.textContent ?? '');
    expect(rows[1]).toMatch(/^17MM9PDY Local.*Resolved/);
    expect(rows[2]).toMatch(/^21GB3ED Edinburgh/);
    expect(rows[3]).toMatch(/^37MM9PDY Local/);
    expect(rows[4]).toMatch(/^49.*Not captured: the slot is occupied/);
    expect(rows[5]).toMatch(/^521.*Absent: the channel bitmap/);
    expect(rows[6]).toMatch(/^6Index 4001.*Out of range/);
  });

  it('refreshes rows, references and selected zone when the archive is replaced', () => {
    const { rerender } = view(memoryArchive('2026-01-01'));
    open('Zones');
    fireEvent.click(screen.getByText('Local ★'));
    expect(screen.getByRole('region', { name: 'Zone 1 members' })).toBeInTheDocument();
    rerender(
      <MantineProvider>
        <AtD890Memory
          archive={archive([
            channelSet([1]),
            ...channel(1, 'Replacement', '14600000'),
            zoneSet([0]),
            sparse(zoneNameAddress(0), wide('Other', 0x20)),
            sparse(zoneChannelsAddress(0), members([1])),
          ])}
        />
      </MantineProvider>,
    );
    open('Zones');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByText('Select a zone to see its members.')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.queryByText('Local ★')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Other'));
    expect(screen.getByText('Replacement')).toBeInTheDocument();
  });

  it('keeps zone membership unresolved when the channel bitmap is missing', () => {
    view(archive([zoneSet([0]), sparse(zoneChannelsAddress(0), members([0]))]));
    open('Zones');
    fireEvent.click(screen.getAllByRole('row')[1]!);
    expect(
      screen.getByText(/Cannot resolve: the channel bitmap was not captured/),
    ).toBeInTheDocument();
  });

  it('shows a refused entry and defers the later sections', () => {
    const entries = [
      channelSet([]),
      sparse(0x2000000, new Uint8Array(32)),
      sparse(0x2000010, new Uint8Array(32)),
    ];
    view(archive(entries));
    expect(screen.getByText('2 sparse entries refused')).toBeInTheDocument();
    for (const name of ['Contacts', 'Talk groups', 'RX groups', 'Scan lists', 'Settings']) {
      open(name);
      expect(screen.getByText('Coming in a later piece')).toBeInTheDocument();
    }
  });
});

describe('formatAtD890Tone', () => {
  it('formats tones', () => {
    expect(formatAtD890Tone({ kind: 'none' })).toBe('None');
    expect(formatAtD890Tone({ kind: 'ctcss', hz: 110.9 })).toBe('110.9 Hz');
    expect(formatAtD890Tone({ kind: 'dcs', code: 23, polarity: 'I' })).toBe('D023I');
  });
});
