import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  dualBankOptionsFromWriteSource,
  singleBankProjectionFromWriteSource,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';
import * as radioIoSession from '../../services/radioIoSession.ts';
import { persistence } from '../../state/persistence.ts';

vi.mock('../../lib/loadLibrarySlice.ts', () => ({
  loadLibrarySlice: vi.fn(async () => ({
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  })),
}));

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    getRadioSerialUnsupportedMessage: () => 'Web Serial not supported.',
    openRadioSessionForEgress: vi.fn(() => new Promise(() => {})),
    closeRadioSession: vi.fn(async () => {}),
  };
});

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const kepsWrite = vi.hoisted(() => vi.fn());

vi.mock('../../services/satelliteKepsWriteAdapters.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/satelliteKepsWriteAdapters.ts')>();
  return {
    ...actual,
    hasSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600',
    getSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600'
        ? kepsWrite
        : undefined,
  };
});

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'project-1', activeProject: { name: 'Demo' } }),
}));

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => []),
    countDigitalIdDirectoryEntries: vi.fn(async () => 0),
    subscribe: vi.fn(() => () => {}),
    putRadioBuild: vi.fn(async () => ({ ok: true })),
  },
}));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderPanel(profileId: string) {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profileId);
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  const result = render(
    <MemoryRouter>
      <BuildLayoutProvider value={layoutValue}>
        <DesignSystemV2Provider>
          <BuildRadioIoPanel build={build} egress={egress} />
          <LocationProbe />
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
  return { ...result, build };
}

