import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { radioFoundryMemoryFixtureArchive } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/debugMemoryArchive.ts';
import { openDebugArchive } from './captureArchive.ts';
import { RadioFoundryImportNotesPanel, RadioFoundryMemory } from './RadioFoundryMemory.tsx';
import { projectRadioFoundryMemory } from '@integrations/radio-io/radios/radiofoundry/debugMemory.ts';
import {
  archiveFromRadioFoundryImage,
  serialiseRadioFoundryCodeplug,
} from '@integrations/radio-io/radios/radiofoundry/__fixtures__/debugMemoryArchive.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { newChannel, newOwnDigitalId } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';

function fmDmrChannel(name: string): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    primaryMode: 'dmr',
    modeProfiles: [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
  return { entity, wireName: name };
}

function categorySelect() {
  return screen.getAllByLabelText('Category')[0]!;
}

function openMemory(archive = radioFoundryMemoryFixtureArchive()) {
  const packed = packRadioBackupZip(archive.manifest, archive.regions, {});
  const debugArchive = openDebugArchive(packed, archive.manifest.radioModelId);
  return render(
    <DesignSystemV2Provider>
      <RadioFoundryMemory archive={{ ...debugArchive, source: 'file-open' }} />
    </DesignSystemV2Provider>,
  );
}

describe('RadioFoundryMemory', () => {
  it('shows category counts from a synthetic archive', () => {
    openMemory();
    expect(categorySelect()).toBeInTheDocument();
    fireEvent.click(categorySelect());
    expect(screen.getByText(/Zones \(\d+\)/)).toBeInTheDocument();
  });

  it('shows channel identity with the shared identityLabel format', async () => {
    openMemory();
    await waitFor(() => expect(screen.getByText('Repeater')).toBeInTheDocument());
  });

  it('lists a parser import note', () => {
    const dual = fmDmrChannel('Dual');
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(
      {
        buildId: 'b',
        formatId: 'radiofoundry',
        profileId: 'radiofoundry-dm32uv',
        buildName: 'x',
        channels: [dual],
        zones: [],
        scanLists: [],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
        ownDigitalIds: [{ ...newOwnDigitalId('p', 'dmr', 'MM0AAA', 2_340_001), isDefault: true }],
      },
      { expandModes: false },
    );
    expect(warnings.length).toBeGreaterThan(0);
    const proj = projectRadioFoundryMemory(archiveFromRadioFoundryImage(bytes));
    expect(proj.status).toBe('ok');
    if (proj.status !== 'ok') return;
    const lines = [...proj.result.warnings, ...warnings.map((w) => formatExportWarning(w))];
    render(
      <DesignSystemV2Provider>
        <RadioFoundryImportNotesPanel warnings={lines} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/more than one mode/i)).toBeInTheDocument();
  });

  it('shows the not-decoded reason', () => {
    const parts = radioFoundryMemoryFixtureArchive();
    const flash = parts.regions['flash-image']!.subarray(0, 512);
    const manifest = {
      ...parts.manifest,
      regions: parts.manifest.regions.map((r) =>
        r.id === 'flash-image' ? { ...r, byteLength: flash.length } : r,
      ),
    };
    render(
      <DesignSystemV2Provider>
        <RadioFoundryMemory
          archive={{
            manifest,
            regions: { ...parts.regions, 'flash-image': flash },
            sidecars: {},
            source: 'file-open',
          }}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/at least/i)).toBeInTheDocument();
  });
});
