/**
 * AT-D890 Review step and Radio settings part through the real stepper (#1393, PR 4c). The serial
 * edge is faked the way BuildRadioIoPanel.test.tsx fakes it: the session service is spied, the
 * stepper, its flow and the Review sections are real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { decodeAtD890RadioSettings } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { localInfoWithSerial } from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';
import * as radioIoSession from '../../services/radioIoSession.ts';
import * as settingsWrite from '../../services/radioIoAtD890SettingsWrite.ts';
import {
  clearAllOverrides,
  getAtD890RadioSettingsSession,
  setApplyToEveryRadio,
  setOverride,
  setRead,
  setStepperTicks,
  type AtD890RadioSettingsRead,
} from '../../state/atD890RadioSettingsSession.ts';

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

vi.mock('../../services/radioIoAtD890SettingsWrite.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/radioIoAtD890SettingsWrite.ts')>();
  return { ...actual, writeAtD890SettingsOnly: vi.fn() };
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

const port = {
  readable: null,
  writable: null,
  open: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
};

const SERIAL = 'SN-TEST-REVIEW01';
const OTHER_SERIAL = 'SN-TEST-REVIEW02';

function snapshot(bandCode = 3, serial = SERIAL) {
  return {
    localInfo: localInfoWithSerial(serial),
    main: new Uint8Array(0x200),
    ext: new Uint8Array(0x60),
    masterId: new Uint8Array(0x40),
    bandCode,
  };
}

function atD890Ctx(opts?: {
  serial?: string;
  bandCode?: number;
  cache?: boolean;
  target?: 'stock' | 'mm9pdy';
}) {
  const snap = snapshot(opts?.bandCode, opts?.serial);
  return {
    serial: opts?.serial ?? SERIAL,
    masterIdName: 'MM9PDY-2',
    snapshot: snap,
    overrides: [],
    target: opts?.target ?? ('stock' as const),
    ...(opts?.cache === false ? {} : { downloadCache: { blocks: new Map() } }),
  };
}

function channel(slotIndex: number, txMhz: number): RadioChannelDto {
  return {
    slotIndex,
    empty: false,
    wireName: `Ch${slotIndex}`,
    rxHz: txMhz * 1e6,
    txHz: txMhz * 1e6,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: null,
    bandwidth: 'FM',
  };
}

function readOf(serial: string): AtD890RadioSettingsRead {
  return {
    serial,
    masterIdName: 'MM9PDY-1',
    readAt: 1,
    bandCode: 3,
    languageLock: 0,
    decoded: {},
  };
}

/** A value the radio does not hold for keyTone, so the override is a real change. */
function keyToneOpposite(): boolean {
  const current = decodeAtD890RadioSettings(snapshot(), 'stock').keyTone?.value;
  return !(current === true);
}

