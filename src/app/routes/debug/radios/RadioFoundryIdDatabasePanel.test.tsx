import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { encodeDmrIdDatabase } from '@integrations/radio-io/radios/radiofoundry/idDatabase.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_AREA1_RECORDS,
  DMR_ID_DATABASE_AREA2_ADDRESS,
  DMR_ID_DATABASE_RECORD_BYTES,
} from '@integrations/radio-io/radios/radiofoundry/idDatabase.ts';
import { FLASH_IMAGE_START } from '@integrations/radio-io/radios/radiofoundry/constants.ts';
import { radioFoundryMemoryFixtureArchive } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/debugMemoryArchive.ts';
import { openDebugArchive } from './captureArchive.ts';
import { RadioFoundryIdDatabasePanel } from './RadioFoundryIdDatabasePanel.tsx';

function embedArea1(flash: Uint8Array, area1: Uint8Array) {
  flash.set(area1, DMR_ID_DATABASE_ADDRESS - FLASH_IMAGE_START);
}

function archiveWithIdDb(rows: number, opts: { area2?: Uint8Array; area2Swap?: boolean } = {}) {
  const encoded = encodeDmrIdDatabase(
    Array.from({ length: rows }, (_, i) => ({
      digitalId: 2_340_001 + i,
      callsign: `MM0A${String(i).padStart(2, '0')}`,
      name: '',
    })),
    [],
  )!;
  const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
  embedArea1(flash, encoded.area1);
  const regions: Record<string, Uint8Array> = {
    ...radioFoundryMemoryFixtureArchive().regions,
    [RADIOFOUNDRY_REGION.flash]: flash,
  };
  if (opts.area2) {
    let area2 = opts.area2;
    if (opts.area2Swap) {
      area2 = area2.slice();
      const a = area2.subarray(0, DMR_ID_DATABASE_RECORD_BYTES);
      const b = area2.subarray(DMR_ID_DATABASE_RECORD_BYTES, DMR_ID_DATABASE_RECORD_BYTES * 2);
      area2.set(b, 0);
      area2.set(a, DMR_ID_DATABASE_RECORD_BYTES);
    }
    regions[RADIOFOUNDRY_REGION.area2] = area2;
  }
  const base = radioFoundryMemoryFixtureArchive();
  const manifestRegions = [...base.manifest.regions];
  if (regions[RADIOFOUNDRY_REGION.area2]) {
    manifestRegions.push({
      id: RADIOFOUNDRY_REGION.area2,
      address: DMR_ID_DATABASE_AREA2_ADDRESS,
      byteLength: regions[RADIOFOUNDRY_REGION.area2]!.length,
      label: 'DMR ID database area 2',
      path: `regions/${RADIOFOUNDRY_REGION.area2}.bin`,
      restoreRole: 'inspect-only',
    });
  }
  const manifest = {
    ...base.manifest,
    radioModelId: 'MD-9600-RadioFoundry',
    regions: manifestRegions,
  };
  return openDebugArchive(packRadioBackupZip(manifest, regions, {}), manifest.radioModelId);
}

describe('RadioFoundryIdDatabasePanel', () => {
  it('shows counts and ascending integrity for a clean database', () => {
    const archive = archiveWithIdDb(50);
    render(
      <DesignSystemV2Provider>
        <RadioFoundryIdDatabasePanel archive={{ ...archive, source: 'file-open' }} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/IDs ascend across both areas/i)).toBeInTheDocument();
    expect(screen.getByText(/Header record count/i)).toBeInTheDocument();
  });

  it('shows a join break when area 2 is out of order', () => {
    const archive = archiveWithIdDb(DMR_ID_DATABASE_AREA1_RECORDS + 2, {
      area2: encodeDmrIdDatabase(
        Array.from({ length: DMR_ID_DATABASE_AREA1_RECORDS + 2 }, (_, i) => ({
          digitalId: 2_340_001 + i,
          callsign: `MM0A${i}`,
          name: '',
        })),
        [],
      )!.area2,
      area2Swap: true,
    });
    render(
      <DesignSystemV2Provider>
        <RadioFoundryIdDatabasePanel archive={{ ...archive, source: 'file-open' }} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/IDs stop ascending/i)).toBeInTheDocument();
  });

  it('finds text after debounced lookup', async () => {
    const archive = archiveWithIdDb(20);
    render(
      <DesignSystemV2Provider>
        <RadioFoundryIdDatabasePanel archive={{ ...archive, source: 'file-open' }} />
      </DesignSystemV2Provider>,
    );
    const input = screen.getByRole('textbox', { name: /DMR ID/i });
    fireEvent.change(input, { target: { value: '2340005' } });
    await waitFor(() => expect(screen.getByText(/Found at record/i)).toBeInTheDocument(), {
      timeout: 800,
    });
  });

  it('explains format n without decoding', () => {
    const header = new Uint8Array(12);
    header.set([0x49, 0x64, 0x6e, 0x65, 0x30, 0x30, 0x31, 0x00, 5, 0, 0, 0]);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, header);
    const regions = {
      ...radioFoundryMemoryFixtureArchive().regions,
      [RADIOFOUNDRY_REGION.flash]: flash,
    };
    const manifest = radioFoundryMemoryFixtureArchive().manifest;
    const archive = openDebugArchive(
      packRadioBackupZip(manifest, regions, {}),
      manifest.radioModelId,
    );
    render(
      <DesignSystemV2Provider>
        <RadioFoundryIdDatabasePanel archive={{ ...archive, source: 'file-open' }} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/voice-prompt area/i)).toBeInTheDocument();
  });
});
