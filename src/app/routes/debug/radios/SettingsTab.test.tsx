import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import { dm32SettingsView } from '@integrations/radio-io/radios/dm32uv/debugSettingsView.ts';
import type { DebugArchive } from './captureArchive.ts';
import { dm32Capture, dm32Page } from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { SettingsTab } from './SettingsTab.tsx';

afterEach(cleanup);

function showSettings(archive?: DebugArchive) {
  const ui = (a?: DebugArchive) => (
    <MantineProvider>
      <DesignSystemV2Provider>
        <SettingsTab archive={a} settings={dm32SettingsView} />
      </DesignSystemV2Provider>
    </MantineProvider>
  );
  const view = render(ui(archive));
  return { ...view, replace: (a?: DebugArchive) => view.rerender(ui(a)) };
}

/** A channel page plus a settings page tagged 0x04 (and optionally more of them). */
function settingsCapture(
  edit: (p: Uint8Array) => void = () => {},
  extraSettingsPages = 0,
): Dm32DebugCapture {
  const channels = dm32Page(0x12);
  const settings = dm32Page(0x04);
  edit(settings);
  const blocks = new Map<number, Uint8Array>([
    [0x1000, channels],
    [0x2000, settings],
  ]);
  const discovered: Dm32DebugCapture['discovered'] = [
    { address: 0x1000, metadata: 0x12, type: 'channel' },
    { address: 0x2000, metadata: 0x04, type: 'unknown' },
  ];
  for (let n = 0; n < extraSettingsPages; n++) {
    blocks.set(0x3000 + n * 0x1000, dm32Page(0x04));
    discovered.push({ address: 0x3000 + n * 0x1000, metadata: 0x04, type: 'unknown' });
  }
  return dm32Capture({
    discovered,
    window: { start: 0x1000, end: 0x3000 + extraSettingsPages * 0x1000 },
    rawRange: { start: 0x1000, end: 0x3fff + extraSettingsPages * 0x1000 },
    blocks,
  });
}

