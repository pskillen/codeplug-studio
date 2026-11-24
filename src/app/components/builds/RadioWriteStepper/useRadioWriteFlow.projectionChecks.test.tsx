import { act, render, renderHook, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioDescriptor, RadioWriteRefusal } from '@integrations/radio-io/types.ts';
import {
  grantRadioSerialPortForEgress,
  prepareRadioWriteImage,
} from '../../../services/radioIoSession.ts';
import { WhatToWriteBody, WhatToWriteFooter } from './steps/WhatToWriteStep.tsx';
import { demoStepperConfig } from './stepperDemo.ts';
import type { WriteFlowActions, WriteFlowView } from './types.ts';
import { useRadioWriteFlow } from './useRadioWriteFlow.tsx';

const emptyLibrary: LibrarySlice = {
  channels: [],
  zones: [],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};

const sampleChannels: RadioChannelDto[] = [
  {
    slotIndex: 2,
    empty: false,
    wireName: 'Air1',
    rxHz: 118_000_000,
    txHz: 118_000_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    mode: 'analog',
  },
];

const refusalMessages: RadioWriteRefusal[] = [
  {
    message:
      'AT-D890UV channel 2: RX 118000000 Hz is AM airband (108–137 MHz) — airband belongs in the separate AmAir bank, not MR channel slots',
    retry: 'none',
    channelIndex: 2,
  },
  {
    message:
      'AT-D890UV channel 5: RX 121500000 Hz is AM airband (108–137 MHz) — airband belongs in the separate AmAir bank, not MR channel slots',
    retry: 'none',
    channelIndex: 5,
  },
];

vi.mock('../../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => emptyLibrary),
}));

vi.mock('../../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
    countDigitalIdDirectoryEntries: vi.fn(async () => 0),
  },
}));

const build = { id: 'b1', revision: 1 } as RadioBuild;
const egress = {
  id: 'e1',
  profileId: 'radio-io-at-d890uv',
  formatId: 'radio-io',
} as EgressPath;

function descriptorWithRefusals(refusals: readonly RadioWriteRefusal[]): RadioDescriptor {
  return {
    label: 'Anytone AT-D890UV',
    modelIds: ['AT-D890UV'],
    supportsBle: false,
    protocolFactory: () => {
      throw new Error('not used');
    },
    capabilities: {
      maxChannels: 1000,
      supportsZones: true,
      supportsScanLists: true,
      analogOnly: false,
      supportsBle: false,
      supportsBulkRead: true,
    },
    attributionIds: [],
    compatibleProfiles: [],
    writeStrategy: 'selective-ranges',
    baudRate: 921_600,
    hydration: {
      extractHydration: () => {
        throw new Error('not used');
      },
      mergeChannelsIntoHydration: () => {
        throw new Error('not used');
      },
    },
    checkWriteProjection: () => refusals,
  };
}

const descriptorNoHook: RadioDescriptor = {
  label: 'Test radio',
  modelIds: ['TEST'],
  supportsBle: false,
  protocolFactory: () => {
    throw new Error('not used');
  },
  capabilities: {
    maxChannels: 100,
    supportsZones: false,
    supportsScanLists: false,
    analogOnly: true,
    supportsBle: false,
    supportsBulkRead: false,
  },
  attributionIds: [],
  compatibleProfiles: [],
  writeStrategy: 'full-image',
  baudRate: 57600,
  hydration: {
    extractHydration: () => {
      throw new Error('not used');
    },
    mergeChannelsIntoHydration: () => {
      throw new Error('not used');
    },
  },
};

vi.mock('../../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/radioIoSession.ts')>();
  return {
    ...actual,
    grantRadioSerialPortForEgress: vi.fn(async () => ({
      transport: 'web' as const,
      port: {} as SerialPort,
    })),
    openRadioSessionForEgress: vi.fn(),
    closeRadioSession: vi.fn(),
    prepareRadioWriteImage: vi.fn(async () => ({
      image: undefined,
      warnings: [],
      organisation: {},
      channels: sampleChannels,
    })),
    uploadPreparedRadioWrite: vi.fn(),
    verifyRadioWrite: vi.fn(),
  };
});

function mount(descriptor: RadioDescriptor) {
  return renderHook(() =>
    useRadioWriteFlow({
      build,
      egress,
      descriptor,
      activeProjectId: 'p1',
    }),
  );
}

function renderStep1(view: WriteFlowView, actions: WriteFlowActions) {
  const config = demoStepperConfig();
  return render(
    <MemoryRouter>
      <MantineProvider>
        <WhatToWriteBody config={config} view={view} actions={actions} />
        <WhatToWriteFooter config={config} view={view} actions={actions} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('useRadioWriteFlow projection checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a projection refusal is listed on step 1 and Read & write is disabled', async () => {
    const { result } = mount(descriptorWithRefusals(refusalMessages));
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(result.current.view.buildChecks.refusals).toHaveLength(2);
    renderStep1(result.current.view, result.current.actions);
    expect(screen.getByTestId('write-projection-refusals')).toBeInTheDocument();
    expect(screen.getByText(/Fix these channels in the build/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Read & write/i })).toBeDisabled();
  });

  it('no port is requested while refusals exist', async () => {
    const { result } = mount(descriptorWithRefusals(refusalMessages));
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.actions.onConnectAndRead();
    });
    expect(vi.mocked(grantRadioSerialPortForEgress)).not.toHaveBeenCalled();
  });

  it('keps alone drops the codeplug warnings from the first prepare', async () => {
    const channelWarning: ExportWarning = {
      kind: 'general',
      severity: 'problem',
      message: 'Skipping 1 channel(s) with unsupported mode(s): Air1',
    };
    vi.mocked(prepareRadioWriteImage).mockResolvedValue({
      image: undefined,
      warnings: [channelWarning],
      contactWarnings: [],
      organisation: {},
      channels: sampleChannels,
    });
    const { build: kepsBuild, egress: kepsEgress } = newRadioBuildForProfile(
      'p1',
      'radio-io-at-d890uv',
      'Keps clears codeplug warnings',
    );
    const { result } = renderHook(() =>
      useRadioWriteFlow({
        build: kepsBuild,
        egress: kepsEgress,
        descriptor: descriptorNoHook,
        activeProjectId: 'p1',
      }),
    );
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(result.current.view.buildChecks.warnings).toContainEqual(channelWarning);
    act(() => {
      result.current.actions.onPartsChange({
        codeplug: false,
        contacts: false,
        settings: false,
        keps: true,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      result.current.view.buildChecks.warnings.some(
        (w) => w.kind === 'general' && w.message.includes('unsupported mode'),
      ),
    ).toBe(false);
  });

  it('a radio without the hook has no refusals', async () => {
    const { result } = mount(descriptorNoHook);
    act(() =>
      result.current.open({ codeplug: true, contacts: false, settings: false, keps: false }),
    );
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(result.current.view.buildChecks.status).toBe('ready');
    expect(result.current.view.buildChecks.refusals).toEqual([]);
    expect(vi.mocked(prepareRadioWriteImage)).toHaveBeenCalled();
  });
});
