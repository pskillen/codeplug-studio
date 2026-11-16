import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { Uv5rMiniSettings } from './Uv5rMiniSettings.tsx';

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

const renderTab = (a?: Parameters<typeof Uv5rMiniSettings>[0]['archive']) =>
  render(
    <MantineProvider>
      <Uv5rMiniSettings archive={a} />
    </MantineProvider>,
  );

describe('Uv5rMiniSettings', () => {
  it('asks for a capture when none is open', () => {
    renderTab();
    expect(screen.getByText('Open or read a capture to inspect its settings.')).toBeTruthy();
  });

  it('renders the decoded settings and VFO frames from the archive', () => {
    renderTab(archive());
    const settings = within(screen.getByTestId('uv5r-mini-settings-frame'));
    expect(settings.getByText('Backlight')).toBeTruthy();
    const vfo = within(screen.getByTestId('uv5r-mini-vfo-frame'));
    expect(vfo.getByText(/146\.52000 MHz/)).toBeTruthy();
    expect(vfo.getByText(/430\.12500 MHz/)).toBeTruthy();
  });

  it('says not captured when the archive has no whole clone', () => {
    const a = archive();
    renderTab({ ...a, regions: { ...a.regions, clone: new Uint8Array(16) } });
    expect(screen.getByText(/Not captured/)).toBeTruthy();
    expect(screen.queryByTestId('uv5r-mini-settings-frame')).toBeNull();
  });
});