describe('SettingsTab with the DM-32 view', () => {
  it('asks for a capture when there is none', () => {
    showSettings();
    expect(screen.getByText('Open or read a capture to inspect its settings.')).toBeInTheDocument();
  });

  it('says Not captured when there is no 0x04 page', async () => {
    const channels = dm32Page(0x12);
    const archive = await archiveDm32Capture(
      dm32Capture({ blocks: new Map([[0x1000, channels]]) }),
    );
    showSettings(archive);
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    expect(screen.getByText(/does not mean the radio has default settings/)).toBeInTheDocument();
  });

  it('refuses a wrong-model archive', async () => {
    const archive = await archiveDm32Capture(settingsCapture());
    showSettings({
      ...archive,
      manifest: { ...archive.manifest, radioModelId: 'AT-D890UV' },
    } as DebugArchive);
    expect(screen.getByText(/This archive is for AT-D890UV/)).toBeInTheDocument();
  });

  it('refuses to decode several 0x04 pages and lists them', async () => {
    showSettings(await archiveDm32Capture(settingsCapture(() => {}, 1)));
    expect(screen.getByText('Several pages, not decoded')).toBeInTheDocument();
    expect(screen.getByText(/Several pages tagged 0x04, not decoded/)).toBeInTheDocument();
    expect(screen.queryByText('Auto power off')).toBeNull();
  });

  it('shows grouped settings, raw bytes with addresses on demand, and the exclusion', async () => {
    showSettings(
      await archiveDm32Capture(
        settingsCapture((p) => {
          p[0x1e] = 3;
          p[0x8d] = 43;
          p[0x200] = 0x05;
          p[0x94] = 0xee;
        }),
      ),
    );
    for (const g of [
      'Display',
      'Tones & alerts',
      'Power & battery',
      'Keys & buttons',
      'GPS / APRS',
      'DMR & calls',
      'Privacy / lock',
    ])
      expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    expect(screen.getByText('120 minutes')).toBeInTheDocument();
    expect(screen.getByText('Function 43 (43)')).toBeInTheDocument();
    expect(screen.queryByText('Address')).toBeNull();
    // trailing sections are folded until opened
    expect(screen.getByRole('button', { name: 'Unknown bytes' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(screen.getByText('0x0000201E')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Documented, not decoded' }));
    expect(screen.getByRole('table', { name: 'Documented, not decoded' })).toHaveTextContent(
      /One-touch call.*05 00/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unused bytes' }));
    expect(screen.getByRole('table', { name: 'Unused bytes' })).toHaveTextContent(
      /Unused \(no reader\).*0x00002094 \+3.*EE 00 00/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unknown bytes' }));
    expect(screen.getByText('No unexplained captured bytes.')).toBeInTheDocument();
    expect(screen.getByText(/stock DM32.01.L01.048 layout/)).toBeInTheDocument();
    expect(
      screen.getByText(/Emergency systems and encryption keys are outside/),
    ).toBeInTheDocument();
  });

  it('uses one set of column widths in every group', async () => {
    showSettings(await archiveDm32Capture(settingsCapture()));
    const widths = (name: string) =>
      Array.from(
        screen.getByRole('table', { name }).querySelectorAll('col'),
        (c) => (c as HTMLElement).style.width,
      );
    const display = widths('Display settings');
    expect(display).toEqual(['40%', '30%', '30%']);
    expect(widths('Power & battery settings')).toEqual(display);
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    const raw = widths('Display settings');
    expect(raw).toHaveLength(5);
    expect(widths('Power & battery settings')).toEqual(raw);
  });

  it('masks the three passwords by default, reveals them on request, and re-hides on a new archive', async () => {
    const withPasswords = () =>
      settingsCapture((p) => {
        p[0x430] = 0xa5;
        p.set(new TextEncoder().encode('12345678'), 0x431);
        p.set(new TextEncoder().encode('87654321'), 0x43b);
        p.set(new TextEncoder().encode('11223344'), 0x443);
      });
    const view = showSettings(await archiveDm32Capture(withPasswords()));
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(screen.getAllByText('Hidden (password)')).toHaveLength(3);
    for (const secret of ['12345678', '87654321', '11223344', '31 32 33'])
      expect(screen.queryByText(new RegExp(secret))).toBeNull();
    const table = screen.getByRole('table', { name: 'Privacy / lock settings' });
    expect(table).toHaveTextContent('•• •• •• •• •• •• •• ••');
    // searching the secret finds nothing while hidden
    const search = screen.getByPlaceholderText('Search settings');
    fireEvent.change(search, { target: { value: '12345678' } });
    expect(screen.queryByText('Power-on password')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('87654321')).toBeInTheDocument();
    expect(screen.getByText('11223344')).toBeInTheDocument();
    view.replace(await archiveDm32Capture(withPasswords()));
    expect(screen.getAllByText('Hidden (password)')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('searches label, group and raw hex', async () => {
    showSettings(await archiveDm32Capture(settingsCapture((p) => (p[0x1e] = 3))));
    const search = screen.getByPlaceholderText('Search settings');
    fireEvent.change(search, { target: { value: 'power & battery' } });
    expect(screen.getByText('Auto power off')).toBeInTheDocument();
    expect(screen.queryByText('Key lock')).toBeNull();
    fireEvent.change(search, { target: { value: 'zzzz' } });
    expect(screen.queryByText('Auto power off')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    fireEvent.change(search, { target: { value: '03' } });
    expect(screen.getByText('Auto power off')).toBeInTheDocument();
  });

  it('resets the settings search and raw toggle when the archive is replaced', async () => {
    const view = showSettings(await archiveDm32Capture(settingsCapture()));
    fireEvent.change(screen.getByPlaceholderText('Search settings'), { target: { value: 'gps' } });
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    view.replace(await archiveDm32Capture(settingsCapture()));
    expect(screen.getByPlaceholderText('Search settings')).toHaveValue('');
    expect(screen.getByLabelText('Show raw bytes + address')).not.toBeChecked();
  });

  it('is keyboard reachable at 375 px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    showSettings(await archiveDm32Capture(settingsCapture()));
    const toggle = screen.getByLabelText('Show raw bytes + address');
    toggle.focus();
    expect(toggle).toHaveFocus();
    expect(screen.getByRole('table', { name: 'Power & battery settings' })).toBeInTheDocument();
  });
});
