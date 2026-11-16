import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { uv5rMiniSettingsView } from '@integrations/radio-io/radios/uv5r-mini/debugRead/settingsView.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { SettingsTab } from './SettingsTab.tsx';

function archive() {
  const decoded = new Uint8Array(0x10000);
  decoded.set([3, 1, 4, 3, 1, 8], 0x9000);
  decoded.set([1, 4, 6, 5, 2, 0, 0, 0], 0x8000);
  decoded.set([4, 3, 0, 1, 2, 5, 0, 0], 0x8020);
  return archiveUv5rMiniRead({
    decoded,
    raw: decodeUv5rMiniFullRead(decoded),
    ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
    spans: [],
  });
}

const renderTab = (a?: Parameters<typeof SettingsTab>[0]['archive']) =>
  render(
    <MantineProvider>
      <SettingsTab archive={a} settings={uv5rMiniSettingsView} />
    </MantineProvider>,
  );

afterEach(cleanup);

describe('UV-5R Mini Settings tab', () => {
  it('asks for a capture when none is open', () => {
    renderTab();
    expect(screen.getByText('Open or read a capture to inspect its settings.')).toBeTruthy();
  });

  it('shows the Default column and moves Address behind the raw toggle', () => {
    renderTab(archive());
    const settings = screen.getByRole('table', { name: 'Settings frame settings' });
    expect(within(settings).getByText('Backlight')).toBeTruthy();
    expect(within(settings).getByRole('columnheader', { name: 'Default' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Address' })).toBeNull();
    fireEvent.click(screen.getByLabelText(/Show raw bytes/));
    expect(screen.getAllByRole('columnheader', { name: 'Address' }).length).toBeGreaterThan(0);
  });

  it('decodes both VFO records', () => {
    renderTab(archive());
    expect(
      within(screen.getByRole('table', { name: 'VFO A settings' })).getByText(/146\.52000 MHz/),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('table', { name: 'VFO B settings' })).getByText(/430\.12500 MHz/),
    ).toBeTruthy();
  });

  it('says not captured when the archive has no whole clone', () => {
    const a = archive();
    renderTab({ ...a, regions: { ...a.regions, clone: new Uint8Array(16) } });
    expect(screen.getByText(/no whole decoded clone/)).toBeTruthy();
  });
});
