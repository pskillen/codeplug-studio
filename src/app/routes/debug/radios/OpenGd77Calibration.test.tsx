import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { OpenGd77Calibration } from './OpenGd77Calibration.tsx';
import { syntheticOpenGd77Archive, syntheticOpenGd77Calibration } from './opengd77.fixture.ts';

const transport = vi.hoisted(() => ({ open: vi.fn(), request: vi.fn() }));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>()),
  openWebSerialPipe: transport.open,
  requestWebSerialPort: transport.request,
}));

function show(archive?: DebugArchive, overlayArchive?: DebugArchive) {
  const ui = (a?: DebugArchive, o?: DebugArchive) => (
    <MantineProvider>
      <OpenGd77Calibration archive={a} overlayArchive={o} />
    </MantineProvider>
  );
  const view = render(ui(archive, overlayArchive));
  return { ...view, replace: (a?: DebugArchive, o?: DebugArchive) => view.rerender(ui(a, o)) };
}

const row = (id: string) => document.querySelector(`[data-row-id="${id}"]`) as HTMLElement;

/** Same archive without its FirmwareInfo sidecar. */
const withoutIdentity = (a: DebugArchive, modelId: string) =>
  openDebugArchive(packRadioBackupZip(a.manifest, a.regions), modelId);

beforeEach(() => vi.clearAllMocks());

describe.each([
  ['DM-1701', OPENGD77_DM1701_MODEL_ID, 'Very-low power'],
  ['MD-9600', OPENGD77_MD9600_MODEL_ID, 'Mid-low power'],
])('OpenGd77Calibration on %s', (_name, modelId, slotLabel) => {
  it('says No capture without an archive', () => {
    show();
    expect(screen.getByText('No capture')).toBeInTheDocument();
  });

  it('shows the caveats, the basis line and a decoded row with every column', async () => {
    show(await syntheticOpenGd77Archive(modelId, { revision: 'R20260101000000' }));
    expect(screen.getByText(/not stock factory calibration/i, { selector: 'div' })).toBeTruthy();
    expect(screen.getAllByText(/Not validated on hardware/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Layout read from OpenGD77 firmware sources dated 2026-01-30 \(DM-1701 family\) and 2026-01-31 \(MD-9600\)\. This radio reports revision R20260101000000, built 20240101120000, as reported; whether that build uses the same layout is unknown\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Local marker present at 0x1B0/)).toBeInTheDocument();
    const high = within(row('uhf-high-power'));
    expect(high.getByText('0x010')).toBeInTheDocument();
    expect(high.getByText('9')).toBeInTheDocument();
    expect(high.getByText(/^\d\d( \d\d){8}$/)).toBeInTheDocument();
    expect(high.getByText(/^\d+(, \d+){8}$/)).toBeInTheDocument();
    expect(high.getByText('source-declared')).toBeInTheDocument();
    expect(high.getByText('named')).toBeInTheDocument();
    expect(within(row('rx-low-voltage')).getByText('partial')).toBeInTheDocument();
    expect(within(row('uhf-low-slot-power')).getByText(new RegExp(slotLabel))).toBeInTheDocument();
    expect(within(row('uhf-frequency-0')).getByText(/local marker, not a frequency/)).toBeTruthy();
    expect(screen.getByText('Unknown bytes')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/0x000101F0/)).toBeInTheDocument();
  });

  it('shows raw only when the marker is absent', async () => {
    show(
      await syntheticOpenGd77Archive(modelId, {
        calibration: syntheticOpenGd77Calibration(0, false),
      }),
    );
    expect(screen.getByText(/Marker absent: this is not the layout/)).toBeInTheDocument();
    expect(within(row('uhf-high-power')).getByText('Raw only')).toBeInTheDocument();
  });

  it('says not captured for an archive without the region', async () => {
    show(await syntheticOpenGd77Archive(modelId, { calibration: null }));
    expect(screen.getByText('Calibration not captured')).toBeInTheDocument();
    expect(screen.queryByText('Unknown bytes')).not.toBeInTheDocument();
  });

  it('says why it is unavailable without a FirmwareInfo sidecar', async () => {
    const base = await syntheticOpenGd77Archive(modelId);
    show(withoutIdentity(base, modelId));
    expect(screen.getByText('Calibration unavailable')).toBeInTheDocument();
    expect(screen.getByText(/no FirmwareInfo, so the model is not identified/)).toBeInTheDocument();
  });

  it('refreshes everything when the archive is replaced', async () => {
    const view = show(
      await syntheticOpenGd77Archive(modelId, { calibration: syntheticOpenGd77Calibration(0) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    const before = within(row('vox-level-1')).getAllByRole('cell')[3]!.textContent;
    view.replace(
      await syntheticOpenGd77Archive(modelId, { calibration: syntheticOpenGd77Calibration(3) }),
    );
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(within(row('vox-level-1')).getAllByRole('cell')[3]!.textContent).not.toBe(before);
    view.replace(undefined);
    expect(screen.getByText('No capture')).toBeInTheDocument();
  });

  it('renders the live read and its reopened file identically, opening no transport', async () => {
    const live = await syntheticOpenGd77Archive(modelId, { revision: 'R20260202000000' });
    const first = show(live);
    const liveText = first.container.textContent;
    first.unmount();
    const file = { ...openDebugArchive(live.zipBytes, modelId), source: 'file' as const };
    const second = show(file);
    expect(second.container.textContent).toBe(liveText);
    expect(transport.open).not.toHaveBeenCalled();
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('overlays a second read per row: equal or differs, raw always visible', async () => {
    const a = await syntheticOpenGd77Archive(modelId, {
      calibration: syntheticOpenGd77Calibration(0),
    });
    const changed = syntheticOpenGd77Calibration(0);
    changed[0x10] = (changed[0x10]! + 1) % 10;
    const b = await syntheticOpenGd77Archive(modelId, { calibration: changed });
    show(a, b);
    expect(screen.getAllByText('Differs').length).toBeGreaterThan(0);
    expect(within(row('uhf-high-power')).getByText('differs')).toBeInTheDocument();
    expect(within(row('vhf-high-power')).getByText('equal')).toBeInTheDocument();
    expect(within(row('uhf-high-power')).getAllByText(/^\d\d( \d\d){8}$/)).toHaveLength(2);
  });

  it('refuses an overlay from the other model, a different marker state, or an unusable read', async () => {
    const a = await syntheticOpenGd77Archive(modelId);
    const otherModel =
      modelId === OPENGD77_DM1701_MODEL_ID ? OPENGD77_MD9600_MODEL_ID : OPENGD77_DM1701_MODEL_ID;
    const view = show(a, await syntheticOpenGd77Archive(otherModel));
    expect(screen.getByText(/The overlay read is for /)).toBeInTheDocument();
    expect(screen.queryByText('Differs')).not.toBeInTheDocument();
    view.replace(
      a,
      await syntheticOpenGd77Archive(modelId, {
        calibration: syntheticOpenGd77Calibration(0, false),
      }),
    );
    expect(screen.getByText(/different local marker state/)).toBeInTheDocument();
    view.replace(a, withoutIdentity(a, modelId));
    expect(
      screen.getByText(/The overlay read cannot be used: .*no FirmwareInfo/),
    ).toBeInTheDocument();
    view.replace(a, await syntheticOpenGd77Archive(modelId, { calibration: null }));
    expect(
      screen.getByText(/no calibration working copy, so nothing is overlaid/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Differs')).not.toBeInTheDocument();
  });
});
