import { MantineProvider } from '@mantine/core';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { encodeChannelRecord } from '@integrations/radio-io/radios/rt95/channelCodec.ts';
import { RT95_OCCUPIED_BITFIELD_OFFSET } from '@integrations/radio-io/radios/rt95/constants.ts';
import { encodeRt95ModData } from '@integrations/radio-io/radios/rt95/modData/encode.ts';
import {
  RT95_KEY_FUNCTION_DIR,
  RT95_KEY_TABLE_ADDR,
} from '@integrations/radio-io/radios/rt95/zoneKey.ts';
import { chooseCategory } from '@app/components/debug/memoryCategoriesTestUtils.ts';
import { openDebugArchive } from './captureArchive.ts';
import { Rt95Memory, Rt95MemoryView } from './Rt95Memory.tsx';
import { RT95_MEMORY_NOT_DECODED } from '@integrations/radio-io/radios/rt95/debugMemoryText.ts';

const ident = Uint8Array.from([82, 84, 57, 53, 45, 80, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const region = {
  id: 'rt95-mmd1',
  label: 'MMD1',
  address: 0x4000,
  byteLength: 8192,
  path: 'regions/rt95-mmd1.bin',
  restoreRole: 'inspect-only' as const,
};
const manifest: RadioBackupManifestV1 = {
  format: 'codeplug-studio-radio-backup',
  version: 1,
  capturedAt: '2026-01-01',
  capturedVia: 'file',
  app: { buildEnv: 'test', buildVersion: 'test' },
  radioModelId: 'retevis-rt95',
  descriptorLabel: 'test',
  coverage: 'partial',
  imageByteLength: 0,
  regions: [region],
};
function archive(bytes: Uint8Array, guard = true) {
  const sidecars: Record<string, Uint8Array> = guard
    ? {
        'debug/rt95-guard-ident.bin': ident,
        'debug/rt95-guard-alias.bin': new Uint8Array(16).fill(255),
        'debug/rt95-guard.json': new TextEncoder().encode('{"ok":true}'),
      }
    : {};
  return openDebugArchive(
    packRadioBackupZip(manifest, { 'rt95-mmd1': bytes }, sidecars),
    'retevis-rt95',
  );
}
afterEach(cleanup);
/** Zones draw as a table; a zone's member table opens when its row is clicked. */
const openZone = (name: string) => fireEvent.click(screen.getByText(name));
describe('RT95 MMD1 viewer', () => {
  it('shows zones and one-based members without clone data, and gates its claim on evidence', () => {
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData(
      { zones: [{ name: 'TEST', channelIndexes: [0, 199] }], descriptions: [] },
      new Uint8Array(0),
    ).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    const a = archive(bytes);
    const view = render(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    expect(screen.getByText(/MM9PDY-compatible data present/)).toBeInTheDocument();
    openZone('TEST');
    expect(screen.getByText(/2 members point at empty or unreadable slots/)).toBeInTheDocument();
    expect(screen.getByText(/1 \(unavailable\), 200 \(unavailable\)/)).toBeInTheDocument();
    expect(screen.getByText(/ZST1 state.*invalid/)).toBeInTheDocument();
    view.rerender(
      <MantineProvider>
        <Rt95Memory archive={archive(bytes, false)} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/MM9PDY-compatible data present/)).not.toBeInTheDocument();
    expect(screen.getByText(/Guard evidence unverified/)).toBeInTheDocument();
  });
  it('shows a fingerprint-checked description after the wire name and hides stale descriptions', () => {
    const clone = new Uint8Array(0x32a0);
    clone.set(
      encodeChannelRecord({
        slotIndex: 1,
        empty: false,
        wireName: 'WIRE',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      }),
    );
    clone[RT95_OCCUPIED_BITFIELD_OFFSET] = 1;
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData(
      { zones: [], descriptions: [{ channelIndex: 0, text: 'DESCRIPTION' }] },
      clone,
    ).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    const a = archive(bytes);
    a.regions['programming-image'] = clone;
    a.manifest.regions.push({
      id: 'programming-image',
      label: 'Clone',
      address: 0,
      byteLength: clone.length,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    });
    const view = render(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    expect(screen.getByText('DESCRIPTION [body]')).toBeInTheDocument();
    clone[0] = clone[0]! ^ 1;
    view.rerender(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    expect(screen.queryByText('DESCRIPTION [body]')).not.toBeInTheDocument();
  });
  it.each([
    ['receive BCD', 0, 0xfa],
    ['offset BCD', 4, 0xaf],
    ['power enum', 9, 0x0c],
    ['width enum', 10, 0x0c],
    ['tone enum', 13, 0xff],
  ])('marks an occupied record with corrupt %s unreadable', (_, offset, value) => {
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData(
      { zones: [{ name: 'TEST', channelIndexes: [0] }], descriptions: [] },
      new Uint8Array(),
    ).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    const clone = new Uint8Array(RT95_OCCUPIED_BITFIELD_OFFSET + 1);
    clone.set(
      encodeChannelRecord({
        slotIndex: 1,
        empty: false,
        wireName: 'VALID',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      }),
    );
    if (offset === 13) clone[11] = 1;
    clone[offset] = value;
    clone[RT95_OCCUPIED_BITFIELD_OFFSET] = 1;
    const a = archive(bytes);
    a.regions['programming-image'] = clone;
    a.manifest.regions.push({
      id: 'programming-image',
      label: 'Clone',
      address: 0,
      byteLength: clone.length,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    });
    render(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    openZone('TEST');
    expect(screen.getByText(/1 member points at empty or unreadable slots/)).toBeInTheDocument();
    expect(screen.getByText(/1 \(unreadable\)/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('rt95-zone-1')).queryByRole('cell', { name: /VALID/ }),
    ).not.toBeInTheDocument();
  });
  it('renders only occupied zone members, radio name first, and counts the hidden ones', () => {
    const clone = new Uint8Array(0x32a0);
    const rec = (slotIndex: number, wireName: string) =>
      encodeChannelRecord({
        slotIndex,
        empty: false,
        wireName,
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      });
    clone.set(rec(1, 'GB3WE'), 0);
    clone.set(rec(3, 'LOCAL'), 2 * 32);
    clone[RT95_OCCUPIED_BITFIELD_OFFSET] = 0b101;
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData(
      {
        zones: [{ name: 'MIXED', channelIndexes: [0, 1, 2] }],
        descriptions: [{ channelIndex: 0, text: 'Westerton' }],
      },
      clone,
    ).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    const a = archive(bytes);
    a.regions['programming-image'] = clone;
    a.manifest.regions.push({
      id: 'programming-image',
      label: 'Clone',
      address: 0,
      byteLength: clone.length,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    });
    render(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    openZone('MIXED');
    const zone = within(screen.getByTestId('rt95-zone-1'));
    expect(zone.getByText('Zone 1: MIXED')).toBeInTheDocument();
    expect(zone.getByText('3 members')).toBeInTheDocument();
    expect(zone.getByText('members valid')).toBeInTheDocument();
    expect(zone.getByRole('cell', { name: /^GB3WE\s*·\s*Westerton$/ })).toBeInTheDocument();
    expect(zone.getByRole('cell', { name: 'LOCAL' })).toBeInTheDocument();
    expect(zone.getAllByRole('row')).toHaveLength(3);
    expect(zone.getByText(/1 member points at empty or unreadable slots/)).toBeInTheDocument();
    expect(zone.getByText(/2 \(empty\)/)).toBeInTheDocument();
    expect(screen.getByText(/no callsign field/)).toBeInTheDocument();
    expect(screen.queryByText(/\[unknown\]/)).not.toBeInTheDocument();
  });
  it.each([
    [255, 'blank or absent'],
    [0, 'invalid'],
  ])('reports header filled with %i', (fill, status) => {
    render(
      <MantineProvider>
        <Rt95Memory archive={archive(new Uint8Array(8192).fill(fill))} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    expect(screen.getByText(new RegExp(`Header ${status}`))).toBeInTheDocument();
  });
  it('keeps a corrupt zone distinct from a valid header and suppresses the claim', () => {
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData(
      { zones: [{ name: 'BAD', channelIndexes: [0] }], descriptions: [] },
      new Uint8Array(),
    ).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    bytes[0x300] = bytes[0x300]! ^ 1;
    render(
      <MantineProvider>
        <Rt95Memory archive={archive(bytes)} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    openZone('BAD');
    expect(screen.getByText(/invalid member CRC/)).toBeInTheDocument();
    expect(screen.queryByText(/MM9PDY-compatible data present/)).not.toBeInTheDocument();
  });
  it.each([
    [4, 'version'],
    [14, 'crc'],
  ])('reports invalid header byte %i', (offset, reason) => {
    const bytes = new Uint8Array(8192).fill(255);
    for (const block of encodeRt95ModData({ zones: [], descriptions: [] }, new Uint8Array()).blocks)
      bytes.set(block.bytes, block.address - 0x4000);
    bytes[offset] = bytes[offset]! ^ 1;
    render(
      <MantineProvider>
        <Rt95Memory archive={archive(bytes)} />
      </MantineProvider>,
    );
    chooseCategory('Zones');
    expect(screen.getByText(new RegExp(`Header invalid: ${reason}`))).toBeInTheDocument();
  });
  it('draws P-keys as a table and keeps the DIR meaning, or says the bytes are unavailable', () => {
    const clone = new Uint8Array(0x32a0);
    clone[RT95_KEY_TABLE_ADDR] = RT95_KEY_FUNCTION_DIR;
    clone[RT95_KEY_TABLE_ADDR + 1] = 0x05;
    const a = archive(new Uint8Array(8192).fill(255));
    a.regions['programming-image'] = clone;
    a.manifest.regions.push({
      id: 'programming-image',
      label: 'Clone',
      address: 0,
      byteLength: clone.length,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    });
    const view = render(
      <MantineProvider>
        <Rt95Memory archive={a} />
      </MantineProvider>,
    );
    chooseCategory('P-keys');
    expect(screen.getByText('12 key bytes in 2 groups of 6')).toBeInTheDocument();
    expect(screen.getByText('DIR; used as ZON by compatible firmware.')).toBeInTheDocument();
    expect(screen.getByLabelText('Search table')).toBeInTheDocument();
    view.unmount();
    render(
      <MantineProvider>
        <Rt95Memory archive={archive(new Uint8Array(8192).fill(255))} />
      </MantineProvider>,
    );
    chooseCategory('P-keys');
    expect(screen.getByText('P-key bytes unavailable.')).toBeInTheDocument();
  });
  it('names what is not decoded once and has no Occupancy column', () => {
    const clone = new Uint8Array(0x32a0);
    clone[RT95_OCCUPIED_BITFIELD_OFFSET] = 0;
    const a = archive(new Uint8Array(8192).fill(255));
    a.regions['programming-image'] = clone;
    a.manifest.regions.push({
      id: 'programming-image',
      label: 'Clone',
      address: 0,
      byteLength: clone.length,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    });
    render(
      <MantineProvider>
        <Rt95MemoryView archive={a} notDecoded={RT95_MEMORY_NOT_DECODED} />
      </MantineProvider>,
    );
    expect(
      screen.getByText('Not decoded for this radio yet: scan lists, contacts, talk groups.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Occupancy' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Identity' })).toBeInTheDocument();
  });
});
