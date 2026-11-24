import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { radioFoundryMemoryFixtureArchive } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/debugMemoryArchive.ts';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';
import { getDebugReadHistory } from './debugReadHistory.ts';

const md9600Rf = radioDebugDescriptors.find((d) => d.slug === 'md-9600-radiofoundry')!;
const md9600Og = radioDebugDescriptors.find((d) => d.slug === 'md-9600-opengd77')!;

function zipFile(bytes: Uint8Array) {
  const file = new File([Uint8Array.from(bytes)], 'a.zip', { type: 'application/zip' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => Uint8Array.from(bytes).buffer,
  });
  return file;
}

function shell(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio/:firmware" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  act(() => {
    getDebugReadHistory(md9600Og).clear();
    getDebugReadHistory(md9600Rf).clear();
  });
});

describe('archive switch across firmware', () => {
  it('offers switch from OpenGD77 to RadioFoundry and imports into RF history', async () => {
    const base = radioFoundryMemoryFixtureArchive();
    const zipBytes = packRadioBackupZip(
      { ...base.manifest, radioModelId: 'MD-9600-RadioFoundry' },
      base.regions,
      {},
    );

    shell(debugRadioPath(md9600Og));
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [zipFile(zipBytes)] } });
    expect(await screen.findByText(/This is a RadioFoundry read/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Switch to RadioFoundry and open it/ }));
    expect(await screen.findByText(/Local archive · captured/)).toBeInTheDocument();
    expect(getDebugReadHistory(md9600Rf).getSnapshot().entries).toHaveLength(1);
  });

  it('keeps the model mismatch error for a non-sibling archive', async () => {
    const local = new Uint8Array(0x100);
    const zipBytes = packRadioBackupZip(
      {
        format: 'codeplug-studio-radio-backup',
        version: 1,
        capturedAt: '2026-01-01',
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'AT-D890UV',
        descriptorLabel: 'test',
        coverage: 'partial',
        imageByteLength: local.length,
        regions: [
          {
            id: 'vital-local-info',
            label: 'LocalInfo',
            address: 0,
            byteLength: local.length,
            path: 'regions/local.bin',
            restoreRole: 'inspect-only',
          },
        ],
      },
      { 'vital-local-info': local },
    );

    shell(debugRadioPath(md9600Og));
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [zipFile(zipBytes)] },
    });
    expect(await screen.findByText(/does not match this profile/)).toBeInTheDocument();
    expect(screen.queryByText(/Switch to .* and open it/)).not.toBeInTheDocument();
  });
});
