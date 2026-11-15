import { MantineProvider, Tabs } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { memoryMapFromBytes, memoryMapToBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import { encodeChannelsIntoImage } from '@integrations/radio-io/radios/rt95/channelCodec.ts';
import { Coverage } from './Coverage.tsx';
import { HexViewer, MemoryViewer } from './ArchiveViewers.tsx';

const manifest: RadioBackupManifestV1 = {
  format: 'codeplug-studio-radio-backup',
  version: 1,
  capturedAt: '2026-01-01',
  capturedVia: 'file',
  app: { buildEnv: 'test', buildVersion: 'test' },
  radioModelId: 'retevis-rt95',
  descriptorLabel: 'test',
  coverage: 'partial',
  imageByteLength: 3,
  regions: [
    {
      id: 'programming-image',
      label: 'Programming image',
      address: 0,
      byteLength: 3,
      path: 'regions/image.bin',
      restoreRole: 'inspect-only',
    },
  ],
};
const capture = openDebugArchive(
  packRadioBackupZip(manifest, { 'programming-image': new Uint8Array([97, 98, 99]) }),
  'retevis-rt95',
);

describe('archive viewer controls', () => {
  it('shows a synthetic region hash and missing coverage', async () => {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: webcrypto.subtle,
    });
    render(
      <MantineProvider>
        <Coverage archive={capture} />
      </MantineProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText(/ba7816bf8f01cfea414140de5dae2223/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Missing/)).toBeInTheDocument();
  });
  it('searches the decoded RT95 channel slots without changing them', () => {
    const image = memoryMapFromBytes(buildSyntheticRt95Image());
    encodeChannelsIntoImage(image, [
      {
        slotIndex: 7,
        empty: false,
        wireName: 'LOCAL',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
      },
    ]);
    const bytes = memoryMapToBytes(image);
    const fullManifest = {
      ...manifest,
      imageByteLength: bytes.length,
      regions: [{ ...manifest.regions[0], byteLength: bytes.length }],
    };
    const full = openDebugArchive(
      packRadioBackupZip(fullManifest, { 'programming-image': bytes }),
      'retevis-rt95',
    );
    render(
      <MantineProvider>
        <MemoryViewer archive={full} />
      </MantineProvider>,
    );
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search channels' }), {
      target: { value: 'other' },
    });
    expect(screen.queryByText('LOCAL')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search channels' }), {
      target: { value: 'local' },
    });
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('renders labelled keyboard-reachable region and tabs at 375px with bounded bytes', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    const large = {
      ...capture,
      regions: { 'programming-image': new Uint8Array(1024 * 1024) },
      manifest: {
        ...capture.manifest,
        regions: [{ ...capture.manifest.regions[0], byteLength: 1024 * 1024 }],
      },
    };
    render(
      <MantineProvider>
        <Tabs defaultValue="hex">
          <Tabs.List>
            <Tabs.Tab value="hex">Hex</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="hex">
            <HexViewer archive={large} />
          </Tabs.Panel>
        </Tabs>
      </MantineProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Hex' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hexadecimal bytes').textContent?.split('\n')).toHaveLength(16);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Go to address'), { target: { value: '0x1F00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText(/Page 32 of /)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Go to address'), { target: { value: '0xFFFFFFF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText(/outside this region/)).toBeInTheDocument();
  });
});