const port = {
  readable: null,
  writable: null,
  open: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

function openStepper(profileId: string) {
  const rendered = renderPanel(profileId);
  fireEvent.click(screen.getByRole('button', { name: 'Write radio…' }));
  return rendered;
}

describe('BuildRadioIoPanel — Write stepper, step 1 (#1393)', () => {
  it('opens the stepper at "What to write" with keps offered for D890', async () => {
    openStepper('radio-io-at-d890uv');
    expect(await screen.findByRole('button', { name: 'Connect & read' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Codeplug' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Digital contacts' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    // Radio settings is offered on the AT-D890, unticked and disabled until a change is set.
    const settings = screen.getByRole('checkbox', { name: 'Radio settings' });
    expect(settings).not.toBeChecked();
    expect(settings).toBeDisabled();
    expect(screen.getByText('Set up…')).toBeInTheDocument();
  });

  it('does not offer Radio settings on a radio without a settings page', async () => {
    openStepper('radio-io-dm32uv');
    await screen.findByRole('button', { name: 'Connect & read' });
    expect(screen.queryByRole('checkbox', { name: 'Radio settings' })).toBeNull();
  });

  it('does not show keps or contacts for a profile with no adapter', async () => {
    openStepper('radio-io-uv5r-mini');
    await screen.findByRole('button', { name: 'Connect & read' });
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Digital contacts' })).toBeNull();
  });

  it('shows contacts and keps rows for OpenGD77 MD-9600, unticked', async () => {
    openStepper('radio-io-opengd77-md9600');
    expect(await screen.findByRole('checkbox', { name: 'Digital contacts' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
  });

  it('hides TG step keys on the stock AT-D890 popup', async () => {
    openStepper('radio-io-at-d890uv');
    await screen.findByRole('button', { name: 'Connect & read' });
    expect(screen.queryByRole('switch', { name: /Assign TG previous and TG next/ })).toBeNull();
  });

  it('has no step-key switch on the MM9PDY AT-D890: Review offers a nudge instead', async () => {
    openStepper('radio-io-at-d890uv-mm9pdy');
    await screen.findByRole('button', { name: 'Connect & read' });
    expect(screen.queryByRole('switch', { name: /Assign TG previous and TG next/ })).toBeNull();
  });

  it('keeps the MM9PDY step-key switch under the Codeplug part on the DM-32 and saves it on the build', async () => {
    openStepper('radio-io-dm32uv-mm9pdy');
    const toggle = await screen.findByRole('switch', { name: /Assign TG previous and TG next/ });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(persistence.putRadioBuild).toHaveBeenCalled();
    });
    const saved = vi.mocked(persistence.putRadioBuild).mock.calls.at(-1)?.[0];
    expect(saved?.exportSettings?.assignMm9pdyStepKeys).toBe(true);
  });

  it('warns when ID directory is selected and it is empty', async () => {
    openStepper('radio-io-opengd77-1701');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Digital contacts' }));
    fireEvent.click(screen.getByRole('button', { name: 'ID directory' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
    expect(await screen.findByText('ID directory is empty')).toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — Write stepper flow (#1393)', () => {
  const identity = { model: 'Test radio', serial: 'SN123456' };
  let upload: ReturnType<typeof vi.spyOn>;
  let prepare: ReturnType<typeof vi.spyOn>;
  let grant: ReturnType<typeof vi.spyOn>;
  let hookRan: boolean;
  let uploaded: number;

  function fakeSession(label: string) {
    return {
      descriptor: { label, modelIds: [label] },
      pipe: { close: vi.fn(async () => undefined) },
      radio: {},
    } as never;
  }

  beforeEach(() => {
    hookRan = false;
    uploaded = 0;
    kepsWrite.mockReset();
    kepsWrite.mockResolvedValue({ written: 3, skipped: [], skippedTransmitters: [] });
    vi.mocked(radioIoSession.closeRadioSession).mockClear();
    vi.mocked(radioIoSession.openRadioSessionForEgress).mockClear();
    vi.mocked(persistence.countDigitalIdDirectoryEntries).mockResolvedValue(100);
    grant = vi
      .spyOn(radioIoSession, 'grantRadioSerialPortForEgress')
      .mockResolvedValue({ transport: 'web', port });
    prepare = vi.spyOn(radioIoSession, 'prepareRadioWriteImage').mockResolvedValue({
      warnings: [],
      organisation: {},
      channels: [{}, {}, {}] as never,
    });
    vi.spyOn(radioIoSession, 'openRadioSessionForEgress').mockImplementation(async () => ({
      session: fakeSession('Test radio'),
      descriptor: { modelIds: ['x'] } as never,
    }));
    upload = vi
      .spyOn(radioIoSession, 'uploadPreparedRadioWrite')
      .mockImplementation(async (_s, _e, _i, opts) => {
        await opts?.beforeTransmit?.({
          identity,
          channelCount: 3,
          plan: [{ label: 'Upload', weight: 4000 }],
          identityOnly: false,
        });
        hookRan = true;
        uploaded += 1;
        return {};
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function connect() {
    fireEvent.click(await screen.findByRole('button', { name: 'Connect & read' }));
  }

  it('grants the port before prepare and opens a write session with it (#1247)', async () => {
    openStepper('radio-io-opengd77-1701');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(grant.mock.invocationCallOrder[0]!).toBeLessThan(prepare.mock.invocationCallOrder[0]!);
    expect(radioIoSession.openRadioSessionForEgress).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ grantedPort: { transport: 'web', port }, purpose: 'write' }),
    );
  });

  it('always shows Review with the identity (full serial) and the channel count', async () => {
    openStepper('radio-io-at-d890uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.getByText('3 channels will be written.')).toBeInTheDocument();
    expect(screen.getByText(/SN123456/)).toBeInTheDocument();
  });

  it('maps codeplug only to the codeplug mode with no contact source (D890 single bank)', async () => {
    openStepper('radio-io-at-d890uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    const opts = prepare.mock.calls[0]![3] as {
      singleBank: { mode: string; projectionMode: string };
    };
    expect(opts.singleBank.mode).toBe('codeplug');
    expect(opts.singleBank.projectionMode).toBe(singleBankProjectionFromWriteSource('none'));
  });

  it('maps codeplug + contacts to the codeplug mode with that contact source (DM-32)', async () => {
    openStepper('radio-io-dm32uv');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Digital contacts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug + contacts' });
    const opts = prepare.mock.calls[0]![3] as {
      dualBank: { mode: string; options: unknown };
    };
    expect(opts.dualBank.mode).toBe('codeplug');
    expect(opts.dualBank.options).toEqual(dualBankOptionsFromWriteSource('both'));
  });

  it('maps contacts only to the contacts mode (OpenGD77)', async () => {
    openStepper('radio-io-opengd77-1701');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Codeplug' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Digital contacts' }));
    await connect();
    await screen.findByRole('button', { name: 'Write contacts' });
    const opts = prepare.mock.calls[0]![3] as { dualBank: { mode: string } };
    expect(opts.dualBank.mode).toBe('digitalIdList');
  });

  it('Cancel on Review sends nothing and closes the session', async () => {
    openStepper('radio-io-at-d890uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(radioIoSession.closeRadioSession).toHaveBeenCalled());
    expect(hookRan).toBe(false);
    expect(uploaded).toBe(0);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Write codeplug' })).toBeNull(),
    );
  });

  it('writes, then shows Done with what was written; Write another keeps the ticks', async () => {
    openStepper('radio-io-at-d890uv');
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug' }));
    expect(await screen.findByText('Codeplug written (3 channels).')).toBeInTheDocument();
    expect(uploaded).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Write another radio' }));
    await screen.findByRole('button', { name: 'Write codeplug' });
    // A second port prompt, same ticks.
    expect(grant).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it('D890 keps in the same session: keps write runs before the session closes', async () => {
    openStepper('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    expect(await screen.findByText(/Satellite keps written/)).toBeInTheDocument();
    expect(kepsWrite).toHaveBeenCalledTimes(1);
    const session = kepsWrite.mock.calls[0]![0];
    expect(session.descriptor.label).toBe('Test radio');
    expect(kepsWrite.mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(radioIoSession.closeRadioSession).mock.invocationCallOrder[0]!,
    );
    // No restart step between.
    expect(screen.queryByTestId('write-stepper-restart-wait')).toBeNull();
  });

  it('OpenGD77 keps need a new session: restart step, then Write keps', async () => {
    openStepper('radio-io-opengd77-1701');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    expect(await screen.findByTestId('write-stepper-restart-wait')).toBeInTheDocument();
    expect(kepsWrite).not.toHaveBeenCalled();
    // The radio is back after its restart.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 25_000);
    const writeKeps = await screen.findByRole('button', { name: 'Write keps' });
    await waitFor(() => expect(writeKeps).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(writeKeps);
    expect(await screen.findByText(/Satellite keps written/)).toBeInTheDocument();
    expect(kepsWrite).toHaveBeenCalledTimes(1);
  });

  it('D890 keps failing after the upload: says the codeplug was written, keps were not, offers Check write (F2)', async () => {
    kepsWrite.mockRejectedValue(new Error('Satellite unit busy'));
    vi.mocked(radioIoSession.uploadPreparedRadioWrite).mockImplementation(
      async (_s, _e, _i, opts) => {
        await opts?.beforeTransmit?.({
          identity,
          channelCount: 3,
          plan: [{ label: 'Upload', weight: 4000 }],
          identityOnly: false,
        });
        return { writeVerifyPending: { staging: { capturedAt: 'x', chunks: [] } } as never };
      },
    );
    openStepper('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    const failure = await screen.findByTestId('write-stepper-keps-failure');
    expect(failure).toHaveTextContent('The codeplug is on the radio');
    expect(failure).toHaveTextContent('Satellite unit busy');
    // The session still closed (END commits the codeplug) and the check is offered.
    expect(radioIoSession.closeRadioSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Check write' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip and finish' }));
    expect(await screen.findByText('Codeplug written (3 channels).')).toBeInTheDocument();
    expect(
      screen.getByText(/Satellite keps were not written: Satellite unit busy/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Satellite keps written/)).toBeNull();
  });

  it('D890 keps aborted after the upload: Done says keps were cancelled, codeplug written (F2)', async () => {
    kepsWrite.mockImplementation(
      (_s: unknown, _sats: unknown, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => reject(new Error('The write was aborted')));
        }),
    );
    openStepper('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    await waitFor(() => expect(kepsWrite).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Codeplug written (3 channels).')).toBeInTheDocument();
    expect(screen.getByText(/Satellite keps were not written: cancelled/)).toBeInTheDocument();
  });

  it('Cancel on Review tells a restarting radio (D890) that it restarts, and others that nothing changes (F3)', async () => {
    const d890 = openStepper('radio-io-at-d890uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(
      screen.getByText(/Cancel writes nothing, but the radio restarts \(about 20 s\)/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Write codeplug' })).toBeNull(),
    );
    d890.unmount();
    openStepper('radio-io-dm32uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.getByText(/Cancel leaves the radio as it is/)).toBeInTheDocument();
    expect(screen.queryByText(/radio restarts/)).toBeNull();
  });

  it('OpenGD77: finishing without the pending keps says they were not written (F4)', async () => {
    openStepper('radio-io-opengd77-1701');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    await screen.findByTestId('write-stepper-restart-wait');
    fireEvent.click(screen.getByRole('button', { name: 'Finish without keps' }));
    expect(await screen.findByText('Satellite keps: not written.')).toBeInTheDocument();
    expect(screen.getByText(/satellite keps not written/)).toBeInTheDocument();
    expect(kepsWrite).not.toHaveBeenCalled();
  });

  it('OpenGD77: Check write then Write keps keeps the check report on Done (F5)', async () => {
    vi.mocked(radioIoSession.uploadPreparedRadioWrite).mockImplementation(
      async (_s, _e, _i, opts) => {
        await opts?.beforeTransmit?.({
          identity,
          channelCount: 3,
          plan: [{ label: 'Upload', weight: 4000 }],
          identityOnly: false,
        });
        return { writeVerifyPending: { staging: { capturedAt: 'x', chunks: [] } } as never };
      },
    );
    vi.spyOn(radioIoSession, 'verifyRadioWrite').mockResolvedValue({
      ok: true,
      staging: { totalChunks: 1, mismatchedChunks: 0 },
      regions: [],
    } as never);
    openStepper('radio-io-opengd77-1701');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + keps' }));
    await screen.findByTestId('write-stepper-restart-wait');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 25_000);
    const check = await screen.findByRole('button', { name: 'Check write' });
    await waitFor(() => expect(check).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(check);
    const writeKeps = await screen.findByRole('button', { name: 'Write keps' });
    await waitFor(() => expect(writeKeps).toBeEnabled());
    fireEvent.click(writeKeps);
    expect(await screen.findByText(/Satellite keps written/)).toBeInTheDocument();
    expect(screen.getByText(/Check write: passed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View check report' })).toBeInTheDocument();
  });

  it('keps only: connects, reviews, then writes keps without an upload', async () => {
    openStepper('radio-io-at-d890uv');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Satellite keps' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Codeplug' }));
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Write keps' }));
    expect(await screen.findByText(/Satellite keps written/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(kepsWrite).toHaveBeenCalledTimes(1);
  });

  it('reconnects and re-reads when Review was open past the radio hold time', async () => {
    openStepper('radio-io-opengd77-1701');
    await connect();
    const write = await screen.findByRole('button', { name: 'Write codeplug' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);
    fireEvent.click(write);
    expect(await screen.findByText('Codeplug written (3 channels).')).toBeInTheDocument();
    // First pass reached Review and was refused; the second pass read again and wrote.
    expect(radioIoSession.uploadPreparedRadioWrite).toHaveBeenCalledTimes(2);
    expect(uploaded).toBe(1);
    expect(radioIoSession.openRadioSessionForEgress).toHaveBeenCalledTimes(2);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('never reconnects the D890 however long Review stays open', async () => {
    openStepper('radio-io-at-d890uv');
    await connect();
    const write = await screen.findByRole('button', { name: 'Write codeplug' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 3_600_000);
    fireEvent.click(write);
    expect(await screen.findByText('Codeplug written (3 channels).')).toBeInTheDocument();
    expect(radioIoSession.uploadPreparedRadioWrite).toHaveBeenCalledTimes(1);
  });

  it('offers Reconnect and read again when the read fails before any frame', async () => {
    upload.mockRejectedValueOnce(new Error('No reply from the radio'));
    openStepper('radio-io-at-d890uv');
    await connect();
    expect(await screen.findByText('No reply from the radio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect and read again' }));
    await screen.findByRole('button', { name: 'Write codeplug' });
  });

  it('does not show a serial-confirm modal on AT-D890 Write (#1276)', async () => {
    const identitySpy = vi.spyOn(radioIoSession, 'readAtD890ConnectedRadioIdentity');
    openStepper('radio-io-at-d890uv');
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByText('Confirm connected radio')).not.toBeInTheDocument();
    expect(identitySpy).not.toHaveBeenCalled();
  });
});

describe('BuildRadioIoPanel — legacy stash migration warning (#879)', () => {
  it('does not show the severe warning for RT95 after drop-stash', () => {
    renderPanel('radio-io-rt95');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for DM-32UV after drop-stash', () => {
    renderPanel('radio-io-dm32uv');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for UV-5R Mini after drop-stash', () => {
    renderPanel('radio-io-uv5r-mini');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for OpenGD77 DM-1701 after drop-stash', () => {
    renderPanel('radio-io-opengd77-1701');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });

  it('does not show the severe warning for OpenGD77 MD-9600 after drop-stash', () => {
    renderPanel('radio-io-opengd77-md9600');
    expect(screen.queryByText('Write path not migrated')).not.toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — no write-panel Read stash (#878)', () => {
  it('does not offer Read from radio on Export', () => {
    renderPanel('radio-io-uv5r-mini');
    expect(screen.queryByRole('button', { name: /Read from radio/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Write requires a prior Read on this egress/i),
    ).not.toBeInTheDocument();
  });
});

describe('BuildRadioIoPanel — Danger zone card (#1369)', () => {
  it('is the last card on the D890 panel, collapsed, and opens the area', () => {
    const { container, build } = renderPanel('radio-io-at-d890uv');
    const card = screen.getByRole('region', { name: 'Danger zone' });
    expect(card).toHaveTextContent('Danger zone · Changes the radio itself');
    expect(screen.queryByRole('button', { name: 'Open danger zone' })).toBeNull();
    const cards = Array.from(container.querySelectorAll('section'));
    expect(cards[cards.length - 1]).toBe(card);
    fireEvent.click(screen.getByRole('button', { name: /Danger zone/ }));
    expect(
      screen.getByText(
        'Rare jobs that change the radio, not your codeplug. Each one backs up first.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open danger zone' })).toBeInTheDocument();
    expect(build.id).toBeTruthy();
  });

  it('has a disclosure toggle wired to the revealed block, with a decorative chevron', () => {
    renderPanel('radio-io-at-d890uv');
    const toggle = screen.getByRole('button', { name: /Danger zone/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.querySelector('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(controlled).toContainElement(screen.getByRole('button', { name: 'Open danger zone' }));
  });

  it("Open danger zone navigates to the build's Danger zone route", () => {
    const { build } = renderPanel('radio-io-at-d890uv');
    fireEvent.click(screen.getByRole('button', { name: /Danger zone/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open danger zone' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/builds/${build.id}/export/danger-zone`,
    );
  });

  it('is hidden in the native app (Capacitor) on both D890 targets', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    try {
      for (const profile of ['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy']) {
        const { unmount } = renderPanel(profile);
        expect(screen.queryByRole('region', { name: 'Danger zone' })).toBeNull();
        unmount();
      }
    } finally {
      vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
    }
  });

  it('is present on the MM9PDY D890 panel', () => {
    renderPanel('radio-io-at-d890uv-mm9pdy');
    expect(screen.getByRole('region', { name: 'Danger zone' })).toBeInTheDocument();
  });

  it('is absent for DM-32 and OpenGD77', () => {
    for (const profile of ['radio-io-dm32uv', 'radio-io-opengd77-1701']) {
      const { unmount } = renderPanel(profile);
      expect(screen.queryByRole('region', { name: 'Danger zone' })).toBeNull();
      unmount();
    }
  });
});
