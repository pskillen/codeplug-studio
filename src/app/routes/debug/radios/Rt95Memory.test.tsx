import { MantineProvider } from '@mantine/core';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { encodeRt95ModData } from '@integrations/radio-io/radios/rt95/modData/encode.ts';
import { openDebugArchive } from './captureArchive.ts';
import { Rt95Memory } from './Rt95Memory.tsx';

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
    expect(screen.getByText(/MM9PDY-compatible data present/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 1: clone occupancy unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 200: clone occupancy unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/ZST1 state.*invalid/)).toBeInTheDocument();
    view.rerender(
      <MantineProvider>
        <Rt95Memory archive={archive(bytes, false)} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/MM9PDY-compatible data present/)).not.toBeInTheDocument();
    expect(screen.getByText(/Guard evidence unverified/)).toBeInTheDocument();
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
    expect(screen.getByText(new RegExp(`Header invalid: ${reason}`))).toBeInTheDocument();
  });
});