function renderPanel(profileId = 'radio-io-at-d890uv') {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profileId);
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/export`]}>
      <BuildLayoutProvider value={layoutValue}>
        <DesignSystemV2Provider>
          <Routes>
            <Route
              path="/builds/:id/export"
              element={<BuildRadioIoPanel build={build} egress={egress} />}
            />
            <Route
              path="/builds/:id/export/radio-settings"
              element={<div data-testid="settings-page" />}
            />
          </Routes>
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
  return build;
}

describe('AT-D890 Review and the Radio settings part (#1393)', () => {
  let results: unknown[];
  let writeFrames: number;
  let channels: RadioChannelDto[];
  let ctxFactory: () => ReturnType<typeof atD890Ctx>;

  beforeEach(() => {
    results = [];
    writeFrames = 0;
    channels = [channel(1, 145.5), channel(2, 446.0)];
    ctxFactory = () => atD890Ctx();
    vi.mocked(radioIoSession.closeRadioSession).mockClear();
    vi.spyOn(radioIoSession, 'grantRadioSerialPortForEgress').mockResolvedValue({
      transport: 'web',
      port,
    });
    vi.spyOn(radioIoSession, 'prepareRadioWriteImage').mockImplementation(
      async () =>
        ({
          warnings: [],
          organisation: {},
          channels,
        }) as never,
    );
    vi.spyOn(radioIoSession, 'openRadioSessionForEgress').mockImplementation(async () => ({
      session: {
        descriptor: { label: 'Anytone AT-D890UV', modelIds: ['x'] },
        pipe: { close: vi.fn(async () => undefined) },
        radio: {},
      } as never,
      descriptor: { modelIds: ['x'] } as never,
    }));
    vi.spyOn(radioIoSession, 'uploadPreparedRadioWrite').mockImplementation(
      async (_s, _e, _i, opts) => {
        const result = await opts?.beforeTransmit?.({
          identity: { model: 'Anytone AT-D890UV', serial: ctxFactory().serial },
          channelCount: channels.length,
          plan: [{ label: 'Upload', weight: 4000 }],
          identityOnly: false,
          atD890: ctxFactory(),
        });
        results.push(result);
        writeFrames += 1;
        return {};
      },
    );
    vi.mocked(settingsWrite.writeAtD890SettingsOnly).mockImplementation(
      async (_s, _e, overrides, opts) => {
        const result = await opts?.beforeTransmit?.({
          ...ctxFactory(),
          overrides,
          downloadCache: undefined,
        });
        results.push(result);
        if (result === 'keep' || result === 'cancel') {
          throw new radioIoSession.RadioWriteCancelledError();
        }
        writeFrames += 1;
        return {};
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openStepper() {
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    await screen.findByRole('button', { name: 'Connect & read' });
  }

  async function connect() {
    await openStepper();
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
  }

  it('shows This radio with the range, and lists exactly the receive-only channels (code 3)', async () => {
    renderPanel();
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.getByText('Frequency range')).toBeInTheDocument();
    expect(
      screen.getByText('Amateur Europe (code 3) · TX 430–440, 144–146 MHz'),
    ).toBeInTheDocument();
    expect(screen.getByText('MM9PDY-2')).toBeInTheDocument();
    expect(screen.getByText(SERIAL)).toBeInTheDocument();
    const note = screen.getByTestId('d890-receive-only');
    expect(note).toHaveTextContent('1 channel is receive-only on this radio');
    expect(note).toHaveTextContent('Amateur Europe');
    fireEvent.click(screen.getByText('Show the channels'));
    expect(screen.getByText(/2 Ch2 · TX 446\.00000 MHz/)).toBeInTheDocument();
    expect(screen.queryByText(/1 Ch1/)).toBeNull();
    // They are written anyway.
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug' }));
    await waitFor(() => expect(writeFrames).toBe(1));
  });

  it('shows no receive-only warning when every channel can transmit', async () => {
    channels = [channel(1, 145.5)];
    renderPanel();
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByTestId('d890-receive-only')).toBeNull();
  });

  it('writes no settings when Radio settings is unticked, even with changes set', async () => {
    const build = renderPanel();
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await openStepper();
    // Ticked by default because there are changes; untick it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Radio settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByTestId('d890-settings-review')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug' }));
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toBe('keep');
    clearAllOverrides(build.id);
  });

  it('a different radio: Keep is preselected and sends no settings; Apply sends them', async () => {
    const build = renderPanel();
    setRead(build.id, readOf(SERIAL));
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL });
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.getByText(/This isn't the radio you read settings from/)).toBeInTheDocument();
    expect(screen.getByText(/1 change on this radio/)).toBeInTheDocument();
    const keep = screen.getByRole('button', { name: 'Keep its settings' });
    expect(keep).toHaveAttribute('aria-pressed', 'true');
    // The button names what will be written: with Keep, no settings.
    expect(screen.queryByRole('button', { name: 'Write codeplug + settings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug' }));
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toBe('keep');
    clearAllOverrides(build.id);
  });

  it('Apply on another radio puts settings back in the button label and the write', async () => {
    const build = renderPanel();
    setRead(build.id, readOf(SERIAL));
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL });
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + settings' }));
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toMatchObject({ decision: 'apply' });
    clearAllOverrides(build.id);
  });

  it('the step-key nudge on another radio implies Apply: label and write agree', async () => {
    const build = renderPanel('radio-io-at-d890uv-mm9pdy');
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL, target: 'mm9pdy' });
    setRead(build.id, readOf(SERIAL));
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    fireEvent.click(screen.getByRole('button', { name: 'Use MM9PDY step keys' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write codeplug + settings' }));
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toMatchObject({ decision: 'apply' });
    clearAllOverrides(build.id);
  });

  it('the same radio as the read: no choice shown, the patches are applied', async () => {
    const build = renderPanel();
    setRead(build.id, readOf(SERIAL));
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug + settings' });
    expect(screen.queryByTestId('d890-settings-choice')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug + settings' }));
    await waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toEqual({
      decision: 'apply',
      overrides: [{ fieldId: 'keyTone', value: keyToneOpposite() }],
    });
    clearAllOverrides(build.id);
  });

  it("with 'don't ask again' set, Apply is preselected for another radio and says so", async () => {
    const build = renderPanel();
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL });
    setApplyToEveryRadio(build.id, true);
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug + settings' });
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/chose not to be asked again/)).toBeInTheDocument();
    setApplyToEveryRadio(build.id, false);
    clearAllOverrides(build.id);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('Review its settings sends no frame, stores this radio’s values, opens the page and closes the session', async () => {
    const build = renderPanel();
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL });
    setOverride(build.id, 'keyTone', keyToneOpposite());
    const before = [...getAtD890RadioSettingsSession(build.id).overrides];
    await connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Review its settings' }));
    expect(await screen.findByTestId('settings-page')).toBeInTheDocument();
    expect(writeFrames).toBe(0);
    const state = getAtD890RadioSettingsSession(build.id);
    expect(state.read?.serial).toBe(OTHER_SERIAL);
    expect([...state.overrides]).toEqual(before);
    expect(radioIoSession.closeRadioSession).toHaveBeenCalled();
    clearAllOverrides(build.id);
  });

  it('settings alone goes through the settings-only Write, not the codeplug upload', async () => {
    const build = renderPanel();
    setRead(build.id, readOf(SERIAL));
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await openStepper();
    // Untick the codeplug: only Radio settings stays ticked.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Codeplug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
    await screen.findByRole('button', { name: 'Write settings' });
    expect(radioIoSession.uploadPreparedRadioWrite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Write settings' }));
    await waitFor(() => expect(settingsWrite.writeAtD890SettingsOnly).toHaveBeenCalledTimes(1));
    expect(results[0]).toMatchObject({ decision: 'apply' });
    clearAllOverrides(build.id);
  });

  it('settings alone on another radio with Keep preselected cannot be written until Apply', async () => {
    const build = renderPanel();
    ctxFactory = () => atD890Ctx({ serial: OTHER_SERIAL });
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await openStepper();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Codeplug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
    // Nothing would be written with Keep, so the button names nothing and is disabled.
    const write = await screen.findByRole('button', { name: 'Write' });
    expect(write).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Write settings' })).toBeEnabled();
    clearAllOverrides(build.id);
  });

  it('the part row is ticked with changes, disabled with Set up… without, and Edit keeps the ticks', async () => {
    const build = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    const box = await screen.findByRole('checkbox', { name: 'Radio settings' });
    expect(box).toBeDisabled();
    expect(box).not.toBeChecked();
    expect(screen.getByText('Set up…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    setOverride(build.id, 'keyTone', keyToneOpposite());
    fireEvent.click(screen.getByRole('button', { name: 'Write radio' }));
    const ticked = await screen.findByRole('checkbox', { name: 'Radio settings' });
    expect(ticked).toBeChecked();
    expect(screen.getByTestId('write-radio-settings-summary')).toHaveTextContent('1 change');
    expect(screen.getByTestId('write-radio-settings-words')).toHaveTextContent('Key tone');
    // Untick the codeplug, then Edit: the ticks come back when the stepper reopens.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Codeplug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByTestId('settings-page')).toBeInTheDocument();
    expect(getAtD890RadioSettingsSession(build.id).stepperTicks).toMatchObject({
      codeplug: false,
      settings: true,
    });
    clearAllOverrides(build.id);
    setStepperTicks(build.id, undefined);
  });

  it('MM9PDY nudge: shown when P1/P2 are not TG next/previous; the button sets the overrides and ticks Radio settings', async () => {
    const build = renderPanel('radio-io-at-d890uv-mm9pdy');
    ctxFactory = () => atD890Ctx({ target: 'mm9pdy' });
    setRead(build.id, readOf(SERIAL));
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByTestId('d890-settings-review')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use MM9PDY step keys' }));
    expect(await screen.findByRole('button', { name: 'Write codeplug + settings' })).toBeEnabled();
    const overrides = getAtD890RadioSettingsSession(build.id).overrides;
    expect(overrides.get('keyShortP1')).toBe(14);
    expect(overrides.get('keyShortP2')).toBe(13);
    expect(screen.queryByTestId('mm9pdy-step-keys-nudge')).toBeNull();
    expect(screen.getByTestId('d890-settings-review')).toHaveTextContent('2 changes');
    fireEvent.click(screen.getByRole('button', { name: 'Write codeplug + settings' }));
    await waitFor(() => expect(results).toHaveLength(1));
    // The nudge adds overrides at the pause, so the result carries them.
    expect(results[0]).toMatchObject({ decision: 'apply' });
    clearAllOverrides(build.id);
  });

  it('shows no nudge on an MM9PDY radio whose keys are already TG next/previous, even with Radio settings ticked', async () => {
    const build = renderPanel('radio-io-at-d890uv-mm9pdy');
    ctxFactory = () => {
      const ctx = atD890Ctx({ target: 'mm9pdy' });
      ctx.snapshot.main[0x13] = 14;
      ctx.snapshot.main[0x14] = 13;
      return ctx;
    };
    setRead(build.id, readOf(SERIAL));
    setOverride(build.id, 'keyTone', keyToneOpposite());
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug + settings' });
    expect(screen.queryByTestId('mm9pdy-step-keys-nudge')).toBeNull();
    clearAllOverrides(build.id);
  });

  it('shows no nudge on the stock target', async () => {
    renderPanel();
    await connect();
    await screen.findByRole('button', { name: 'Write codeplug' });
    expect(screen.queryByTestId('mm9pdy-step-keys-nudge')).toBeNull();
  });
});
