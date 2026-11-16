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
  receiveGroupAddress,
  talkgroupAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { AtD890Memory } from './AtD890Memory.tsx';
import { AtD890Settings } from './AtD890Settings.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { chooseCategory } from '@app/components/debug/memoryCategoriesTestUtils.ts';

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

const NOT_CAPTURED_TEXT = 'Not captured';
const view = (a?: DebugArchive) =>
  render(
    <MantineProvider>
      <AtD890Memory archive={a} />
    </MantineProvider>,
  );
const viewSettings = (a?: DebugArchive) =>
  render(
    <MantineProvider>
      <AtD890Settings archive={a} />
    </MantineProvider>,
  );
const rowTexts = () => screen.getAllByRole('row').map((r) => r.textContent ?? '');
const open = (name: string) => chooseCategory(name);

describe('AtD890Memory', () => {
  it('shows a clear no-capture state', () => {
    view();
    expect(screen.getByText('No capture')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Category' })).not.toBeInTheDocument();
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

  it('shows a refused entry', () => {
    const entries = [
      channelSet([]),
      sparse(0x2000000, new Uint8Array(32)),
      sparse(0x2000010, new Uint8Array(32)),
    ];
    view(archive(entries));
    expect(screen.getByText('2 sparse entries refused')).toBeInTheDocument();
    expect(screen.queryByText('Coming in a later piece')).not.toBeInTheDocument();
  });

  describe('contacts, talk groups and RX groups', () => {
    const tgSet = (occupied: number[]) => {
      const out = new Uint8Array(0x4f0).fill(0xff);
      for (const b of occupied) out[b >> 3]! &= ~(1 << (b & 7));
      return sparse(D890_MAP.TalkgroupSet, out);
    };
    const rec = (type: number, id: string, name: string, callsign = '', city = '') => {
      const r = new Uint8Array(0xc8);
      r[0] = type;
      r.set(bcd(id), 2);
      r.set(wide(name, 0x20), 6);
      r.set(wide(city, 0x20), 0x2a);
      r.set(wide(callsign, 0x18), 0x4a);
      return r;
    };
    const rxRec = (m: number[], name: string) => {
      const r = new Uint8Array(0x120).fill(0xff);
      m.forEach((v, i) => new DataView(r.buffer).setUint32(i * 4, v, true));
      r.set(wide(name, 0x20), 0x100);
      return r;
    };
    const digital = () => {
      const r = new Uint8Array(0x80);
      r.set(bcd('43350000'), 0);
      r[0x08] = 0x0d;
      new DataView(r.buffer).setUint32(0x14, 1, true); // slot 2
      r.set(wide('DMR One', 0x20), 0x44);
      return [
        sparse(channelPrimaryAddress(0), r.slice(0, 0x40)),
        sparse(channelSecondaryAddress(0), r.slice(0x40)),
      ];
    };
    const rxBits = new Uint8Array(0x20);
    rxBits[0] = 1;
    const bankArchive = (stamp = '2026-01-01') =>
      archive(
        [
          channelSet([0]),
          ...digital(),
          tgSet([0, 1, 2, 3]),
          sparse(talkgroupAddress(0), rec(0, '00000091', 'Alice', 'MM9PDY', 'Leith')),
          sparse(talkgroupAddress(1), rec(1, '00000091', 'Scotland')),
          sparse(talkgroupAddress(2), rec(2, '00000093', 'All')),
          // slot 4 is occupied but not captured
          sparse(D890_MAP.ReceiveGroupSet, rxBits),
          sparse(receiveGroupAddress(0), rxRec([1, 1, 10000], 'Scots')),
        ],
        stamp,
      );

    it('splits the shared bank by call type, keeps slots and flags unclassified entries', () => {
      view(bankArchive());
      open('Contacts');
      expect(screen.getByText(/Bank occupied 4 of 10,000 slots/)).toBeInTheDocument();
      expect(screen.getByText(/1 unclassified/)).toBeInTheDocument();
      let rows = rowTexts();
      expect(rows[1]).toMatch(/^1MM9PDY Alice/);
      expect(rows[2]).toMatch(/^4Not captured/);
      open('Talk groups');
      rows = rowTexts();
      expect(rows[1]).toMatch(/^2Scotland.*Group/);
      expect(rows[2]).toMatch(/^3All.*All call/);
      expect(rows[1]).toMatch(/RX groups: 1 Scots/);
    });

    it('searches callsign and DMR ID and sorts without renumbering slots', () => {
      view(bankArchive());
      open('Contacts');
      fireEvent.change(screen.getByLabelText('Search table'), { target: { value: 'mm9pdy' } });
      expect(rowTexts()).toHaveLength(2);
      fireEvent.change(screen.getByLabelText('Search table'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
      fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
      // Descending identity puts the unclassified slot first; slot numbers do not change.
      expect(rowTexts()[1]).toMatch(/^4Not captured/);
      expect(rowTexts()[2]).toMatch(/^1MM9PDY Alice/);
      fireEvent.change(screen.getByLabelText('Search table'), { target: { value: '91' } });
      expect(rowTexts()).toHaveLength(2);
    });

    it('labels Referenced by as partial when RX coverage is missing', () => {
      view(archive([tgSet([0]), sparse(talkgroupAddress(0), rec(1, '00000091', 'Scotland'))]));
      open('Talk groups');
      expect(screen.getByText('Referenced by is partial')).toBeInTheDocument();
      expect(
        screen.getByText(/None found; channel or RX group coverage incomplete/),
      ).toBeInTheDocument();
    });

    it('shows a missing bitmap as Not captured, not as empty', () => {
      view(archive([channelSet([])]));
      open('Talk groups');
      expect(screen.getByText('Not captured')).toBeInTheDocument();
      expect(screen.queryByText(/no talk groups are present/)).not.toBeInTheDocument();
      open('RX groups');
      expect(screen.getByText('Not captured')).toBeInTheDocument();
    });

    it('shows a captured empty bank as genuinely empty', () => {
      view(archive([tgSet([])]));
      open('Contacts');
      expect(screen.getByText(/no contacts are present/)).toBeInTheDocument();
    });

    it('resolves the channel contact reference against its bank slot', () => {
      view(bankArchive());
      expect(screen.getByText('#2 Scotland (Group)')).toBeInTheDocument();
    });

    it('selects an RX group and explains each member reference', () => {
      view(bankArchive());
      open('RX groups');
      expect(screen.getByText('Select an RX group to see its members.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Scots'));
      const region = screen.getByRole('region', { name: 'RX group 1 members' });
      const rows = within(region)
        .getAllByRole('row')
        .map((r) => r.textContent ?? '');
      expect(rows[1]).toMatch(/^12Scotland/);
      expect(rows[2]).toMatch(/^22Scotland/);
      expect(rows[3]).toMatch(/^3Index 10000.*Out of range/);
    });

    it('clears selection when the archive is replaced', () => {
      const { rerender } = view(bankArchive('2026-01-01'));
      open('RX groups');
      fireEvent.click(screen.getByText('Scots'));
      expect(screen.getByRole('region', { name: 'RX group 1 members' })).toBeInTheDocument();
      rerender(
        <MantineProvider>
          <AtD890Memory
            archive={archive([
              tgSet([]),
              sparse(D890_MAP.ReceiveGroupSet, rxBits),
              sparse(receiveGroupAddress(0), rxRec([], 'Other')),
            ])}
          />
        </MantineProvider>,
      );
      open('RX groups');
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });
  });

  describe('scan lists and settings', () => {
    const SCAN_SET = 0x3482c60;
    const MAIN = 0x3500000;
    const scanRec = (name: string, p1: number, members: number[]) => {
      const r = new Uint8Array(0x200).fill(0xff);
      r[0x01] = 1;
      r.set([p1 & 0xff, p1 >> 8], 0x02);
      r.set([0xff, 0xff], 0x04);
      r.fill(0, 0x0e, 0x2e);
      r.set(wide(name, 0x20), 0x0e);
      members.forEach((m, i) => r.set([m & 0xff, m >> 8], 0x30 + i * 2));
      return r;
    };
    const scanArchive = (capturedAt = '2026-01-01') =>
      archive(
        [
          channelSet([0, 1]),
          ...channel(0, 'GB3ED Edinburgh', '14550000'),
          ...channel(1, 'MM9PDY Local', '43350000'),
          sparse(SCAN_SET, bitmap(0x20, [0, 32])),
          sparse(0x2100000, scanRec('Local scan', 2, [0, 0, 7])),
          sparse(0x2180000, scanRec('Bank one', 0xffff, [1])),
        ],
        capturedAt,
      );

    it('shows scan lists, their priority and member roles, and keeps other panels', () => {
      view(scanArchive());
      open('Scan lists');
      expect(screen.getByText(/Occupied 2 of 250 scan list slots/)).toBeInTheDocument();
      expect(rowTexts().some((t) => t.includes('Bank one') && t.includes('33'))).toBe(true);
      fireEvent.click(screen.getAllByRole('row')[1]!);
      const details = screen.getByRole('region', { name: 'Scan list 1 details' });
      expect(
        within(details).getByText(/Priority 1: Channel slot 2 · MM9PDY Local/),
      ).toBeInTheDocument();
      expect(within(details).getByText('Priority 2: Off')).toBeInTheDocument();
      expect(within(details).getByText(/Absent: the channel bitmap/)).toBeInTheDocument();
      // Duplicate member and the unresolved one are kept in order.
      expect(within(details).getAllByText('GB3ED Edinburgh')).toHaveLength(2);
      // Earlier panels still render.
      open('Channels');
      expect(screen.getByText(/Occupied 2 of 4,000 channel slots/)).toBeInTheDocument();
      open('Zones');
      expect(screen.getByText(/Zone bitmap|not completely captured/i)).toBeInTheDocument();
    });

    it('searches scan lists by member identity', () => {
      view(scanArchive());
      open('Scan lists');
      fireEvent.change(screen.getByPlaceholderText('Search scan lists'), {
        target: { value: 'MM9PDY' },
      });
      expect(rowTexts().some((t) => t.includes('Bank one'))).toBe(true);
      expect(rowTexts().some((t) => t.includes('Local scan'))).toBe(false);
    });

    it('says Not captured for a missing scan list bitmap', () => {
      view(archive([channelSet([])]));
      open('Scan lists');
      expect(
        screen.getByText(/scan list occupancy bitmap was not completely captured/),
      ).toBeInTheDocument();
    });

    it('shows a captured empty scan list bitmap as empty', () => {
      view(archive([sparse(SCAN_SET, bitmap(0x20, []))]));
      open('Scan lists');
      expect(screen.getByText(/no scan list slot is occupied/)).toBeInTheDocument();
    });

    it('groups settings, separates missing from decoded, and toggles raw bytes', () => {
      viewSettings(
        archive([
          sparse(MAIN + 0x26, Uint8Array.of(2)),
          sparse(MAIN + 0x05, Uint8Array.of(7)),
          sparse(MAIN + 0x60, Uint8Array.of(0xaa, 0xbb)),
        ]),
      );
      for (const name of [
        'Display',
        'Audio & tones',
        'Power & battery',
        'Keys & buttons',
        'DMR',
        'GPS / APRS',
        'Scan',
        'Privacy / lock',
        'Mod features',
      ])
        expect(screen.getByRole('region', { name })).toBeInTheDocument();
      expect(screen.getByText(/2 of \d+ known setting fields captured/)).toBeInTheDocument();
      const display = screen.getByRole('region', { name: 'Display' });
      expect(within(display).getAllByText(NOT_CAPTURED_TEXT).length).toBeGreaterThan(0);
      // Unsupported value keeps its raw bytes visible without the toggle.
      expect(within(display).getByText(/Unsupported value/)).toBeInTheDocument();
      expect(within(display).getByText(/Raw 0x3500005: 07/)).toBeInTheDocument();
      expect(screen.queryByText('Raw bytes')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
      expect(screen.getAllByText('Raw bytes').length).toBeGreaterThan(0);
      expect(screen.getByText('0x3500026')).toBeInTheDocument();
      // Unregistered bytes are named in the table (VFO scan limits here), not listed as unknown.
      const other = screen.getByRole('region', { name: 'Other settings bytes' });
      expect(within(other).getByText('0x3500060 +2')).toBeInTheDocument();
      expect(within(other).getByText('VfoScanFreq0..3')).toBeInTheDocument();
      expect(within(other).getByText('AA BB')).toBeInTheDocument();
      expect(screen.getByText('No unexplained captured bytes.')).toBeInTheDocument();
      expect(screen.getByText(/No scan setting is established/)).toBeInTheDocument();
    });

    it('shows real zero states, the GPS template text and the MM9PDY store', () => {
      const store = new Uint8Array(32);
      store.set([0x4d, 0x36, 1, 1], 0);
      store[31] = store.slice(0, 31).reduce((a, b) => (a + b) & 0xff, 0);
      const text = new Uint8Array(0x30);
      'HELLO'.split('').forEach((c, i) => (text[i * 2] = c.charCodeAt(0)));
      viewSettings(
        archive([
          sparse(MAIN + 0x19, Uint8Array.of(0)),
          sparse(MAIN + 0x107, Uint8Array.of(0)),
          sparse(MAIN + 0x1c, Uint8Array.of(2)),
          sparse(MAIN + 0x156, Uint8Array.of(0)),
          sparse(MAIN + 0x200, store),
          sparse(0x3501280, text),
        ]),
      );
      const dmr = screen.getByRole('region', { name: 'DMR' });
      expect(within(dmr).getByText('No hang time (0)')).toBeInTheDocument();
      expect(within(dmr).getByText('0 (acts as 1 s)')).toBeInTheDocument();
      expect(within(dmr).getByText('2 (sent as 5, 300 ms)')).toBeInTheDocument();
      expect(within(dmr).queryByText(/Unsupported value/)).not.toBeInTheDocument();
      expect(screen.getByText('Level 0')).toBeInTheDocument();
      const gps = screen.getByRole('region', { name: 'GPS / APRS' });
      expect(within(gps).getByText('HELLO')).toBeInTheDocument();
      expect(within(gps).getByText(/0x30 of 0x42 bytes/)).toBeInTheDocument();
      const mod = screen.getByRole('region', { name: 'Mod features' });
      expect(within(mod).getByText('Scan list (1)')).toBeInTheDocument();
      expect(within(mod).getByText(/traced from source/)).toBeInTheDocument();
    });

    it('filters settings by search', () => {
      viewSettings(archive([sparse(MAIN + 0x26, Uint8Array.of(2))]));
      fireEvent.change(screen.getByPlaceholderText('Search settings'), {
        target: { value: 'backlight' },
      });
      expect(screen.getByRole('region', { name: 'Display' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Audio & tones' })).not.toBeInTheDocument();
    });

    it('replaces scan list selection and settings when the archive is replaced', () => {
      const { rerender } = view(scanArchive('2026-01-01'));
      open('Scan lists');
      fireEvent.click(screen.getAllByRole('row')[1]!);
      expect(screen.getByRole('region', { name: 'Scan list 1 details' })).toBeInTheDocument();
      rerender(
        <MantineProvider>
          <AtD890Memory archive={archive([sparse(SCAN_SET, bitmap(0x20, [3]))], '2026-02-02')} />
        </MantineProvider>,
      );
      open('Scan lists');
      expect(screen.queryByRole('region', { name: 'Scan list 1 details' })).not.toBeInTheDocument();
      expect(screen.getByText(/Occupied 1 of 250 scan list slots/)).toBeInTheDocument();
    });
  });
});
